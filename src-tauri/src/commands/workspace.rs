use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Database;

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

    get_workspace_by_id(&conn, &workspace_id)?.ok_or_else(|| "failed to read created workspace".to_string())
}

#[tauri::command]
pub fn list_workspaces(project_id: Option<String>, db: State<'_, Database>) -> Result<Vec<Workspace>, String> {
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

fn list_workspaces_inner(conn: &Connection, project_id: Option<String>) -> Result<Vec<Workspace>, String> {
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

        rows
            .collect::<Result<Vec<_>, _>>()
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

        rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|err| format!("failed to decode workspaces: {err}"))
    }
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

        let filtered = list_workspaces_inner(&conn, Some("p1".to_string())).expect("failed to list workspaces");

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, "w1");
        assert_eq!(filtered[0].project_id, "p1");
    }
}
