use std::ffi::OsStr;
use std::fs;
use std::path::Path;
use std::process::{Command, Output};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub repo_path: String,
    pub worktree_path: String,
    pub branch: String,
}

#[derive(Debug, Clone, Default)]
pub struct GitManager;

impl GitManager {
    pub fn create_worktree(
        &self,
        repo_path: &str,
        worktree_path: &str,
        branch: &str,
        base_ref: Option<&str>,
    ) -> Result<Worktree, String> {
        validate_repo_path(repo_path)?;
        validate_worktree_target(worktree_path)?;
        validate_branch_name(branch)?;

        let mut args = vec![
            OsStr::new("-C"),
            OsStr::new(repo_path),
            OsStr::new("worktree"),
            OsStr::new("add"),
            OsStr::new("-b"),
            OsStr::new(branch),
            OsStr::new(worktree_path),
        ];

        if let Some(reference) = base_ref {
            let trimmed = reference.trim();
            if !trimmed.is_empty() {
                args.push(OsStr::new(trimmed));
            }
        }

        run_git(args)?;

        Ok(Worktree {
            repo_path: repo_path.to_string(),
            worktree_path: worktree_path.to_string(),
            branch: branch.to_string(),
        })
    }

    pub fn delete_worktree(
        &self,
        repo_path: &str,
        worktree_path: &str,
        force: bool,
    ) -> Result<(), String> {
        validate_repo_path(repo_path)?;

        let path = Path::new(worktree_path);
        if !path.exists() {
            return Err(format!("worktree path does not exist: {worktree_path}"));
        }

        let mut args = vec![
            OsStr::new("-C"),
            OsStr::new(repo_path),
            OsStr::new("worktree"),
            OsStr::new("remove"),
        ];

        if force {
            args.push(OsStr::new("--force"));
        }

        args.push(OsStr::new(worktree_path));

        run_git(args)
    }
}

fn validate_repo_path(repo_path: &str) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .output()
        .map_err(|err| format!("failed to validate repo path: {err}"))?;

    if !output.status.success() {
        return Err(format_git_error(
            "repo path is not a git repository",
            &output,
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim() != "true" {
        return Err(format!(
            "repo path is not inside a git work tree: {repo_path}"
        ));
    }

    Ok(())
}

fn validate_worktree_target(worktree_path: &str) -> Result<(), String> {
    let path = Path::new(worktree_path);

    if path.exists() {
        if !path.is_dir() {
            return Err(format!(
                "worktree path exists and is not a directory: {worktree_path}"
            ));
        }

        let mut entries = fs::read_dir(path)
            .map_err(|err| format!("failed to inspect worktree path '{worktree_path}': {err}"))?;
        if entries.next().is_some() {
            return Err(format!(
                "worktree path must be absent or empty: {worktree_path}"
            ));
        }
    }

    Ok(())
}

fn validate_branch_name(branch: &str) -> Result<(), String> {
    if branch.trim().is_empty() {
        return Err("branch cannot be empty".to_string());
    }

    let output = Command::new("git")
        .arg("check-ref-format")
        .arg("--branch")
        .arg(branch)
        .output()
        .map_err(|err| format!("failed to validate branch name: {err}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_git_error("invalid branch name", &output))
    }
}

fn run_git(args: Vec<&OsStr>) -> Result<(), String> {
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|err| format!("failed to run git command: {err}"))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_git_error("git command failed", &output))
    }
}

fn format_git_error(prefix: &str, output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let message = if !stderr.trim().is_empty() {
        stderr.trim()
    } else {
        stdout.trim()
    };

    if message.is_empty() {
        prefix.to_string()
    } else {
        format!("{prefix}: {message}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn create_worktree_creates_branch_and_directory() {
        let repo_dir = temp_path("repo-create");
        let worktree_dir = temp_path("wt-create");
        let manager = GitManager;

        init_repo_with_commit(&repo_dir);

        let created = manager
            .create_worktree(
                repo_dir.to_string_lossy().as_ref(),
                worktree_dir.to_string_lossy().as_ref(),
                "feature/test-worktree",
                None,
            )
            .expect("expected worktree creation to succeed");

        assert_eq!(created.branch, "feature/test-worktree");
        assert!(worktree_dir.join(".git").exists());

        cleanup_path(&worktree_dir);
        cleanup_path(&repo_dir);
    }

    #[test]
    fn delete_worktree_removes_directory() {
        let repo_dir = temp_path("repo-delete");
        let worktree_dir = temp_path("wt-delete");
        let manager = GitManager;

        init_repo_with_commit(&repo_dir);
        manager
            .create_worktree(
                repo_dir.to_string_lossy().as_ref(),
                worktree_dir.to_string_lossy().as_ref(),
                "feature/delete-worktree",
                None,
            )
            .expect("expected worktree creation to succeed");

        manager
            .delete_worktree(
                repo_dir.to_string_lossy().as_ref(),
                worktree_dir.to_string_lossy().as_ref(),
                true,
            )
            .expect("expected worktree deletion to succeed");

        assert!(!worktree_dir.exists());

        cleanup_path(&repo_dir);
    }

    fn init_repo_with_commit(repo_path: &Path) {
        fs::create_dir_all(repo_path).expect("failed to create repo dir");
        run_git_in(repo_path, ["init"]).expect("failed to init repo");
        run_git_in(repo_path, ["checkout", "-b", "main"]).expect("failed to create main branch");

        fs::write(repo_path.join("README.md"), "seed\n").expect("failed to create seed file");
        run_git_in(repo_path, ["add", "."]).expect("failed to stage files");
        run_git_in(
            repo_path,
            [
                "-c",
                "user.name=busydev-test",
                "-c",
                "user.email=busydev@test.local",
                "commit",
                "-m",
                "init",
            ],
        )
        .expect("failed to commit seed files");
    }

    fn run_git_in<const N: usize>(cwd: &Path, args: [&str; N]) -> Result<(), String> {
        let output = Command::new("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .map_err(|err| format!("failed to run git: {err}"))?;

        if output.status.success() {
            Ok(())
        } else {
            Err(format_git_error("git command failed", &output))
        }
    }

    fn temp_path(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("busydev-{prefix}-{nanos}"))
    }

    fn cleanup_path(path: &Path) {
        if !path.exists() {
            return;
        }

        if path.is_dir() {
            fs::remove_dir_all(path).expect("failed to remove temp directory");
        } else {
            fs::remove_file(path).expect("failed to remove temp file");
        }
    }
}
