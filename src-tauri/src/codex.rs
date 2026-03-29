use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
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
    pub previous_prompts: Option<Vec<String>>,
}

fn build_agent_command(input: &CodexExecInput) -> (String, Vec<String>) {
    let agent = input.agent.as_deref().unwrap_or("codex");

    let has_previous = input
        .previous_prompts
        .as_ref()
        .map_or(false, |p| !p.is_empty());

    match agent {
        "deepseek" => ("deepseek".to_string(), Vec::new()),
        "claude" => {
            let mut args = vec![
                "-p".to_string(),
                "--dangerously-skip-permissions".to_string(),
                "--verbose".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
            ];
            // Continue the most recent Claude session for conversational context
            if has_previous {
                args.push("--continue".to_string());
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
            // Map busydev policy names to Codex CLI values
            let codex_policy = match input.approval_policy.as_str() {
                "full-auto" | "interactive" => "never",
                "unless-allow-listed" => "untrusted",
                "never" | "manual" => "on-request",
                _ => "never",
            };
            let mut args = vec![
                "-a".to_string(),
                codex_policy.to_string(),
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
            // Prepend previous prompts as context for Codex (no native session continuation)
            let effective_prompt = if has_previous {
                let prev = input.previous_prompts.as_ref().unwrap();
                let context: String = prev
                    .iter()
                    .enumerate()
                    .map(|(i, p)| format!("{}. {}", i + 1, p))
                    .collect::<Vec<_>>()
                    .join("\n");
                format!(
                    "Previous tasks completed in this session:\n{context}\n\nCurrent task:\n{}",
                    input.prompt
                )
            } else {
                input.prompt.clone()
            };
            args.push(effective_prompt);
            ("codex".to_string(), args)
        }
    }
}

fn build_effective_prompt(input: &CodexExecInput) -> String {
    let has_previous = input
        .previous_prompts
        .as_ref()
        .map_or(false, |p| !p.is_empty());
    if has_previous {
        let prev = input.previous_prompts.as_ref().unwrap();
        let context: String = prev
            .iter()
            .enumerate()
            .map(|(i, p)| format!("{}. {}", i + 1, p))
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "Previous tasks completed in this session:\n{context}\n\nCurrent task:\n{}",
            input.prompt
        )
    } else {
        input.prompt.clone()
    }
}

async fn run_deepseek_exec(
    app: &AppHandle,
    input: &CodexExecInput,
    run_id: &str,
    start: Instant,
) -> Result<CodexExecOutput, String> {
    let api_key = std::env::var("DEEPSEEK_API_KEY")
        .map_err(|_| "DEEPSEEK_API_KEY is not set".to_string())?;
    let base_url = std::env::var("DEEPSEEK_BASE_URL")
        .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string());
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let model = input
        .model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "deepseek-chat".to_string());
    let effective_prompt = build_effective_prompt(input);

    emit_stream_event(
        app,
        CodexStreamEvent {
            run_id: run_id.to_string(),
            kind: "stdout".into(),
            line: Some("deepseek request started".into()),
            parsed_json: Some(json!({
                "item": {
                    "type": "command_execution",
                    "command": "deepseek: chat/completions",
                    "status": "in_progress"
                }
            })),
            exit_code: None,
            duration_ms: None,
        },
    );

    let payload = json!({
        "model": model,
        "messages": [
            { "role": "user", "content": effective_prompt }
        ],
        "stream": true
    });

    let response = reqwest::Client::new()
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("DeepSeek request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API error ({status}): {body}"));
    }

    let mut stdout_raw = String::new();
    let mut parsed_lines: Vec<serde_json::Value> = Vec::new();
    let mut full_text = String::new();
    let mut buffer = String::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("DeepSeek stream read failed: {e}"))?;
        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim_end_matches('\r').to_string();
            buffer = buffer[pos + 1..].to_string();
            if line.is_empty() || !line.starts_with("data:") {
                continue;
            }
            let data = line.trim_start_matches("data:").trim();
            if data == "[DONE]" {
                continue;
            }
            if !stdout_raw.is_empty() {
                stdout_raw.push('\n');
            }
            stdout_raw.push_str(data);

            let parsed = serde_json::from_str::<serde_json::Value>(data)
                .map_err(|e| format!("DeepSeek stream JSON parse failed: {e}; data={data}"))?;

            if let Some(delta) = parsed
                .get("choices")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|first| first.get("delta"))
                .and_then(|d| d.get("content"))
                .and_then(|c| c.as_str())
            {
                if !delta.is_empty() {
                    full_text.push_str(delta);
                    let stream_event = json!({
                        "type": "assistant",
                        "message": {
                            "content": [
                                { "type": "text", "text": delta }
                            ]
                        }
                    });
                    parsed_lines.push(stream_event.clone());
                    emit_stream_event(
                        app,
                        CodexStreamEvent {
                            run_id: run_id.to_string(),
                            kind: "stdout".into(),
                            line: Some(delta.to_string()),
                            parsed_json: Some(stream_event),
                            exit_code: None,
                            duration_ms: None,
                        },
                    );
                }
            }
        }
    }

    // Keep one final full message in parsed output for summaries/history.
    // Do not emit it as a stream event; the live stream is already built from chunks.
    let final_message = json!({
        "item": { "type": "agent_message", "text": full_text.clone() }
    });
    parsed_lines.push(final_message.clone());

    let duration_ms = start.elapsed().as_millis() as u64;
    emit_stream_event(
        app,
        CodexStreamEvent {
            run_id: run_id.to_string(),
            kind: "completed".into(),
            line: None,
            parsed_json: None,
            exit_code: Some(0),
            duration_ms: Some(duration_ms),
        },
    );

    Ok(CodexExecOutput {
        stdout_raw,
        stderr_raw: String::new(),
        parsed_json: Some(serde_json::Value::Array(parsed_lines)),
        exit_code: Some(0),
        duration_ms,
    })
}

async fn run_gemini_exec(
    app: &AppHandle,
    input: &CodexExecInput,
    run_id: &str,
    start: Instant,
) -> Result<CodexExecOutput, String> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY is not set".to_string())?;
    let base_url = std::env::var("GEMINI_BASE_URL")
        .unwrap_or_else(|_| "https://generativelanguage.googleapis.com/v1beta".to_string());
    let model = input
        .model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "gemini-2.5-pro".to_string());
    let endpoint = format!(
        "{}/models/{}:streamGenerateContent?alt=sse&key={}",
        base_url.trim_end_matches('/'),
        model,
        api_key
    );
    let effective_prompt = build_effective_prompt(input);

    emit_stream_event(
        app,
        CodexStreamEvent {
            run_id: run_id.to_string(),
            kind: "stdout".into(),
            line: Some("gemini request started".into()),
            parsed_json: Some(json!({
                "item": {
                    "type": "command_execution",
                    "command": format!("gemini: {}", model),
                    "status": "in_progress"
                }
            })),
            exit_code: None,
            duration_ms: None,
        },
    );

    let payload = json!({
        "contents": [
            { "parts": [{ "text": effective_prompt }] }
        ]
    });

    let response = reqwest::Client::new()
        .post(&endpoint)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error ({status}): {body}"));
    }

    let mut stdout_raw = String::new();
    let mut parsed_lines: Vec<serde_json::Value> = Vec::new();
    let mut full_text = String::new();
    let mut buffer = String::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("Gemini stream read failed: {e}"))?;
        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim_end_matches('\r').to_string();
            buffer = buffer[pos + 1..].to_string();
            if line.is_empty() || !line.starts_with("data:") {
                continue;
            }
            let data = line.trim_start_matches("data:").trim();
            if data == "[DONE]" {
                continue;
            }
            if !stdout_raw.is_empty() {
                stdout_raw.push('\n');
            }
            stdout_raw.push_str(data);

            let parsed = serde_json::from_str::<serde_json::Value>(data)
                .map_err(|e| format!("Gemini stream JSON parse failed: {e}; data={data}"))?;

            // Gemini SSE: { "candidates": [{ "content": { "parts": [{ "text": "..." }] } }] }
            if let Some(delta) = parsed
                .get("candidates")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|first| first.get("content"))
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.as_array())
                .and_then(|parts| parts.first())
                .and_then(|part| part.get("text"))
                .and_then(|t| t.as_str())
            {
                if !delta.is_empty() {
                    full_text.push_str(delta);
                    let stream_event = json!({
                        "type": "assistant",
                        "message": {
                            "content": [
                                { "type": "text", "text": delta }
                            ]
                        }
                    });
                    parsed_lines.push(stream_event.clone());
                    emit_stream_event(
                        app,
                        CodexStreamEvent {
                            run_id: run_id.to_string(),
                            kind: "stdout".into(),
                            line: Some(delta.to_string()),
                            parsed_json: Some(stream_event),
                            exit_code: None,
                            duration_ms: None,
                        },
                    );
                }
            }
        }
    }

    let final_message = json!({
        "item": { "type": "agent_message", "text": full_text.clone() }
    });
    parsed_lines.push(final_message.clone());

    let duration_ms = start.elapsed().as_millis() as u64;
    emit_stream_event(
        app,
        CodexStreamEvent {
            run_id: run_id.to_string(),
            kind: "completed".into(),
            line: None,
            parsed_json: None,
            exit_code: Some(0),
            duration_ms: Some(duration_ms),
        },
    );

    Ok(CodexExecOutput {
        stdout_raw,
        stderr_raw: String::new(),
        parsed_json: Some(serde_json::Value::Array(parsed_lines)),
        exit_code: Some(0),
        duration_ms,
    })
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

    if agent_name == "deepseek" {
        return run_deepseek_exec(&app, &input, &run_id, start).await;
    }

    if agent_name == "gemini" {
        return run_gemini_exec(&app, &input, &run_id, start).await;
    }

    let (program, args) = build_agent_command(&input);

    // TODO: MAN-138 interactive approval needs stdin piping
    let needs_stdin = false;

    // Spawn through the user's login shell to inherit full PATH
    // (Tauri apps on macOS don't get shell profile env vars like /opt/homebrew/bin)
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let full_command = std::iter::once(program.clone())
        .chain(args.iter().map(|a| shell_escape::escape(a.into()).to_string()))
        .collect::<Vec<_>>()
        .join(" ");

    let mut child = Command::new(&shell)
        .args(["-l", "-c", &full_command])
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
