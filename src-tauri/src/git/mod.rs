use std::collections::HashMap;
use std::ffi::OsStr;
use std::fs;
use std::path::Path;
use std::process::{Command, Output};
use std::sync::Mutex;

use notify::{
    Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher, recommended_watcher,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub repo_path: String,
    pub worktree_path: String,
    pub branch: String,
}

#[derive(Debug, Clone, Default)]
pub struct GitManager;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWatchEvent {
    pub seq: u64,
    pub repo_path: String,
    pub paths: Vec<String>,
    pub kind: String,
}

struct WatchSession {
    _watcher: RecommendedWatcher,
    events: std::sync::Arc<Mutex<Vec<GitWatchEvent>>>,
}

#[derive(Default)]
pub struct GitWatchManager {
    sessions: Mutex<HashMap<String, WatchSession>>,
}

impl GitWatchManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start_watch(&self, repo_path: &str) -> Result<(), String> {
        validate_repo_path(repo_path)?;
        let canonical = canonical_repo_path(repo_path)?;

        {
            let sessions = self
                .sessions
                .lock()
                .map_err(|_| "failed to lock watch sessions".to_string())?;
            if sessions.contains_key(&canonical) {
                return Ok(());
            }
        }

        let events = std::sync::Arc::new(Mutex::new(Vec::new()));
        let next_seq = std::sync::Arc::new(Mutex::new(1_u64));
        let events_ref = std::sync::Arc::clone(&events);
        let next_seq_ref = std::sync::Arc::clone(&next_seq);
        let canonical_for_cb = canonical.clone();

        let mut watcher = recommended_watcher(move |result: notify::Result<Event>| {
            if let Ok(event) = result {
                let kind = classify_event_kind(&event.kind).to_string();
                let paths = event
                    .paths
                    .iter()
                    .map(|path| path.to_string_lossy().to_string())
                    .collect::<Vec<_>>();
                let seq = {
                    let mut locked = next_seq_ref.lock().expect("next_seq lock poisoned");
                    let current = *locked;
                    *locked += 1;
                    current
                };

                let mut locked = events_ref.lock().expect("watch events lock poisoned");
                locked.push(GitWatchEvent {
                    seq,
                    repo_path: canonical_for_cb.clone(),
                    paths,
                    kind,
                });
                if locked.len() > 1000 {
                    let excess = locked.len() - 1000;
                    locked.drain(0..excess);
                }
            }
        })
        .map_err(|err| format!("failed to create file watcher: {err}"))?;

        watcher
            .watch(Path::new(&canonical), RecursiveMode::Recursive)
            .map_err(|err| format!("failed to start watching repo path: {err}"))?;

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock watch sessions".to_string())?;
        sessions.insert(
            canonical,
            WatchSession {
                _watcher: watcher,
                events,
            },
        );

        Ok(())
    }

    pub fn stop_watch(&self, repo_path: &str) -> Result<(), String> {
        let canonical = canonical_repo_path(repo_path)?;
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock watch sessions".to_string())?;
        sessions.remove(&canonical);
        Ok(())
    }

    pub fn poll_events(&self, repo_path: &str, since_seq: Option<u64>) -> Result<Vec<GitWatchEvent>, String> {
        let canonical = canonical_repo_path(repo_path)?;
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock watch sessions".to_string())?;
        let session = sessions
            .get(&canonical)
            .ok_or_else(|| "watch session not found for repo path".to_string())?;
        let min_seq = since_seq.unwrap_or(0);

        let events = session
            .events
            .lock()
            .map_err(|_| "failed to lock watch events".to_string())?;

        Ok(events
            .iter()
            .filter(|event| event.seq > min_seq)
            .cloned()
            .collect())
    }

    pub fn list_watches(&self) -> Result<Vec<String>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock watch sessions".to_string())?;
        Ok(sessions.keys().cloned().collect())
    }
}

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

    pub fn generate_unified_diff(
        &self,
        repo_path: &str,
        base_ref: Option<&str>,
        paths: Option<&[String]>,
        staged: bool,
        context_lines: Option<u16>,
    ) -> Result<String, String> {
        validate_repo_path(repo_path)?;

        let mut args = vec![
            "-C".to_string(),
            repo_path.to_string(),
            "diff".to_string(),
            "--no-color".to_string(),
        ];

        if staged {
            args.push("--cached".to_string());
        }

        let context = context_lines.unwrap_or(3);
        args.push(format!("--unified={context}"));

        if let Some(reference) = base_ref {
            let trimmed = reference.trim();
            if !trimmed.is_empty() {
                args.push(trimmed.to_string());
            }
        }

        if let Some(paths) = paths {
            let normalized = paths
                .iter()
                .map(|path| path.trim())
                .filter(|path| !path.is_empty())
                .collect::<Vec<_>>();
            if !normalized.is_empty() {
                args.push("--".to_string());
                args.extend(normalized.into_iter().map(str::to_string));
            }
        }

        run_git_with_stdout(args)
    }

    pub fn accept_file_changes(&self, repo_path: &str, paths: &[String]) -> Result<(), String> {
        validate_repo_path(repo_path)?;
        let normalized_paths = normalize_paths(paths)?;

        let mut args = vec![
            "-C".to_string(),
            repo_path.to_string(),
            "add".to_string(),
            "--".to_string(),
        ];
        args.extend(normalized_paths);

        run_git_with_status(args)
    }

    pub fn revert_file_changes(&self, repo_path: &str, paths: &[String]) -> Result<(), String> {
        validate_repo_path(repo_path)?;
        let normalized_paths = normalize_paths(paths)?;

        let mut reset_args = vec![
            "-C".to_string(),
            repo_path.to_string(),
            "reset".to_string(),
            "HEAD".to_string(),
            "--".to_string(),
        ];
        reset_args.extend(normalized_paths.iter().cloned());
        run_git_with_status(reset_args)?;

        let mut checkout_args = vec![
            "-C".to_string(),
            repo_path.to_string(),
            "checkout".to_string(),
            "--".to_string(),
        ];
        checkout_args.extend(normalized_paths);
        run_git_with_status(checkout_args)
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

fn run_git_with_stdout(args: Vec<String>) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|err| format!("failed to run git command: {err}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format_git_error("git command failed", &output))
    }
}

fn run_git_with_status(args: Vec<String>) -> Result<(), String> {
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

fn normalize_paths(paths: &[String]) -> Result<Vec<String>, String> {
    let normalized = paths
        .iter()
        .map(|path| path.trim())
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    if normalized.is_empty() {
        Err("at least one file path must be provided".to_string())
    } else {
        Ok(normalized)
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

fn canonical_repo_path(repo_path: &str) -> Result<String, String> {
    fs::canonicalize(repo_path)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|err| format!("failed to canonicalize repo path '{repo_path}': {err}"))
}

fn classify_event_kind(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        EventKind::Access(_) => "access",
        EventKind::Any => "any",
        EventKind::Other => "other",
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

    #[test]
    fn generate_unified_diff_returns_patch_for_modified_file() {
        let repo_dir = temp_path("repo-diff");
        let manager = GitManager;

        init_repo_with_commit(&repo_dir);
        fs::write(repo_dir.join("README.md"), "seed\nnext line\n")
            .expect("failed to modify file for diff");

        let diff = manager
            .generate_unified_diff(repo_dir.to_string_lossy().as_ref(), None, None, false, Some(3))
            .expect("expected unified diff generation to succeed");

        assert!(diff.contains("diff --git"));
        assert!(diff.contains("--- a/README.md"));
        assert!(diff.contains("+++ b/README.md"));
        assert!(diff.contains("+next line"));

        cleanup_path(&repo_dir);
    }

    #[test]
    fn accept_file_changes_stages_selected_file() {
        let repo_dir = temp_path("repo-accept");
        let manager = GitManager;

        init_repo_with_commit(&repo_dir);
        fs::write(repo_dir.join("README.md"), "seed\nstaged line\n")
            .expect("failed to modify file for staging");

        manager
            .accept_file_changes(
                repo_dir.to_string_lossy().as_ref(),
                &[String::from("README.md")],
            )
            .expect("expected file accept to succeed");

        let output = run_git_capture(
            &repo_dir,
            ["diff", "--cached", "--name-only", "--", "README.md"],
        )
        .expect("failed to inspect cached diff");
        assert!(output.lines().any(|line| line.trim() == "README.md"));

        cleanup_path(&repo_dir);
    }

    #[test]
    fn revert_file_changes_restores_file_contents() {
        let repo_dir = temp_path("repo-revert");
        let manager = GitManager;

        init_repo_with_commit(&repo_dir);
        fs::write(repo_dir.join("README.md"), "seed\nchanged line\n")
            .expect("failed to modify file for revert");

        manager
            .revert_file_changes(
                repo_dir.to_string_lossy().as_ref(),
                &[String::from("README.md")],
            )
            .expect("expected file revert to succeed");

        let content = fs::read_to_string(repo_dir.join("README.md"))
            .expect("failed reading file after revert");
        assert_eq!(content.replace("\r\n", "\n"), "seed\n");

        cleanup_path(&repo_dir);
    }

    #[test]
    fn classify_event_kind_maps_common_kinds() {
        assert_eq!(classify_event_kind(&EventKind::Create(notify::event::CreateKind::Any)), "create");
        assert_eq!(classify_event_kind(&EventKind::Modify(notify::event::ModifyKind::Any)), "modify");
        assert_eq!(classify_event_kind(&EventKind::Remove(notify::event::RemoveKind::Any)), "remove");
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

    fn run_git_capture<const N: usize>(cwd: &Path, args: [&str; N]) -> Result<String, String> {
        let output = Command::new("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .map_err(|err| format!("failed to run git: {err}"))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
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
