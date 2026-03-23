use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Holds the PID of the currently running codex process so it can be killed.
pub struct RunningProcess(pub Mutex<Option<u32>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecInput {
    pub run_id: String,
    pub agent: Option<String>, // "codex" (default) or "claude"
    pub prompt: String,
    pub approval_policy: String,
    pub sandbox_mode: String,
    pub working_directory: String,
    pub model: Option<String>,
    pub skip_git_repo_check: bool,
}

fn build_agent_command(input: &CodexExecInput) -> (String, Vec<String>) {
    let agent = input.agent.as_deref().unwrap_or("codex");

    match agent {
        "claude" => {
            let mut args = vec![
                "-p".to_string(),
                "--continue".to_string(),
                "--verbose".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
            ];
            // Map approval policy to Claude permission flags
            match input.approval_policy.as_str() {
                "full-auto" => {
                    args.push("--allowedTools".to_string());
                    args.push("Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch".to_string());
                }
                "unless-allow-listed" => {
                    args.push("--allowedTools".to_string());
                    args.push("Edit,Write,Read,Glob,Grep".to_string());
                }
                _ => {} // "never" — default restricted mode
            }
            if let Some(ref model) = input.model {
                if !model.is_empty() {
                    args.push("--model".to_string());
                    args.push(model.clone());
                }
            }
            args.push(input.prompt.clone());
            ("claude".to_string(), args)
        }
        _ => {
            // Default: codex
            let mut args = vec![
                "-a".to_string(),
                input.approval_policy.clone(),
                "-s".to_string(),
                input.sandbox_mode.clone(),
            ];
            if let Some(ref model) = input.model {
                if !model.is_empty() {
                    args.push("--model".to_string());
                    args.push(model.clone());
                }
            }
            args.push("exec".to_string());
            if input.skip_git_repo_check {
                args.push("--skip-git-repo-check".to_string());
            }
            args.push("--json".to_string());
            args.push(input.prompt.clone());
            ("codex".to_string(), args)
        }
    }
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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CodexStreamEvent {
    run_id: String,
    kind: String,
    line: Option<String>,
    parsed_json: Option<serde_json::Value>,
    exit_code: Option<i32>,
    duration_ms: Option<u64>,
}

fn emit_stream_event(app: &AppHandle, payload: CodexStreamEvent) {
    let _ = app.emit("codex://stream", payload);
}

#[tauri::command]
pub async fn stop_codex_exec(state: tauri::State<'_, RunningProcess>) -> Result<(), String> {
    let pid = state.0.lock().unwrap().take();
    if let Some(pid) = pid {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn run_codex_exec(
    app: AppHandle,
    state: tauri::State<'_, RunningProcess>,
    input: CodexExecInput,
) -> Result<CodexExecOutput, String> {
    let (program, args) = build_agent_command(&input);
    let agent_name = input.agent.as_deref().unwrap_or("codex");

    let start = Instant::now();

    emit_stream_event(
        &app,
        CodexStreamEvent {
            run_id: input.run_id.clone(),
            kind: "started".into(),
            line: None,
            parsed_json: None,
            exit_code: None,
            duration_ms: None,
        },
    );

    let mut child = Command::new(&program)
        .args(&args)
        .current_dir(&input.working_directory)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            emit_stream_event(
                &app,
                CodexStreamEvent {
                    run_id: input.run_id.clone(),
                    kind: "spawn_error".into(),
                    line: Some(format!("Failed to spawn {agent_name}: {e}")),
                    parsed_json: None,
                    exit_code: None,
                    duration_ms: None,
                },
            );
            if e.kind() == std::io::ErrorKind::NotFound {
                format!("{agent_name} not found on PATH")
            } else {
                format!("Failed to spawn {agent_name}: {e}")
            }
        })?;

    // Store PID so it can be killed via stop_codex_exec
    if let Some(pid) = child.id() {
        *state.0.lock().unwrap() = Some(pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture codex stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture codex stderr".to_string())?;

    let app_stdout = app.clone();
    let run_id_stdout = input.run_id.clone();
    let stdout_task = tokio::spawn(async move {
        let mut stdout_raw = String::new();
        let mut parsed_lines: Vec<serde_json::Value> = Vec::new();
        let mut lines = BufReader::new(stdout).lines();

        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    if !stdout_raw.is_empty() {
                        stdout_raw.push('\n');
                    }
                    stdout_raw.push_str(&line);

                    let parsed_json = serde_json::from_str::<serde_json::Value>(&line).ok();
                    if let Some(ref value) = parsed_json {
                        parsed_lines.push(value.clone());
                    }

                    emit_stream_event(
                        &app_stdout,
                        CodexStreamEvent {
                            run_id: run_id_stdout.clone(),
                            kind: "stdout".into(),
                            line: Some(line),
                            parsed_json,
                            exit_code: None,
                            duration_ms: None,
                        },
                    );
                }
                Ok(None) => break,
                Err(err) => {
                    emit_stream_event(
                        &app_stdout,
                        CodexStreamEvent {
                            run_id: run_id_stdout.clone(),
                            kind: "stderr".into(),
                            line: Some(format!("Failed reading codex stdout: {err}")),
                            parsed_json: None,
                            exit_code: None,
                            duration_ms: None,
                        },
                    );
                    break;
                }
            }
        }

        (stdout_raw, parsed_lines)
    });

    let app_stderr = app.clone();
    let run_id_stderr = input.run_id.clone();
    let stderr_task = tokio::spawn(async move {
        let mut stderr_raw = String::new();
        let mut lines = BufReader::new(stderr).lines();

        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    if !stderr_raw.is_empty() {
                        stderr_raw.push('\n');
                    }
                    stderr_raw.push_str(&line);

                    emit_stream_event(
                        &app_stderr,
                        CodexStreamEvent {
                            run_id: run_id_stderr.clone(),
                            kind: "stderr".into(),
                            line: Some(line),
                            parsed_json: None,
                            exit_code: None,
                            duration_ms: None,
                        },
                    );
                }
                Ok(None) => break,
                Err(err) => {
                    emit_stream_event(
                        &app_stderr,
                        CodexStreamEvent {
                            run_id: run_id_stderr.clone(),
                            kind: "stderr".into(),
                            line: Some(format!("Failed reading codex stderr: {err}")),
                            parsed_json: None,
                            exit_code: None,
                            duration_ms: None,
                        },
                    );
                    break;
                }
            }
        }

        stderr_raw
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed waiting for codex process: {e}"))?;
    *state.0.lock().unwrap() = None;
    let exit_code = status.code();
    let duration_ms = start.elapsed().as_millis() as u64;

    let (stdout_raw, parsed_lines) = stdout_task
        .await
        .map_err(|e| format!("Failed joining stdout task: {e}"))?;
    let stderr_raw = stderr_task
        .await
        .map_err(|e| format!("Failed joining stderr task: {e}"))?;

    emit_stream_event(
        &app,
        CodexStreamEvent {
            run_id: input.run_id.clone(),
            kind: "completed".into(),
            line: None,
            parsed_json: None,
            exit_code,
            duration_ms: Some(duration_ms),
        },
    );

    // Try parsing as a single JSON blob first
    let parsed_json = serde_json::from_str::<serde_json::Value>(&stdout_raw)
        .ok()
        .or_else(|| {
            if parsed_lines.is_empty() {
                None
            } else {
                Some(serde_json::Value::Array(parsed_lines))
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
