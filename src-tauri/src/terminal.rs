use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

const DEFAULT_COLS: u16 = 120;
const DEFAULT_ROWS: u16 = 30;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSession {
    pub session_id: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutput {
    session_id: String,
    data: String,
}

struct ActiveSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

pub struct TerminalManager {
    sessions: Mutex<HashMap<String, ActiveSession>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn create_terminal_session(
    app: AppHandle,
    state: tauri::State<'_, TerminalManager>,
    cwd: String,
) -> Result<TerminalSession, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: DEFAULT_ROWS,
            cols: DEFAULT_COLS,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // login shell
    cmd.cwd(&cwd);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    // Drop slave — we only need the master side
    drop(pair.slave);

    let session_id = uuid::Uuid::new_v4().to_string();

    // Clone reader for the output streaming thread
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

    // Spawn a background thread to read PTY output and emit to frontend
    let app_handle = app.clone();
    let sid = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        "terminal://output",
                        TerminalOutput {
                            session_id: sid.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    state.sessions.lock().unwrap().insert(
        session_id.clone(),
        ActiveSession {
            writer,
            master: pair.master,
            child,
        },
    );

    Ok(TerminalSession { session_id })
}

#[tauri::command]
pub async fn write_terminal(
    state: tauri::State<'_, TerminalManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Terminal session {session_id} not found"))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn resize_terminal(
    state: tauri::State<'_, TerminalManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Terminal session {session_id} not found"))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn close_terminal_session(
    state: tauri::State<'_, TerminalManager>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
        let _ = session.child.wait();
    }
    Ok(())
}
