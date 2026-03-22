use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::process::Command;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecInput {
    pub prompt: String,
    pub approval_policy: String,
    pub sandbox_mode: String,
    pub working_directory: String,
    pub model: Option<String>,
    pub skip_git_repo_check: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecOutput {
    pub stdout_raw: String,
    pub stderr_raw: String,
    pub parsed_json: Option<serde_json::Value>,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

#[tauri::command]
pub async fn run_codex_exec(input: CodexExecInput) -> Result<CodexExecOutput, String> {
    let mut args: Vec<String> = vec![
        "-a".into(),
        input.approval_policy.clone(),
        "-s".into(),
        input.sandbox_mode.clone(),
    ];

    if let Some(ref model) = input.model {
        if !model.is_empty() {
            args.push("--model".into());
            args.push(model.clone());
        }
    }

    args.push("exec".into());

    if input.skip_git_repo_check {
        args.push("--skip-git-repo-check".into());
    }

    args.push("--json".into());
    args.push(input.prompt.clone());

    let start = Instant::now();

    let output = Command::new("codex")
        .args(&args)
        .current_dir(&input.working_directory)
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "codex not found on PATH. Install it with: npm i -g @openai/codex".to_string()
            } else {
                format!("Failed to spawn codex: {e}")
            }
        })?;

    let duration_ms = start.elapsed().as_millis() as u64;
    let stdout_raw = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr_raw = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code();

    // Try parsing as a single JSON blob first
    let parsed_json = serde_json::from_str::<serde_json::Value>(&stdout_raw)
        .ok()
        .or_else(|| {
            // Fallback: try NDJSON — collect lines into an array
            let values: Vec<serde_json::Value> = stdout_raw
                .lines()
                .filter(|l| !l.trim().is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect();
            if values.is_empty() {
                None
            } else {
                Some(serde_json::Value::Array(values))
            }
        });

    Ok(CodexExecOutput {
        stdout_raw,
        stderr_raw,
        parsed_json,
        exit_code,
        duration_ms,
    })
}
