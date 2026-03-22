use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Database;
use crate::security::sanitize_json_for_persistence;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub command_or_url: String,
    pub env_json: Option<String>,
    pub scope: String,
    pub enabled: bool,
}

#[tauri::command]
pub fn create_mcp_server(
    name: String,
    transport: String,
    command_or_url: String,
    env_json: Option<String>,
    scope: String,
    enabled: Option<bool>,
    db: State<'_, Database>,
) -> Result<McpServer, String> {
    validate_non_empty("name", &name)?;
    validate_non_empty("transport", &transport)?;
    validate_non_empty("command_or_url", &command_or_url)?;
    validate_non_empty("scope", &scope)?;

    let server_id = Uuid::new_v4().to_string();
    let env_json = sanitize_json_for_persistence("env_json", env_json)?;
    let enabled = enabled.unwrap_or(true);

    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    conn.execute(
        "INSERT INTO mcp_servers (
            id, name, transport, command_or_url, env_json, scope, enabled
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            server_id,
            name,
            transport,
            command_or_url,
            env_json,
            scope,
            bool_to_int(enabled)
        ],
    )
    .map_err(|err| format!("failed to insert MCP server: {err}"))?;

    get_mcp_server_by_id(&conn, &server_id)?
        .ok_or_else(|| "failed to read created MCP server".to_string())
}

#[tauri::command]
pub fn list_mcp_servers(db: State<'_, Database>) -> Result<Vec<McpServer>, String> {
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    list_mcp_servers_inner(&conn)
}

#[tauri::command]
pub fn update_mcp_server(
    id: String,
    name: String,
    transport: String,
    command_or_url: String,
    env_json: Option<String>,
    scope: String,
    enabled: bool,
    db: State<'_, Database>,
) -> Result<McpServer, String> {
    validate_non_empty("id", &id)?;
    validate_non_empty("name", &name)?;
    validate_non_empty("transport", &transport)?;
    validate_non_empty("command_or_url", &command_or_url)?;
    validate_non_empty("scope", &scope)?;

    let env_json = sanitize_json_for_persistence("env_json", env_json)?;
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let rows = conn
        .execute(
            "UPDATE mcp_servers
             SET name = ?1, transport = ?2, command_or_url = ?3, env_json = ?4, scope = ?5, enabled = ?6
             WHERE id = ?7",
            params![name, transport, command_or_url, env_json, scope, bool_to_int(enabled), id],
        )
        .map_err(|err| format!("failed to update MCP server: {err}"))?;

    if rows == 0 {
        return Err("MCP server not found".to_string());
    }

    get_mcp_server_by_id(&conn, &id)?.ok_or_else(|| "failed to read updated MCP server".to_string())
}

#[tauri::command]
pub fn delete_mcp_server(id: String, db: State<'_, Database>) -> Result<(), String> {
    validate_non_empty("id", &id)?;

    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let rows = conn
        .execute("DELETE FROM mcp_servers WHERE id = ?1", params![id])
        .map_err(|err| format!("failed to delete MCP server: {err}"))?;

    if rows == 0 {
        return Err("MCP server not found".to_string());
    }

    Ok(())
}

fn list_mcp_servers_inner(conn: &Connection) -> Result<Vec<McpServer>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, transport, command_or_url, env_json, scope, enabled
             FROM mcp_servers
             ORDER BY name ASC, id ASC",
        )
        .map_err(|err| format!("failed to prepare MCP server list query: {err}"))?;

    let rows = stmt
        .query_map([], map_mcp_server_row)
        .map_err(|err| format!("failed to query MCP servers: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to decode MCP servers: {err}"))
}

fn get_mcp_server_by_id(conn: &Connection, id: &str) -> Result<Option<McpServer>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, transport, command_or_url, env_json, scope, enabled
             FROM mcp_servers
             WHERE id = ?1",
        )
        .map_err(|err| format!("failed to prepare MCP server query: {err}"))?;

    let mut rows = stmt
        .query(params![id])
        .map_err(|err| format!("failed to execute MCP server query: {err}"))?;

    let row = rows
        .next()
        .map_err(|err| format!("failed reading MCP server row: {err}"))?;

    match row {
        Some(row) => map_mcp_server_row(row)
            .map(Some)
            .map_err(|err| format!("failed to decode MCP server row: {err}")),
        None => Ok(None),
    }
}

fn map_mcp_server_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<McpServer> {
    let enabled: i64 = row.get(6)?;
    Ok(McpServer {
        id: row.get(0)?,
        name: row.get(1)?,
        transport: row.get(2)?,
        command_or_url: row.get(3)?,
        env_json: row.get(4)?,
        scope: row.get(5)?,
        enabled: enabled != 0,
    })
}

fn validate_non_empty(name: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{name} cannot be empty"));
    }

    Ok(())
}

fn bool_to_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_table(conn: &Connection) {
        conn.execute_batch(
            "CREATE TABLE mcp_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                transport TEXT NOT NULL,
                command_or_url TEXT NOT NULL,
                env_json TEXT,
                scope TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1
            );",
        )
        .expect("failed to create mcp_servers table");
    }

    #[test]
    fn list_mcp_servers_returns_inserted_server() {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        create_table(&conn);

        conn.execute(
            "INSERT INTO mcp_servers (id, name, transport, command_or_url, env_json, scope, enabled)
             VALUES ('m1', 'My MCP', 'stdio', 'npx -y my-mcp', '{\"A\":\"B\"}', 'project', 1)",
            [],
        )
        .expect("failed to insert mcp server");

        let servers = list_mcp_servers_inner(&conn).expect("failed to list mcp servers");
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].id, "m1");
        assert_eq!(servers[0].name, "My MCP");
        assert_eq!(servers[0].enabled, true);
    }

    #[test]
    fn get_mcp_server_by_id_decodes_disabled_server() {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        create_table(&conn);

        conn.execute(
            "INSERT INTO mcp_servers (id, name, transport, command_or_url, env_json, scope, enabled)
             VALUES ('m2', 'Another MCP', 'http', 'http://localhost:3000/mcp', NULL, 'global', 0)",
            [],
        )
        .expect("failed to insert mcp server");

        let server = get_mcp_server_by_id(&conn, "m2")
            .expect("query should succeed")
            .expect("server should exist");

        assert_eq!(server.transport, "http");
        assert_eq!(server.scope, "global");
        assert!(!server.enabled);
    }

    #[test]
    fn sanitize_env_json_redacts_sensitive_keys_on_insert_path() {
        let env = Some(r#"{"OPENAI_API_KEY":"sk-123","SAFE":"ok"}"#.to_string());
        let sanitized = sanitize_json_for_persistence("env_json", env)
            .expect("sanitize should succeed")
            .expect("sanitized env should exist");

        let value: serde_json::Value =
            serde_json::from_str(&sanitized).expect("should deserialize sanitized env");
        assert_eq!(value["OPENAI_API_KEY"], "***REDACTED***");
        assert_eq!(value["SAFE"], "ok");
    }
}
