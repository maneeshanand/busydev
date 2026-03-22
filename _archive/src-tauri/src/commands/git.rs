use tauri::State;

use crate::git::{GitManager, GitWatchEvent, GitWatchManager, Worktree};

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

#[tauri::command]
pub fn start_git_watch(repo_path: String, watch_manager: State<'_, GitWatchManager>) -> Result<(), String> {
    watch_manager.start_watch(&repo_path)
}

#[tauri::command]
pub fn stop_git_watch(repo_path: String, watch_manager: State<'_, GitWatchManager>) -> Result<(), String> {
    watch_manager.stop_watch(&repo_path)
}

#[tauri::command]
pub fn poll_git_watch_events(
    repo_path: String,
    since_seq: Option<u64>,
    watch_manager: State<'_, GitWatchManager>,
) -> Result<Vec<GitWatchEvent>, String> {
    watch_manager.poll_events(&repo_path, since_seq)
}

#[tauri::command]
pub fn list_git_watches(watch_manager: State<'_, GitWatchManager>) -> Result<Vec<String>, String> {
    watch_manager.list_watches()
}
