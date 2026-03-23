use rusqlite::{params, Connection};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

pub struct SettingsDb {
    db_path: PathBuf,
}

impl SettingsDb {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_config_dir = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
        fs::create_dir_all(&app_config_dir)
            .map_err(|e| format!("Failed to create app config dir: {e}"))?;
        let db_path = app_config_dir.join("busydev_settings.db");
        let db = Self { db_path };
        db.init()?;
        Ok(db)
    }

    fn init(&self) -> Result<(), String> {
        let conn = self.connect()?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                settings_json TEXT NOT NULL,
                version INTEGER NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("Failed creating app_settings table: {e}"))?;
        Ok(())
    }

    fn connect(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path)
            .map_err(|e| format!("Failed opening settings DB {}: {e}", self.db_path.display()))
    }
}

fn ensure_global_scope(scope: Option<String>) -> Result<(), String> {
    if let Some(scope) = scope {
        if scope != "global" {
            return Err(format!(
                "Unsupported settings scope '{scope}'. Only 'global' is supported right now."
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_settings(
    db: State<'_, SettingsDb>,
    scope: Option<String>,
) -> Result<Option<Value>, String> {
    ensure_global_scope(scope)?;
    let conn = db.connect()?;
    let mut stmt = conn
        .prepare("SELECT settings_json FROM app_settings WHERE id = 1")
        .map_err(|e| format!("Failed to prepare get_settings statement: {e}"))?;
    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Failed querying settings row: {e}"))?;
    match rows
        .next()
        .map_err(|e| format!("Failed reading settings row: {e}"))?
    {
        Some(row) => {
            let settings_json: String = row
                .get(0)
                .map_err(|e| format!("Failed reading settings JSON: {e}"))?;
            let value: Value = serde_json::from_str(&settings_json)
                .map_err(|e| format!("Stored settings JSON is invalid: {e}"))?;
            Ok(Some(value))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn save_settings(
    db: State<'_, SettingsDb>,
    settings: Value,
    scope: Option<String>,
) -> Result<Value, String> {
    ensure_global_scope(scope)?;
    if !settings.is_object() {
        return Err("save_settings expects a JSON object".to_string());
    }

    let settings_version = settings
        .get("settingsVersion")
        .and_then(|v| v.as_i64())
        .unwrap_or(1);
    let settings_json = serde_json::to_string(&settings)
        .map_err(|e| format!("Failed to serialize settings JSON: {e}"))?;

    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO app_settings (id, settings_json, version, updated_at)
         VALUES (1, ?1, ?2, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           settings_json = excluded.settings_json,
           version = excluded.version,
           updated_at = datetime('now')",
        params![settings_json, settings_version],
    )
    .map_err(|e| format!("Failed saving settings: {e}"))?;

    Ok(settings)
}

#[tauri::command]
pub fn reset_settings(
    db: State<'_, SettingsDb>,
    scope: Option<String>,
    _section: Option<String>,
) -> Result<Option<Value>, String> {
    ensure_global_scope(scope)?;
    let conn = db.connect()?;
    conn.execute("DELETE FROM app_settings WHERE id = 1", [])
        .map_err(|e| format!("Failed resetting settings: {e}"))?;
    Ok(None)
}

#[tauri::command]
pub fn export_settings(db: State<'_, SettingsDb>) -> Result<String, String> {
    match get_settings(db, Some("global".to_string()))? {
        Some(value) => serde_json::to_string_pretty(&value)
            .map_err(|e| format!("Failed serializing export settings JSON: {e}")),
        None => Ok("{}".to_string()),
    }
}

#[tauri::command]
pub fn import_settings(db: State<'_, SettingsDb>, json: String) -> Result<Value, String> {
    let value: Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid settings import JSON: {e}"))?;
    save_settings(db, value, Some("global".to_string()))
}

