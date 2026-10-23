//! 워크3 없이 개발할 때 scripts/ord-export.lua 를 대신해 state.json 을 쓰는 도구.
//!
//! 사용: cargo run -p mock-exporter -- [출력경로] [간격ms]
//! 기본: %LOCALAPPDATA%\ord-helper\state.json, 1000ms
//!
//! 시나리오: 흔함 유닛을 하나씩 뽑고(실제 2.323 rawcode), 조합이 가능해지면 바로 조합한다.
//! 가끔 스킨 변형 유닛도 섞어 변형 합산이 화면에서 보이게 한다.

use std::{
    env, fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

use ord_core::{Database, GameState};

fn default_out() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ord-helper")
        .join("state.json")
}

/// Lua 스크립트와 같은 방식: 임시 파일에 쓰고 이름을 바꾼다.
fn write_atomic(path: &Path, text: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text)?;
    let _ = fs::remove_file(path);
    fs::rename(&tmp, path)
}

fn main() -> std::io::Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    // 빈 문자열은 "기본 경로" 로 취급한다 (간격만 바꾸고 싶을 때 `-- "" 500`)
    let out = args.first().filter(|s| !s.trim().is_empty()).map(PathBuf::from).unwrap_or_else(default_out);
    let interval: u64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(1000);
    if let Some(dir) = out.parent() {
        fs::create_dir_all(dir)?;
    }

    let db = Database::from_json(include_str!("../../../data/ord-2.323.json")).expect("ord-2.323.json");
    let pool: Vec<&str> = db.units.iter().filter(|u| u.grade.as_deref() == Some("흔함")).map(|u| u.id.as_str()).collect();
    assert!(!pool.is_empty(), "DB 에 흔함 유닛이 없음");
    // 스킨 변형 하나 (여름휴가 타시기 → 타시기 - 초월) 를 가끔 섞는다
    let skin = db.units.iter().find(|u| u.base_form.is_some() && !u.summon).map(|u| u.id.clone());

    let mut state = GameState {
        v: 1,
        map: format!("원피스 랜덤 디펜스 {} (mock)", db.version),
        player: 0,
        gold: 500,
        wood: Some(0),
        ..Default::default()
    };
    println!("mock-exporter -> {} ({interval}ms), 뽑기 풀 {}종", out.display(), pool.len());

    for step in 0usize.. {
        // 뽑기: 단순 의사난수 (재현 가능)
        let drawn = pool[(step * 7 + step / 3) % pool.len()];
        *state.units.entry(drawn.to_string()).or_insert(0) += 1;
        state.gold += 40;
        if step % 10 == 9 {
            state.wood = Some(state.wood.unwrap_or(0) + 1);
        }
        if step % 25 == 24
            && let Some(s) = &skin
        {
            *state.units.entry(s.clone()).or_insert(0) += 1;
        }
        println!("뽑기: {drawn} {}", db.unit(drawn).map(|u| u.name.as_str()).unwrap_or(""));

        // 조합 가능한 첫 조합을 수행 (재료는 기본 유닛 기준으로 차감)
        if let Some(c) = ord_core::evaluate(&db, &state.units, Some(state.gold), state.wood).into_iter().find(|c| c.craftable) {
            if let Some(r) = db.recipes.iter().find(|r| r.id == c.recipe_id) {
                let index = db.index();
                for ing in &r.materials {
                    let base = ord_core::base_of(&index, &ing.unit).to_string();
                    let mut left = ing.count;
                    // 기본 유닛 또는 그 변형 중 아무거나 차감
                    for (id, n) in state.units.iter_mut() {
                        if left == 0 {
                            break;
                        }
                        if ord_core::base_of(&index, id) == base && *n > 0 {
                            let take = (*n).min(left);
                            *n -= take;
                            left -= take;
                        }
                    }
                }
                state.units.retain(|_, n| *n > 0);
                state.gold -= r.gold;
                state.wood = state.wood.map(|w| w - r.wood - r.wood_incremental);
                *state.units.entry(c.result.clone()).or_insert(0) += 1;
                println!("조합: {} ({})", c.result_name, c.result);
            }
        }

        state.t = step as f64 * interval as f64 / 1000.0;
        write_atomic(&out, &serde_json::to_string(&state)?)?;
        thread::sleep(Duration::from_millis(interval));
    }
    Ok(())
}
