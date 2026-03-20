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
use commands::git::{create_worktree, delete_worktree};
use commands::project::{create_project, delete_project, list_projects, update_project};
use commands::terminal::{
    close_terminal_session, create_terminal_session, list_terminal_sessions,
    resize_terminal_session,
};
use commands::workspace::{create_workspace, delete_workspace, list_workspaces, update_workspace};
use tauri::Manager;
use terminal::TerminalManager;

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
            app.manage(TerminalManager::new());

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            create_project,
            list_projects,
            update_project,
            delete_project,
            create_worktree,
            delete_worktree,
            create_workspace,
            list_workspaces,
            update_workspace,
            delete_workspace,
            create_terminal_session,
            list_terminal_sessions,
            resize_terminal_session,
            close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
