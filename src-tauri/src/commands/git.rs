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
