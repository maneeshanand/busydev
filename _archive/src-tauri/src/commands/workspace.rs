use std::path::Path;
use std::process::Command;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Database;
use crate::security::sanitize_json_for_persistence;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub project_id: String,
    pub ticket: Option<String>,
    pub branch: String,
    pub worktree_path: String,
    pub agent_adapter: String,
    pub agent_config_json: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[tauri::command]
pub fn create_workspace(
    project_id: String,
    ticket: Option<String>,
    branch: String,
    worktree_path: String,
    agent_adapter: String,
    agent_config_json: Option<String>,
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Workspace, String> {
    validate_non_empty("project_id", &project_id)?;
    validate_non_empty("branch", &branch)?;
    validate_non_empty("worktree_path", &worktree_path)?;
    validate_non_empty("agent_adapter", &agent_adapter)?;

    let resolved_status = status.unwrap_or_else(|| "idle".to_string());
    validate_non_empty("status", &resolved_status)?;

    let workspace_id = Uuid::new_v4().to_string();
    let ticket = normalize_optional_text(ticket);
    let agent_config_json = sanitize_json_for_persistence("agent_config_json", agent_config_json)?;

    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    conn.execute(
        "INSERT INTO workspaces (
            id, project_id, ticket, branch, worktree_path, agent_adapter, agent_config_json, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            workspace_id,
            project_id,
            ticket,
            branch,
            worktree_path,
            agent_adapter,
            agent_config_json,
            resolved_status
        ],
    )
    .map_err(|err| format!("failed to insert workspace: {err}"))?;

    get_workspace_by_id(&conn, &workspace_id)?
        .ok_or_else(|| "failed to read created workspace".to_string())
}

#[tauri::command]
pub fn list_workspaces(
    project_id: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<Workspace>, String> {
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    list_workspaces_inner(&conn, project_id)
}

#[tauri::command]
pub fn update_workspace(
    id: String,
    ticket: Option<String>,
    branch: String,
    worktree_path: String,
    agent_adapter: String,
    agent_config_json: Option<String>,
    status: String,
    db: State<'_, Database>,
) -> Result<Workspace, String> {
    validate_non_empty("id", &id)?;
    validate_non_empty("branch", &branch)?;
    validate_non_empty("worktree_path", &worktree_path)?;
    validate_non_empty("agent_adapter", &agent_adapter)?;
    validate_non_empty("status", &status)?;

    let ticket = normalize_optional_text(ticket);
    let agent_config_json = sanitize_json_for_persistence("agent_config_json", agent_config_json)?;
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let rows = conn
        .execute(
            "UPDATE workspaces
             SET ticket = ?1, branch = ?2, worktree_path = ?3, agent_adapter = ?4, agent_config_json = ?5, status = ?6
             WHERE id = ?7",
            params![ticket, branch, worktree_path, agent_adapter, agent_config_json, status, id],
        )
        .map_err(|err| format!("failed to update workspace: {err}"))?;

    if rows == 0 {
        return Err("workspace not found".to_string());
    }

    get_workspace_by_id(&conn, &id)?.ok_or_else(|| "failed to read updated workspace".to_string())
}

#[tauri::command]
pub fn delete_workspace(id: String, db: State<'_, Database>) -> Result<(), String> {
    validate_non_empty("id", &id)?;

    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let rows = conn
        .execute("DELETE FROM workspaces WHERE id = ?1", params![id])
        .map_err(|err| format!("failed to delete workspace: {err}"))?;

    if rows == 0 {
        return Err("workspace not found".to_string());
    }

    Ok(())
}

pub fn cleanup_orphan_workspaces_on_startup(db: &Database) -> Result<usize, String> {
    let (removed_count, repo_paths) = {
        let connection = db.connection();
        let conn = connection
            .lock()
            .map_err(|_| "failed to lock database connection".to_string())?;

        cleanup_orphan_workspaces_inner(&conn)?
    };

    for repo_path in repo_paths {
        if let Err(err) = prune_repo_worktrees(&repo_path) {
            eprintln!("failed to prune git worktrees for '{repo_path}': {err}");
        }
    }

    Ok(removed_count)
}

fn list_workspaces_inner(
    conn: &Connection,
    project_id: Option<String>,
) -> Result<Vec<Workspace>, String> {
    if let Some(filter_project_id) = project_id {
        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, ticket, branch, worktree_path, agent_adapter, agent_config_json, status, created_at
                 FROM workspaces
                 WHERE project_id = ?1
                 ORDER BY created_at DESC",
            )
            .map_err(|err| format!("failed to prepare workspace list query: {err}"))?;

        let rows = stmt
            .query_map(params![filter_project_id], map_workspace_row)
            .map_err(|err| format!("failed to query workspaces: {err}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|err| format!("failed to decode workspaces: {err}"))
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, ticket, branch, worktree_path, agent_adapter, agent_config_json, status, created_at
                 FROM workspaces
                 ORDER BY created_at DESC",
            )
            .map_err(|err| format!("failed to prepare workspace list query: {err}"))?;

        let rows = stmt
            .query_map([], map_workspace_row)
            .map_err(|err| format!("failed to query workspaces: {err}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|err| format!("failed to decode workspaces: {err}"))
    }
}

fn cleanup_orphan_workspaces_inner(conn: &Connection) -> Result<(usize, Vec<String>), String> {
    let mut repo_stmt = conn
        .prepare("SELECT repo_path FROM projects")
        .map_err(|err| format!("failed to prepare projects query: {err}"))?;
    let repo_rows = repo_stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| format!("failed to query projects: {err}"))?;

    let repo_paths = repo_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to decode project repo paths: {err}"))?;

    let mut ws_stmt = conn
        .prepare("SELECT id, worktree_path FROM workspaces")
        .map_err(|err| format!("failed to prepare workspaces query: {err}"))?;
    let ws_rows = ws_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|err| format!("failed to query workspaces: {err}"))?;

    let workspaces = ws_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to decode workspace rows: {err}"))?;

    let orphan_ids = workspaces
        .into_iter()
        .filter_map(|(id, worktree_path)| {
            if Path::new(&worktree_path).exists() {
                None
            } else {
                Some(id)
            }
        })
        .collect::<Vec<_>>();

    for workspace_id in &orphan_ids {
        conn.execute(
            "DELETE FROM workspaces WHERE id = ?1",
            params![workspace_id],
        )
        .map_err(|err| format!("failed to delete orphan workspace '{workspace_id}': {err}"))?;
    }

    Ok((orphan_ids.len(), repo_paths))
}

fn prune_repo_worktrees(repo_path: &str) -> Result<(), String> {
    if !Path::new(repo_path).is_dir() {
        return Ok(());
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .arg("worktree")
        .arg("prune")
        .output()
        .map_err(|err| format!("failed to run git worktree prune: {err}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let message = if stderr.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        stderr.trim().to_string()
    };

    Err(if message.is_empty() {
        "git worktree prune failed with unknown error".to_string()
    } else {
        message
    })
}

fn get_workspace_by_id(conn: &Connection, id: &str) -> Result<Option<Workspace>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, ticket, branch, worktree_path, agent_adapter, agent_config_json, status, created_at
             FROM workspaces
             WHERE id = ?1",
        )
        .map_err(|err| format!("failed to prepare workspace query: {err}"))?;

    let mut rows = stmt
        .query(params![id])
        .map_err(|err| format!("failed to execute workspace query: {err}"))?;

    let row = rows
        .next()
        .map_err(|err| format!("failed reading workspace row: {err}"))?;

    match row {
        Some(row) => map_workspace_row(row)
            .map(Some)
            .map_err(|err| format!("failed to decode workspace row: {err}")),
        None => Ok(None),
    }
}

fn map_workspace_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Workspace> {
    Ok(Workspace {
        id: row.get(0)?,
        project_id: row.get(1)?,
        ticket: row.get(2)?,
        branch: row.get(3)?,
        worktree_path: row.get(4)?,
        agent_adapter: row.get(5)?,
        agent_config_json: row.get(6)?,
        status: row.get(7)?,
        created_at: row.get(8)?,
    })
}

fn validate_non_empty(name: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{name} cannot be empty"));
    }

    Ok(())
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::sanitize_json_for_persistence;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn list_workspaces_filters_by_project_id() {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                ticket TEXT,
                branch TEXT NOT NULL,
                worktree_path TEXT NOT NULL,
                agent_adapter TEXT NOT NULL,
                agent_config_json TEXT,
                status TEXT NOT NULL DEFAULT 'idle',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .expect("failed to create workspaces table");

        conn.execute(
            "INSERT INTO workspaces (id, project_id, ticket, branch, worktree_path, agent_adapter, status)
             VALUES ('w1', 'p1', NULL, 'feat/a', '/tmp/w1', 'codex', 'idle')",
            [],
        )
        .expect("failed to insert workspace w1");

        conn.execute(
            "INSERT INTO workspaces (id, project_id, ticket, branch, worktree_path, agent_adapter, status)
             VALUES ('w2', 'p2', NULL, 'feat/b', '/tmp/w2', 'codex', 'idle')",
            [],
        )
        .expect("failed to insert workspace w2");

        let filtered = list_workspaces_inner(&conn, Some("p1".to_string()))
            .expect("failed to list workspaces");

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, "w1");
        assert_eq!(filtered[0].project_id, "p1");
    }

    #[test]
    fn cleanup_orphan_workspaces_removes_missing_worktree_rows() {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                repo_path TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE workspaces (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                ticket TEXT,
                branch TEXT NOT NULL,
                worktree_path TEXT NOT NULL,
                agent_adapter TEXT NOT NULL,
                agent_config_json TEXT,
                status TEXT NOT NULL DEFAULT 'idle',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
             );",
        )
        .expect("failed to create tables");

        conn.execute(
            "INSERT INTO projects (id, name, repo_path) VALUES ('p1', 'Proj', '/tmp/repo')",
            [],
        )
        .expect("failed to insert project");

        let existing_path = temp_dir_path("ws-existing");
        fs::create_dir_all(&existing_path).expect("failed to create existing worktree path");
        let missing_path = temp_dir_path("ws-missing");

        conn.execute(
            "INSERT INTO workspaces (id, project_id, ticket, branch, worktree_path, agent_adapter, status)
             VALUES ('w-missing', 'p1', NULL, 'feat/a', ?1, 'codex', 'idle')",
            params![missing_path.to_string_lossy()],
        )
        .expect("failed to insert missing workspace");

        conn.execute(
            "INSERT INTO workspaces (id, project_id, ticket, branch, worktree_path, agent_adapter, status)
             VALUES ('w-existing', 'p1', NULL, 'feat/b', ?1, 'codex', 'idle')",
            params![existing_path.to_string_lossy()],
        )
        .expect("failed to insert existing workspace");

        let (removed_count, _) =
            cleanup_orphan_workspaces_inner(&conn).expect("cleanup should succeed");
        assert_eq!(removed_count, 1);

        let workspace_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM workspaces", [], |row| row.get(0))
            .expect("failed to count workspaces");
        assert_eq!(workspace_count, 1);

        let remaining_id: String = conn
            .query_row("SELECT id FROM workspaces LIMIT 1", [], |row| row.get(0))
            .expect("failed to read remaining workspace");
        assert_eq!(remaining_id, "w-existing");

        let _ = fs::remove_dir_all(existing_path);
    }

    fn temp_dir_path(prefix: &str) -> std::path::PathBuf {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("busydev-{prefix}-{now}"))
    }

    #[test]
    fn sanitize_agent_config_json_redacts_sensitive_keys() {
        let config = Some(r#"{"authorization":"Bearer abc","safe":"value"}"#.to_string());
        let sanitized = sanitize_json_for_persistence("agent_config_json", config)
            .expect("sanitize should succeed")
            .expect("sanitized config should exist");

        let value: serde_json::Value =
            serde_json::from_str(&sanitized).expect("sanitized config should remain valid json");
        assert_eq!(value["authorization"], "***REDACTED***");
        assert_eq!(value["safe"], "value");
    }
}
