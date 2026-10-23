mod watcher;

use watcher::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 조합 DB 는 빌드 시점에 번들한다. 교체하려면 data/recipes.json 을 바꾸고 다시 빌드.
    let db = ord_core::Database::from_json(include_str!("../../data/recipes.json")).expect("data/recipes.json");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new(db))
        .invoke_handler(tauri::generate_handler![
            watcher::default_dir,
            watcher::start_watch,
            watcher::stop_watch,
            watcher::get_database,
            watcher::simulate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
