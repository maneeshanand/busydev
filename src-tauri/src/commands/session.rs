use tauri::State;

use crate::db::Database;
use crate::session_retention::cleanup_expired_sessions;

#[tauri::command]
pub fn run_session_retention_cleanup(db: State<'_, Database>) -> Result<u64, String> {
    let deleted = cleanup_expired_sessions(&db)?;
    Ok(deleted as u64)
}
