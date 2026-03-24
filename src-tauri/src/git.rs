use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

async fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-C", repo_path])
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn create_worktree(
    repo_path: String,
    worktree_path: String,
    branch: String,
) -> Result<(), String> {
    // Validate repo is a git repo
    run_git(&repo_path, &["rev-parse", "--is-inside-work-tree"]).await?;

    // Validate branch name
    Command::new("git")
        .args(["check-ref-format", "--branch", &branch])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Invalid branch name: {e}"))?
        .status
        .success()
        .then_some(())
        .ok_or_else(|| format!("Invalid branch name: {branch}"))?;

    // Create parent directory if needed
    let parent = Path::new(&worktree_path).parent();
    if let Some(p) = parent {
        std::fs::create_dir_all(p).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    // Check if branch already exists
    let branch_exists = run_git(&repo_path, &["rev-parse", "--verify", &branch])
        .await
        .is_ok();

    if branch_exists {
        // Use existing branch
        run_git(
            &repo_path,
            &["worktree", "add", &worktree_path, &branch],
        )
        .await?;
    } else {
        // Create worktree with new branch
        run_git(
            &repo_path,
            &["worktree", "add", "-b", &branch, &worktree_path],
        )
        .await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_worktree(
    repo_path: String,
    worktree_path: String,
) -> Result<(), String> {
    // Validate repo
    run_git(&repo_path, &["rev-parse", "--is-inside-work-tree"]).await?;

    // Check worktree exists
    if !Path::new(&worktree_path).exists() {
        return Ok(()); // Already gone
    }

    // Remove worktree (force to handle uncommitted changes)
    run_git(
        &repo_path,
        &["worktree", "remove", &worktree_path, "--force"],
    )
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn is_git_repo(path: String) -> Result<bool, String> {
    match run_git(&path, &["rev-parse", "--is-inside-work-tree"]).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
