use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const DEFAULT_COLS: u16 = 120;
const DEFAULT_ROWS: u16 = 40;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSession {
    pub id: String,
    pub cwd: String,
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
}

struct ActiveTerminalSession {
    metadata: TerminalSession,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

pub struct TerminalManager {
    sessions: Mutex<HashMap<String, ActiveTerminalSession>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn create_session(
        &self,
        cwd: &str,
        shell: Option<&str>,
        cols: Option<u16>,
        rows: Option<u16>,
    ) -> Result<TerminalSession, String> {
        validate_cwd(cwd)?;
        let size = resolve_size(cols, rows)?;
        let shell = resolve_shell(shell)?;

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(size)
            .map_err(|err| format!("failed to allocate pty: {err}"))?;

        let mut command = CommandBuilder::new(&shell);
        command.cwd(cwd);

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|err| format!("failed to spawn shell process: {err}"))?;

        let id = Uuid::new_v4().to_string();
        let metadata = TerminalSession {
            id: id.clone(),
            cwd: cwd.to_string(),
            shell,
            cols: size.cols,
            rows: size.rows,
        };

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal session map".to_string())?;

        sessions.insert(
            id,
            ActiveTerminalSession {
                metadata: metadata.clone(),
                master: pair.master,
                child,
            },
        );

        Ok(metadata)
    }

    pub fn list_sessions(&self) -> Result<Vec<TerminalSession>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal session map".to_string())?;

        Ok(sessions
            .values()
            .map(|session| session.metadata.clone())
            .collect())
    }

    pub fn resize_session(
        &self,
        id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<TerminalSession, String> {
        let size = resolve_size(Some(cols), Some(rows))?;

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal session map".to_string())?;

        let session = sessions
            .get_mut(id)
            .ok_or_else(|| "terminal session not found".to_string())?;

        session
            .master
            .resize(size)
            .map_err(|err| format!("failed to resize pty: {err}"))?;

        session.metadata.cols = size.cols;
        session.metadata.rows = size.rows;

        Ok(session.metadata.clone())
    }

    pub fn close_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock terminal session map".to_string())?;

        let mut session = sessions
            .remove(id)
            .ok_or_else(|| "terminal session not found".to_string())?;

        session
            .child
            .kill()
            .map_err(|err| format!("failed to terminate terminal session: {err}"))?;

        Ok(())
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

fn validate_cwd(cwd: &str) -> Result<(), String> {
    if cwd.trim().is_empty() {
        return Err("cwd cannot be empty".to_string());
    }

    let path = Path::new(cwd);
    if !path.exists() {
        return Err(format!("cwd does not exist: {cwd}"));
    }
    if !path.is_dir() {
        return Err(format!("cwd is not a directory: {cwd}"));
    }

    Ok(())
}

fn resolve_shell(shell: Option<&str>) -> Result<String, String> {
    if let Some(value) = shell {
        if !value.trim().is_empty() {
            return Ok(value.trim().to_string());
        }
    }

    std::env::var("SHELL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| Some("/bin/zsh".to_string()))
        .ok_or_else(|| "unable to resolve shell".to_string())
}

fn resolve_size(cols: Option<u16>, rows: Option<u16>) -> Result<PtySize, String> {
    let resolved_cols = cols.unwrap_or(DEFAULT_COLS);
    let resolved_rows = rows.unwrap_or(DEFAULT_ROWS);

    if resolved_cols == 0 {
        return Err("cols must be greater than zero".to_string());
    }
    if resolved_rows == 0 {
        return Err("rows must be greater than zero".to_string());
    }

    Ok(PtySize {
        rows: resolved_rows,
        cols: resolved_cols,
        pixel_width: 0,
        pixel_height: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_size_rejects_zero_values() {
        assert!(resolve_size(Some(0), Some(24)).is_err());
        assert!(resolve_size(Some(80), Some(0)).is_err());
    }

    #[test]
    fn resolve_shell_uses_provided_value() {
        let shell = resolve_shell(Some("/bin/bash")).expect("shell should resolve");
        assert_eq!(shell, "/bin/bash");
    }
}
