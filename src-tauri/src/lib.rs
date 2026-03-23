mod codex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(codex::RunningProcess(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            codex::run_codex_exec,
            codex::stop_codex_exec
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
