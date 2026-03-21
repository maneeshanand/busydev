use crate::git::{GitManager, Worktree};

#[tauri::command]
pub fn create_worktree(
    repo_path: String,
    worktree_path: String,
    branch: String,
    base_ref: Option<String>,
) -> Result<Worktree, String> {
    GitManager.create_worktree(&repo_path, &worktree_path, &branch, base_ref.as_deref())
}

#[tauri::command]
pub fn delete_worktree(
    repo_path: String,
    worktree_path: String,
    force: Option<bool>,
) -> Result<(), String> {
    GitManager.delete_worktree(&repo_path, &worktree_path, force.unwrap_or(false))
}

#[tauri::command]
pub fn generate_unified_diff(
    repo_path: String,
    base_ref: Option<String>,
    paths: Option<Vec<String>>,
    staged: Option<bool>,
    context_lines: Option<u16>,
) -> Result<String, String> {
    GitManager.generate_unified_diff(
        &repo_path,
        base_ref.as_deref(),
        paths.as_deref(),
        staged.unwrap_or(false),
        context_lines,
    )
}

#[tauri::command]
pub fn accept_file_changes(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    GitManager.accept_file_changes(&repo_path, &paths)
}

#[tauri::command]
pub fn revert_file_changes(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    GitManager.revert_file_changes(&repo_path, &paths)
}
