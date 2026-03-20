use tauri::State;

use crate::terminal::{TerminalManager, TerminalSession};

#[tauri::command]
pub fn create_terminal_session(
    cwd: String,
    shell: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    terminal_manager: State<'_, TerminalManager>,
) -> Result<TerminalSession, String> {
    terminal_manager.create_session(&cwd, shell.as_deref(), cols, rows)
}

#[tauri::command]
pub fn list_terminal_sessions(
    terminal_manager: State<'_, TerminalManager>,
) -> Result<Vec<TerminalSession>, String> {
    terminal_manager.list_sessions()
}

#[tauri::command]
pub fn resize_terminal_session(
    id: String,
    cols: u16,
    rows: u16,
    terminal_manager: State<'_, TerminalManager>,
) -> Result<TerminalSession, String> {
    terminal_manager.resize_session(&id, cols, rows)
}

#[tauri::command]
pub fn close_terminal_session(
    id: String,
    terminal_manager: State<'_, TerminalManager>,
) -> Result<(), String> {
    terminal_manager.close_session(&id)
}
