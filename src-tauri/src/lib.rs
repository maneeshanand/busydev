mod codex;
mod git;
mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(codex::RunningProcesses::new())
        .manage(codex::ProcessWriters::new())
        .manage(terminal::TerminalManager::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            codex::run_codex_exec,
            codex::stop_codex_exec,
            codex::write_to_agent,
            terminal::create_terminal_session,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_terminal_session,
            git::create_worktree,
            git::delete_worktree,
            git::is_git_repo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
