use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;

/// Holds PIDs of running agent processes so they can be killed.
pub struct RunningProcesses {
    pub processes: Mutex<HashMap<String, u32>>, // runId -> PID
}

impl RunningProcesses {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

/// Holds stdin writers for running processes that support interactive input.
pub struct ProcessWriters {
    pub writers: tokio::sync::Mutex<HashMap<String, tokio::process::ChildStdin>>,
}

impl ProcessWriters {
    pub fn new() -> Self {
        Self {
            writers: tokio::sync::Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexExecInput {
    pub run_id: String,
    pub agent: Option<String>,
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
            match input.approval_policy.as_str() {
                "interactive" => {
                    // Interactive permission prompts via stdin/stdout JSON
                    args.push("--permission-prompt-tool".to_string());
                    args.push("stdio".to_string());
                }
                _ => {
                    // Default: auto-approve everything for Claude
                    args.push("--dangerously-skip-permissions".to_string());
                }
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
pub async fn write_to_agent(
    writers: tauri::State<'_, ProcessWriters>,
    run_id: String,
    data: String,
) -> Result<(), String> {
    let mut map = writers.writers.lock().await;
    let writer = map
        .get_mut(&run_id)
        .ok_or_else(|| format!("No stdin writer for run {run_id}"))?;

    let bytes = format!("{data}\n");
    writer
        .write_all(bytes.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to agent stdin: {e}"))?;
    writer
        .flush()
        .await
        .map_err(|e| format!("Failed to flush agent stdin: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn stop_codex_exec(
    state: tauri::State<'_, RunningProcesses>,
    run_id: Option<String>,
) -> Result<(), String> {
    let mut processes = state.processes.lock().unwrap();
    if let Some(run_id) = run_id {
        // Stop a specific run
        if let Some(pid) = processes.remove(&run_id) {
            unsafe { libc::kill(pid as i32, libc::SIGTERM); }
        }
    } else {
        // Stop all running processes
        for (_, pid) in processes.drain() {
            unsafe { libc::kill(pid as i32, libc::SIGTERM); }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn run_codex_exec(
    app: AppHandle,
    state: tauri::State<'_, RunningProcesses>,
    writers: tauri::State<'_, ProcessWriters>,
    input: CodexExecInput,
) -> Result<CodexExecOutput, String> {
    let (program, args) = build_agent_command(&input);
    let agent_name = input.agent.as_deref().unwrap_or("codex");
    let run_id = input.run_id.clone();

    let start = Instant::now();

    emit_stream_event(
        &app,
        CodexStreamEvent {
            run_id: run_id.clone(),
            kind: "started".into(),
            line: None,
            parsed_json: None,
            exit_code: None,
            duration_ms: None,
        },
    );

    let needs_stdin = agent_name == "claude" && input.approval_policy == "interactive";

    let mut child = Command::new(&program)
        .args(&args)
        .current_dir(&input.working_directory)
        .stdin(if needs_stdin { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            emit_stream_event(
                &app,
                CodexStreamEvent {
                    run_id: run_id.clone(),
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
        state.processes.lock().unwrap().insert(run_id.clone(), pid);
    }

    // Store stdin writer for interactive approval
    if needs_stdin {
        if let Some(stdin) = child.stdin.take() {
            writers.writers.lock().await.insert(run_id.clone(), stdin);
        }
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let app_stdout = app.clone();
    let run_id_stdout = run_id.clone();
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
                            line: Some(format!("Failed reading stdout: {err}")),
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
    let run_id_stderr = run_id.clone();
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
                            line: Some(format!("Failed reading stderr: {err}")),
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
        .map_err(|e| format!("Failed waiting for process: {e}"))?;
    state.processes.lock().unwrap().remove(&run_id);
    writers.writers.lock().await.remove(&run_id);
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
            run_id: run_id.clone(),
            kind: "completed".into(),
            line: None,
            parsed_json: None,
            exit_code,
            duration_ms: Some(duration_ms),
        },
    );

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
