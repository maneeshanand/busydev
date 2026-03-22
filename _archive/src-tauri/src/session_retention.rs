use std::thread;
use std::time::Duration;

use rusqlite::Connection;

use crate::db::Database;

const SESSION_RETENTION_DAYS: u32 = 30;
const DAILY_CLEANUP_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

pub fn cleanup_expired_sessions(db: &Database) -> Result<usize, String> {
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    cleanup_expired_sessions_inner(&conn, SESSION_RETENTION_DAYS)
}

pub fn spawn_daily_cleanup_job(db: Database) {
    thread::spawn(move || loop {
        thread::sleep(DAILY_CLEANUP_INTERVAL);
        if let Err(err) = cleanup_expired_sessions(&db) {
            eprintln!("daily session retention cleanup failed: {err}");
        }
    });
}

fn cleanup_expired_sessions_inner(conn: &Connection, retention_days: u32) -> Result<usize, String> {
    let modifier = format!("-{retention_days} days");
    conn.execute(
        "DELETE FROM sessions
         WHERE COALESCE(ended_at, started_at) < datetime('now', ?1)",
        [modifier],
    )
    .map_err(|err| format!("failed to cleanup expired sessions: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleanup_expired_sessions_deletes_rows_older_than_retention_window() {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                messages_json TEXT,
                token_usage REAL NOT NULL DEFAULT 0,
                cost REAL NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT
            );",
        )
        .expect("failed to create sessions table");

        conn.execute(
            "INSERT INTO sessions (id, workspace_id, started_at, ended_at)
             VALUES ('old', 'w1', datetime('now', '-40 days'), datetime('now', '-39 days'))",
            [],
        )
        .expect("failed to insert old session");

        conn.execute(
            "INSERT INTO sessions (id, workspace_id, started_at, ended_at)
             VALUES ('recent', 'w1', datetime('now', '-2 days'), datetime('now', '-1 days'))",
            [],
        )
        .expect("failed to insert recent session");

        let deleted =
            cleanup_expired_sessions_inner(&conn, 30).expect("cleanup should execute successfully");
        assert_eq!(deleted, 1);

        let remaining: i64 = conn
            .query_row("SELECT COUNT(1) FROM sessions", [], |row| row.get(0))
            .expect("failed to count rows");
        assert_eq!(remaining, 1);
    }
}
