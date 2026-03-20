use std::fmt::{Display, Formatter};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use tauri::Manager;

#[derive(Clone)]
#[allow(dead_code)]
pub struct Database {
    connection: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

#[allow(dead_code)]
impl Database {
    pub fn connection(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.connection)
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }
}

#[derive(Debug)]
pub enum DbError {
    Io(std::io::Error),
    Sql(rusqlite::Error),
    AppDataDirUnavailable,
}

impl Display for DbError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(err) => write!(f, "io error: {err}"),
            Self::Sql(err) => write!(f, "sqlite error: {err}"),
            Self::AppDataDirUnavailable => write!(f, "app data directory unavailable"),
        }
    }
}

impl std::error::Error for DbError {}

impl From<std::io::Error> for DbError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sql(value)
    }
}

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "0001_initial",
    sql: include_str!("../../migrations/0001_initial.sql"),
}];

pub fn initialize_for_app(app: &tauri::AppHandle) -> Result<Database, DbError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| DbError::AppDataDirUnavailable)?;
    initialize_at_path(&app_data_dir.join("busydev.db"))
}

pub fn initialize_at_path(path: &Path) -> Result<Database, DbError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;
    run_migrations(&connection)?;

    Ok(Database {
        connection: Arc::new(Mutex::new(connection)),
        db_path: path.to_path_buf(),
    })
}

fn run_migrations(connection: &Connection) -> Result<(), DbError> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
           version INTEGER PRIMARY KEY,
           name TEXT NOT NULL,
           applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );",
    )?;

    for migration in MIGRATIONS {
        let already_applied: i64 = connection.query_row(
            "SELECT COUNT(1) FROM schema_migrations WHERE version = ?1",
            params![migration.version],
            |row| row.get(0),
        )?;

        if already_applied == 0 {
            connection.execute_batch(migration.sql)?;
            connection.execute(
                "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2)",
                params![migration.version, migration.name],
            )?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_exists(connection: &Connection, table_name: &str) -> bool {
        connection
            .query_row(
                "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                params![table_name],
                |row| row.get::<_, i64>(0),
            )
            .expect("table existence query failed")
            > 0
    }

    #[test]
    fn migrations_are_idempotent() {
        let connection = Connection::open_in_memory().expect("failed to open sqlite in-memory db");

        run_migrations(&connection).expect("first migration run failed");
        run_migrations(&connection).expect("second migration run failed");

        let migration_count: i64 = connection
            .query_row("SELECT COUNT(1) FROM schema_migrations", [], |row| row.get(0))
            .expect("failed to query migration count");

        assert_eq!(migration_count, MIGRATIONS.len() as i64);
        assert!(table_exists(&connection, "projects"));
        assert!(table_exists(&connection, "workspaces"));
        assert!(table_exists(&connection, "mcp_servers"));
        assert!(table_exists(&connection, "sessions"));
    }
}
