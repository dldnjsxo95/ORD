mod watcher;

use watcher::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 조합 DB 는 빌드 시점에 번들한다. 교체하려면 npm run extract 로 data/ord-2.323.json 을 다시 만들고 빌드.
    let db = ord_core::Database::from_json(include_str!("../../data/ord-2.323.json")).expect("data/ord-2.323.json");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new(db))
        .invoke_handler(tauri::generate_handler![
            watcher::default_dir,
            watcher::start_watch,
            watcher::stop_watch,
            watcher::get_database,
            watcher::simulate,
            watcher::load_memos,
            watcher::save_memos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
