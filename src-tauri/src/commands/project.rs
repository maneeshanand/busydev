use std::process::Command;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub repo_path: String,
    pub created_at: String,
}

#[tauri::command]
pub fn create_project(name: String, repo_path: String, db: State<'_, Database>) -> Result<Project, String> {
    validate_project_name(&name)?;
    validate_git_repo(&repo_path)?;

    let project_id = Uuid::new_v4().to_string();
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    insert_project(&conn, &project_id, &name, &repo_path)?;
    get_project_by_id(&conn, &project_id)?.ok_or_else(|| "failed to read created project".to_string())
}

#[tauri::command]
pub fn list_projects(db: State<'_, Database>) -> Result<Vec<Project>, String> {
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    list_projects_inner(&conn)
}

#[tauri::command]
pub fn update_project(id: String, name: String, db: State<'_, Database>) -> Result<Project, String> {
    validate_project_name(&name)?;

    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let rows = conn
        .execute("UPDATE projects SET name = ?1 WHERE id = ?2", params![name, id])
        .map_err(|err| format!("failed to update project: {err}"))?;

    if rows == 0 {
        return Err("project not found".to_string());
    }

    get_project_by_id(&conn, &id)?.ok_or_else(|| "failed to read updated project".to_string())
}

#[tauri::command]
pub fn delete_project(id: String, db: State<'_, Database>) -> Result<(), String> {
    let connection = db.connection();
    let conn = connection
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let rows = conn
        .execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|err| format!("failed to delete project: {err}"))?;

    if rows == 0 {
        return Err("project not found".to_string());
    }

    Ok(())
}

fn validate_project_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("project name cannot be empty".to_string());
    }
    Ok(())
}

fn validate_git_repo(repo_path: &str) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .output()
        .map_err(|err| format!("failed to validate repo path: {err}"))?;

    if !output.status.success() {
        return Err(format!("repo path is not a git repository: {repo_path}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim() != "true" {
        return Err(format!("repo path is not inside a git work tree: {repo_path}"));
    }

    Ok(())
}

fn insert_project(conn: &Connection, id: &str, name: &str, repo_path: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO projects (id, name, repo_path) VALUES (?1, ?2, ?3)",
        params![id, name, repo_path],
    )
    .map_err(|err| format!("failed to insert project: {err}"))?;

    Ok(())
}

fn list_projects_inner(conn: &Connection) -> Result<Vec<Project>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, repo_path, created_at FROM projects ORDER BY created_at DESC")
        .map_err(|err| format!("failed to prepare project list query: {err}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                repo_path: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|err| format!("failed to query projects: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to decode projects: {err}"))
}

fn get_project_by_id(conn: &Connection, id: &str) -> Result<Option<Project>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, repo_path, created_at FROM projects WHERE id = ?1")
        .map_err(|err| format!("failed to prepare project query: {err}"))?;

    let mut rows = stmt
        .query(params![id])
        .map_err(|err| format!("failed to execute project query: {err}"))?;

    let row = rows
        .next()
        .map_err(|err| format!("failed reading project row: {err}"))?;

    match row {
        Some(row) => Ok(Some(Project {
            id: row
                .get(0)
                .map_err(|err| format!("failed reading project id: {err}"))?,
            name: row
                .get(1)
                .map_err(|err| format!("failed reading project name: {err}"))?,
            repo_path: row
                .get(2)
                .map_err(|err| format!("failed reading project repo path: {err}"))?,
            created_at: row
                .get(3)
                .map_err(|err| format!("failed reading project created_at: {err}"))?,
        })),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_projects_returns_inserted_project() {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                repo_path TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .expect("failed to create projects table");

        insert_project(&conn, "p1", "Proj", "/tmp/repo").expect("failed to insert project");
        let list = list_projects_inner(&conn).expect("failed to list projects");

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "p1");
        assert_eq!(list[0].name, "Proj");
    }
}
