mod agents;
mod commands;
mod db;
mod git;
mod notifications;
mod state;
mod terminal;

use agents::claude::ClaudeAdapter;
use agents::codex::CodexAdapter;
use agents::AgentRegistry;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = db::initialize_for_app(app.handle()).map_err(|err| err.to_string())?;
            app.manage(db);

            let mut registry = AgentRegistry::new();
            registry.register(ClaudeAdapter);
            registry.register(CodexAdapter);
            app.manage(registry);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
