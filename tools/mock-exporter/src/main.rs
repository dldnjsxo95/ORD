//! 워크3 없이 개발할 때 scripts/ord-export.lua 를 대신해 state.json 을 쓰는 도구.
//!
//! 사용: cargo run -p mock-exporter -- [출력경로] [간격ms]
//! 기본: %LOCALAPPDATA%\ord-helper\state.json, 1000ms
//!
//! 시나리오: 1티어 유닛을 하나씩 뽑고, 조합이 가능해지면 바로 조합한다.

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
    let out = args.first().map(PathBuf::from).unwrap_or_else(default_out);
    let interval: u64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(1000);
    if let Some(dir) = out.parent() {
        fs::create_dir_all(dir)?;
    }

    let db = Database::from_json(include_str!("../../../data/recipes.json")).expect("recipes.json");
    let pool: Vec<&str> = db.units.iter().filter(|u| u.tier == 1).map(|u| u.id.as_str()).collect();
    assert!(!pool.is_empty(), "recipes.json 에 1티어 유닛이 없음");

    let mut state = GameState {
        v: 1,
        map: "원피스 랜덤 디펜스 2.323 (mock)".into(),
        player: 0,
        gold: 500,
        ..Default::default()
    };
    println!("mock-exporter -> {} ({interval}ms)", out.display());

    for step in 0usize.. {
        let drawn = pool[step % pool.len()];
        *state.units.entry(drawn.to_string()).or_insert(0) += 1;
        state.gold += 30;
        println!("뽑기: {drawn}");

        if let Some(c) = ord_core::evaluate(&db, &state.units).into_iter().find(|c| c.craftable) {
            if let Some(r) = db.recipes.iter().find(|r| r.result == c.result) {
                for ing in &r.inputs {
                    if let Some(n) = state.units.get_mut(&ing.unit) {
                        *n -= ing.count;
                        if *n == 0 {
                            state.units.remove(&ing.unit);
                        }
                    }
                }
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
