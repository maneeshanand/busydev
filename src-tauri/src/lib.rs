mod codex;
mod git;
mod settings;
mod terminal;
mod tray;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(codex::RunningProcesses::new())
        .manage(codex::ProcessWriters::new())
        .manage(terminal::TerminalManager::new())
        .setup(|app| {
            let db = settings::SettingsDb::new(app.handle())?;
            app.manage(db);
            app.manage(tray::TrayState::new());
            tray::setup_tray(app.handle()).map_err(|e| Box::<dyn std::error::Error>::from(e))?;

            // Probe the user's full PATH from their login+interactive shell.
            // macOS GUI apps don't inherit shell profile PATH entries, so we
            // resolve it once at startup and inject it into the environment.
            if cfg!(target_os = "macos") {
                let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
                if let Ok(output) = std::process::Command::new(&shell)
                    .args(["-l", "-i", "-c", "echo $PATH"])
                    .output()
                {
                    if let Ok(path) = String::from_utf8(output.stdout) {
                        let path = path.trim();
                        if !path.is_empty() {
                            std::env::set_var("PATH", path);
                        }
                    }
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            codex::run_codex_exec,
            codex::stop_codex_exec,
            codex::write_to_agent,
            settings::get_settings,
            settings::save_settings,
            settings::reset_settings,
            settings::export_settings,
            settings::import_settings,
            terminal::create_terminal_session,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_terminal_session,
            git::create_worktree,
            git::delete_worktree,
            git::is_git_repo,
            tray::update_tray_badge,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
