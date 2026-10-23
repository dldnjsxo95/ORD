//! state.json 파일 감시 파이프라인.
//!
//! 내보내기(scripts/ord-export.lua)가 파일 전체를 매번 다시 쓰므로
//! "줄 단위 tail" 이 아니라 "스냅샷 교체" 로 다룬다. notify 이벤트와 1초 폴링을 함께 써서
//! 이벤트 누락과 쓰기 도중 읽기(파싱 실패 → 다음 틱 재시도)를 모두 복구한다.

use std::{
    collections::{BTreeMap, hash_map::DefaultHasher},
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use ord_core::{ComboStatus, Database, GameState, OwnedUnit, evaluate, normalize_owned};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, watch};

/// 감시 대상 파일 이름 (감시 폴더 바로 아래)
pub const STATE_FILE: &str = "state.json";
/// 새 게임 상태와 조합 평가 결과
pub const EV_STATE: &str = "ord://state";
/// 감시 상태 변화와 오류
pub const EV_STATUS: &str = "ord://status";

#[derive(Clone, Serialize)]
pub struct StatePayload {
    pub file: String,
    /// 원본 (rawcode -> 수량, 변형·분신 정리 전)
    pub state: GameState,
    /// 분신 제외, 변형은 기본 유닛으로 합산한 보유 목록
    pub owned: Vec<OwnedUnit>,
    pub combos: Vec<ComboStatus>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StatusPayload {
    Watching { dir: String },
    Stopped,
    Error { message: String },
}

pub struct AppState {
    pub db: Arc<Database>,
    stop: Mutex<Option<watch::Sender<bool>>>,
    /// 감시 루프 세대. 새 감시가 이전 감시를 교체하면 올라간다. 교체된 루프는 종료 시 Stopped 를 보내지 않아
    /// (새 루프의 Watching 뒤에 Stopped 가 도착하는 경쟁을 막는다).
    generation: Arc<AtomicU64>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self { db: Arc::new(db), stop: Mutex::new(None), generation: Arc::new(AtomicU64::new(0)) }
    }
}

fn emit_status(app: &AppHandle, payload: StatusPayload) {
    let _ = app.emit(EV_STATUS, payload);
}

fn emit_error(app: &AppHandle, message: impl std::fmt::Display) {
    emit_status(app, StatusPayload::Error { message: message.to_string() });
}

/// 파일을 읽어 파싱되면 평가 결과를 내보낸다. 내용이 이전과 같으면 아무것도 하지 않는다.
async fn refresh(app: &AppHandle, db: &Database, file: &Path, last_hash: &mut Option<u64>) {
    let bytes = match tokio::fs::read(file).await {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return,
        Err(e) => return emit_error(app, format!("{} 읽기 실패: {e}", file.display())),
    };
    let text = String::from_utf8_lossy(&bytes);
    // 쓰는 도중이거나 불완전한 내용이면 파싱이 실패한다. 다음 이벤트나 폴링 틱에서 재시도.
    let Ok(state) = GameState::from_json(text.trim()) else { return };

    // 내보내기 스크립트는 0.5초마다 시각(t)만 바뀐 파일을 다시 쓴다. 화면에 의미 있는 값이 같으면
    // 이벤트를 보내지 않아 프런트가 매 틱 전체를 다시 그리는 일을 막는다.
    let mut hasher = DefaultHasher::new();
    state.map.hash(&mut hasher);
    state.player.hash(&mut hasher);
    state.gold.hash(&mut hasher);
    state.wood.hash(&mut hasher);
    state.units.hash(&mut hasher);
    state.items.hash(&mut hasher);
    state.evolution.hash(&mut hasher);
    state.difficulty.hash(&mut hasher);
    let hash = hasher.finish();
    if *last_hash == Some(hash) {
        return;
    }
    *last_hash = Some(hash);

    let combos = evaluate(db, &state.units, Some(state.gold), state.wood);
    let owned = normalize_owned(db, &state.units);
    let _ = app.emit(EV_STATE, StatePayload { file: file.to_string_lossy().into_owned(), state, owned, combos });
}

async fn run(
    app: AppHandle,
    db: Arc<Database>,
    dir: PathBuf,
    mut stop: watch::Receiver<bool>,
    my_gen: u64,
    generation: Arc<AtomicU64>,
) {
    let file = dir.join(STATE_FILE);

    // notify 콜백은 별도 스레드에서 호출되므로 채널로 tokio 쪽에 넘긴다.
    let (tx, mut rx) = mpsc::unbounded_channel::<()>();
    let mut watcher = match RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(ev) = res
                && matches!(ev.kind, EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_))
            {
                let _ = tx.send(());
            }
        },
        Config::default(),
    ) {
        Ok(w) => w,
        Err(e) => return emit_error(&app, format!("감시 초기화 실패: {e}")),
    };
    if let Err(e) = watcher.watch(&dir, RecursiveMode::NonRecursive) {
        return emit_error(&app, format!("{} 감시 실패: {e}", dir.display()));
    }
    emit_status(&app, StatusPayload::Watching { dir: dir.to_string_lossy().into_owned() });

    let mut last_hash = None;
    refresh(&app, &db, &file, &mut last_hash).await; // 앱을 늦게 켠 경우 기존 파일 반영

    let mut tick = tokio::time::interval(Duration::from_millis(1000));
    loop {
        tokio::select! {
            _ = stop.changed() => break,
            Some(()) = rx.recv() => {
                // 한 번의 저장(임시 파일 쓰기 + 이름 바꾸기)에 이벤트가 여러 개 오므로 잠깐 모은다.
                tokio::time::sleep(Duration::from_millis(30)).await;
                while rx.try_recv().is_ok() {}
                refresh(&app, &db, &file, &mut last_hash).await;
            }
            _ = tick.tick() => refresh(&app, &db, &file, &mut last_hash).await,
        }
    }
    drop(watcher);
    // 사용자가 명시적으로 중지한 경우에만 알린다. 다른 감시로 교체된 경우는 조용히 끝난다.
    if generation.load(Ordering::SeqCst) == my_gen {
        emit_status(&app, StatusPayload::Stopped);
    }
}

/// 기본 감시 폴더: %LOCALAPPDATA%\ord-helper
#[tauri::command]
pub fn default_dir() -> Option<String> {
    dirs::data_local_dir().map(|d| d.join("ord-helper").to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn start_watch(app: AppHandle, state: State<'_, AppState>, dir: Option<String>) -> Result<String, String> {
    let dir = match dir.filter(|d| !d.trim().is_empty()) {
        Some(d) => PathBuf::from(d),
        None => default_dir().map(PathBuf::from).ok_or("로컬 앱 데이터 폴더를 찾을 수 없습니다")?,
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("{} 생성 실패: {e}", dir.display()))?;

    let (tx, rx) = watch::channel(false);
    let my_gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    if let Some(old) = state.stop.lock().map_err(|e| e.to_string())?.replace(tx) {
        let _ = old.send(true);
    }
    tauri::async_runtime::spawn(run(app, Arc::clone(&state.db), dir.clone(), rx, my_gen, Arc::clone(&state.generation)));
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn stop_watch(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(tx) = state.stop.lock().map_err(|e| e.to_string())?.take() {
        let _ = tx.send(true);
    }
    Ok(())
}

/// 번들된 조합 DB
#[tauri::command]
pub fn get_database(state: State<'_, AppState>) -> Database {
    (*state.db).clone()
}

/// what-if: 임의의 보유 유닛으로 조합을 평가한다 (파일 상태와 무관)
#[tauri::command]
pub fn simulate(state: State<'_, AppState>, units: BTreeMap<String, u32>, gold: Option<i64>, wood: Option<i64>) -> Vec<ComboStatus> {
    evaluate(&state.db, &units, gold, wood)
}
