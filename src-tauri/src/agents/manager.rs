use std::collections::HashMap;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{AgentAdapter, AgentCommand, AgentConfig, AgentEvent, AgentStatus, TokenUsage};
use crate::security::redact_text_secrets;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionInfo {
    pub id: String,
    pub adapter: String,
    pub workspace_path: String,
    pub status: AgentStatus,
    pub started_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEventEnvelope {
    pub seq: u64,
    pub timestamp_ms: u128,
    pub event: AgentEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEventBatch {
    pub session: AgentSessionInfo,
    pub events: Vec<AgentEventEnvelope>,
    pub next_seq: u64,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAgentSessionInput {
    pub adapter: String,
    pub workspace_path: String,
    pub config: Option<AgentConfig>,
}

struct SessionRuntime {
    info: AgentSessionInfo,
    next_seq: u64,
    events: Vec<AgentEventEnvelope>,
    log_path: PathBuf,
}

struct ManagedSession {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<ChildStdin>>,
    runtime: Arc<Mutex<SessionRuntime>>,
    adapter: Arc<dyn AgentAdapter>,
}

pub struct AgentManager {
    sessions: Mutex<HashMap<String, ManagedSession>>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn start_session(
        &self,
        adapter: Arc<dyn AgentAdapter>,
        input: StartAgentSessionInput,
    ) -> Result<AgentSessionInfo, String> {
        let config = input.config.unwrap_or_default();
        let command = adapter.build_command(&input.workspace_path, &config);
        let mut child = spawn_agent_command(&command)?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "agent process stdout not available".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "agent process stderr not available".to_string())?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "agent process stdin not available".to_string())?;

        let session_id = Uuid::new_v4().to_string();
        let started_at_ms = now_ms();
        let log_path = create_session_log_file(&session_id)?;
        let info = AgentSessionInfo {
            id: session_id.clone(),
            adapter: input.adapter,
            workspace_path: input.workspace_path,
            status: AgentStatus::Working,
            started_at_ms,
        };
        let launch_line = format!(
            "session started adapter={} workspace={} command={} args={:?}",
            info.adapter, command.cwd, command.program, command.args
        );
        append_log_line(&log_path, &launch_line);
        let runtime = Arc::new(Mutex::new(SessionRuntime {
            info: info.clone(),
            next_seq: 1,
            events: Vec::new(),
            log_path,
        }));

        push_runtime_event(
            &runtime,
            AgentEvent::Status {
                status: AgentStatus::Working,
            },
        );

        let child = Arc::new(Mutex::new(child));
        let stdin = Arc::new(Mutex::new(stdin));
        let managed = ManagedSession {
            child: Arc::clone(&child),
            stdin,
            runtime: Arc::clone(&runtime),
            adapter: Arc::clone(&adapter),
        };

        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "failed to lock agent sessions".to_string())?;
            sessions.insert(session_id, managed);
        }

        spawn_stdout_loop(stdout, Arc::clone(&adapter), Arc::clone(&runtime));
        spawn_stderr_loop(stderr, Arc::clone(&runtime));
        spawn_exit_watcher(child, runtime);

        Ok(info)
    }

    pub fn stop_session(&self, id: &str) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock agent sessions".to_string())?;
        let managed = sessions
            .get(id)
            .ok_or_else(|| "agent session not found".to_string())?;

        let mut child = managed
            .child
            .lock()
            .map_err(|_| "failed to lock agent process".to_string())?;

        child
            .kill()
            .map_err(|err| format!("failed to kill agent process: {err}"))?;

        Ok(())
    }

    pub fn send_input(&self, id: &str, input: &str) -> Result<(), String> {
        if input.is_empty() {
            return Err("input cannot be empty".to_string());
        }

        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock agent sessions".to_string())?;
        let managed = sessions
            .get(id)
            .ok_or_else(|| "agent session not found".to_string())?;

        let mut stdin = managed
            .stdin
            .lock()
            .map_err(|_| "failed to lock agent stdin".to_string())?;

        stdin
            .write_all(input.as_bytes())
            .map_err(|err| format!("failed writing to agent stdin: {err}"))?;
        if !input.ends_with('\n') {
            stdin
                .write_all(b"\n")
                .map_err(|err| format!("failed writing newline to agent stdin: {err}"))?;
        }
        stdin
            .flush()
            .map_err(|err| format!("failed flushing agent stdin: {err}"))?;

        append_runtime_log(
            &managed.runtime,
            &format!("input {}", redact_text_secrets(input)),
        );

        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<AgentSessionInfo>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock agent sessions".to_string())?;

        let mut items = Vec::with_capacity(sessions.len());
        for managed in sessions.values() {
            let runtime = managed
                .runtime
                .lock()
                .map_err(|_| "failed to lock agent session runtime".to_string())?;
            items.push(runtime.info.clone());
        }

        Ok(items)
    }

    pub fn stream_events(
        &self,
        id: &str,
        since_seq: Option<u64>,
    ) -> Result<AgentEventBatch, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock agent sessions".to_string())?;
        let managed = sessions
            .get(id)
            .ok_or_else(|| "agent session not found".to_string())?;

        let runtime = managed
            .runtime
            .lock()
            .map_err(|_| "failed to lock agent session runtime".to_string())?;

        let min_seq = since_seq.unwrap_or(0);
        let events = runtime
            .events
            .iter()
            .filter(|event| event.seq > min_seq)
            .cloned()
            .collect::<Vec<_>>();

        let raw_events = runtime
            .events
            .iter()
            .map(|item| item.event.clone())
            .collect::<Vec<_>>();

        Ok(AgentEventBatch {
            session: runtime.info.clone(),
            events,
            next_seq: runtime.next_seq,
            usage: managed.adapter.get_usage(&raw_events),
        })
    }

    pub fn read_session_log(&self, id: &str, max_lines: Option<usize>) -> Result<String, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "failed to lock agent sessions".to_string())?;
        let managed = sessions
            .get(id)
            .ok_or_else(|| "agent session not found".to_string())?;
        let runtime = managed
            .runtime
            .lock()
            .map_err(|_| "failed to lock agent session runtime".to_string())?;
        let log_path = runtime.log_path.clone();
        drop(runtime);
        drop(sessions);

        let content = fs::read_to_string(&log_path)
            .map_err(|err| format!("failed reading agent log '{}': {err}", log_path.display()))?;

        if let Some(max_lines) = max_lines {
            if max_lines == 0 {
                return Ok(String::new());
            }
            let lines = content.lines().collect::<Vec<_>>();
            let start = lines.len().saturating_sub(max_lines);
            return Ok(lines[start..].join("\n"));
        }

        Ok(content)
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}

fn spawn_agent_command(command: &AgentCommand) -> Result<Child, String> {
    let program = resolve_program_path(&command.program).unwrap_or_else(|| command.program.clone());
    let mut cmd = Command::new(&program);
    cmd.args(&command.args)
        .current_dir(&command.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if !command.env.is_empty() {
        cmd.envs(&command.env);
    }

    cmd.spawn()
        .map_err(|err| format!("failed to spawn agent process '{}': {err}", program))
}

fn spawn_stdout_loop(
    stdout: impl std::io::Read + Send + 'static,
    adapter: Arc<dyn AgentAdapter>,
    runtime: Arc<Mutex<SessionRuntime>>,
) {
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    if let Some(event) = adapter.parse_output(&line) {
                        push_runtime_event(&runtime, event);
                    } else if !line.trim().is_empty() {
                        push_runtime_event(
                            &runtime,
                            AgentEvent::Message {
                                content: redact_text_secrets(&line),
                            },
                        );
                    }
                }
                Err(err) => {
                    push_runtime_event(
                        &runtime,
                        AgentEvent::Error {
                            message: format!("failed reading agent stdout: {err}"),
                        },
                    );
                    break;
                }
            }
        }
    });
}

fn spawn_stderr_loop(
    stderr: impl std::io::Read + Send + 'static,
    runtime: Arc<Mutex<SessionRuntime>>,
) {
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line_result in reader.lines() {
            match line_result {
                Ok(line) => {
                    if line.trim().is_empty() {
                        continue;
                    }
                    push_runtime_event(
                        &runtime,
                        AgentEvent::Error {
                            message: redact_text_secrets(&line),
                        },
                    );
                }
                Err(err) => {
                    push_runtime_event(
                        &runtime,
                        AgentEvent::Error {
                            message: format!("failed reading agent stderr: {err}"),
                        },
                    );
                    break;
                }
            }
        }
    });
}

fn spawn_exit_watcher(child: Arc<Mutex<Child>>, runtime: Arc<Mutex<SessionRuntime>>) {
    std::thread::spawn(move || {
        let result = child
            .lock()
            .map_err(|_| "failed to lock agent process for wait".to_string())
            .and_then(|mut locked| {
                locked
                    .wait()
                    .map_err(|err| format!("failed waiting for agent process exit: {err}"))
            });

        match result {
            Ok(status) if status.success() => {
                update_session_status(&runtime, AgentStatus::Done);
            }
            Ok(status) => {
                push_runtime_event(
                    &runtime,
                    AgentEvent::Error {
                        message: format!("agent exited with status: {status}"),
                    },
                );
                update_session_status(&runtime, AgentStatus::Error);
            }
            Err(message) => {
                push_runtime_event(&runtime, AgentEvent::Error { message });
                update_session_status(&runtime, AgentStatus::Error);
            }
        }
    });
}

fn push_runtime_event(runtime: &Arc<Mutex<SessionRuntime>>, event: AgentEvent) {
    let event = sanitize_runtime_event(event);
    if let Ok(mut locked) = runtime.lock() {
        if let AgentEvent::Status { status } = &event {
            locked.info.status = status.clone();
        }

        let envelope = AgentEventEnvelope {
            seq: locked.next_seq,
            timestamp_ms: now_ms(),
            event: event.clone(),
        };
        locked.next_seq += 1;
        locked.events.push(envelope);

        if locked.events.len() > 500 {
            let excess = locked.events.len() - 500;
            locked.events.drain(0..excess);
        }

        let log_line = format!(
            "event seq={} ts={} {}",
            locked.next_seq - 1,
            now_ms(),
            format_event_for_log(&event)
        );
        append_log_line(&locked.log_path, &log_line);
    }
}

fn sanitize_runtime_event(event: AgentEvent) -> AgentEvent {
    match event {
        AgentEvent::Message { content } => AgentEvent::Message {
            content: redact_text_secrets(&content),
        },
        AgentEvent::Error { message } => AgentEvent::Error {
            message: redact_text_secrets(&message),
        },
        other => other,
    }
}

fn update_session_status(runtime: &Arc<Mutex<SessionRuntime>>, status: AgentStatus) {
    if let Ok(mut locked) = runtime.lock() {
        locked.info.status = status.clone();
    }
    push_runtime_event(runtime, AgentEvent::Status { status });
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn resolve_program_path(program: &str) -> Option<String> {
    let path = Path::new(program);
    if path.components().count() > 1 {
        return Some(program.to_string());
    }

    let mut dirs = Vec::new();
    if let Some(raw_path) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&raw_path));
    }

    for fallback in [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/opt/local/bin",
    ] {
        dirs.push(PathBuf::from(fallback));
    }

    dirs.into_iter()
        .map(|dir| dir.join(program))
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.to_string_lossy().to_string())
}

fn create_session_log_file(session_id: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("busydev-agent-logs");
    fs::create_dir_all(&dir)
        .map_err(|err| format!("failed creating log directory '{}': {err}", dir.display()))?;
    let path = dir.join(format!("{session_id}.log"));
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|err| format!("failed creating agent log '{}': {err}", path.display()))?;
    Ok(path)
}

fn append_runtime_log(runtime: &Arc<Mutex<SessionRuntime>>, line: &str) {
    if let Ok(locked) = runtime.lock() {
        append_log_line(&locked.log_path, line);
    }
}

fn append_log_line(path: &Path, line: &str) {
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} {}", now_ms(), line);
    }
}

fn format_event_for_log(event: &AgentEvent) -> String {
    match event {
        AgentEvent::Message { content } => format!("message {}", content),
        AgentEvent::ToolCall { name, input } => format!("toolCall {} input={}", name, input),
        AgentEvent::ToolResult { name, output } => {
            format!("toolResult {} output={}", name, output)
        }
        AgentEvent::Error { message } => format!("error {}", message),
        AgentEvent::Status { status } => format!("status {:?}", status),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_runtime_event_increments_sequence() {
        let runtime = Arc::new(Mutex::new(SessionRuntime {
            info: AgentSessionInfo {
                id: "s1".to_string(),
                adapter: "x".to_string(),
                workspace_path: "/tmp".to_string(),
                status: AgentStatus::Working,
                started_at_ms: 1,
            },
            next_seq: 1,
            events: Vec::new(),
            log_path: std::env::temp_dir().join("busydev-test-runtime-1.log"),
        }));

        push_runtime_event(
            &runtime,
            AgentEvent::Message {
                content: "hello".to_string(),
            },
        );
        push_runtime_event(
            &runtime,
            AgentEvent::Message {
                content: "world".to_string(),
            },
        );

        let locked = runtime.lock().expect("runtime lock should succeed");
        assert_eq!(locked.events.len(), 2);
        assert_eq!(locked.events[0].seq, 1);
        assert_eq!(locked.events[1].seq, 2);
        assert_eq!(locked.next_seq, 3);
    }

    #[test]
    fn update_session_status_updates_info_and_event() {
        let runtime = Arc::new(Mutex::new(SessionRuntime {
            info: AgentSessionInfo {
                id: "s1".to_string(),
                adapter: "x".to_string(),
                workspace_path: "/tmp".to_string(),
                status: AgentStatus::Working,
                started_at_ms: 1,
            },
            next_seq: 1,
            events: Vec::new(),
            log_path: std::env::temp_dir().join("busydev-test-runtime-2.log"),
        }));

        update_session_status(&runtime, AgentStatus::Done);
        let locked = runtime.lock().expect("runtime lock should succeed");
        assert_eq!(locked.info.status, AgentStatus::Done);
        assert_eq!(locked.events.len(), 1);
        assert!(matches!(
            locked.events[0].event,
            AgentEvent::Status {
                status: AgentStatus::Done
            }
        ));
    }

    #[test]
    fn sanitize_runtime_event_redacts_message_secrets() {
        let event = sanitize_runtime_event(AgentEvent::Message {
            content: "Authorization: Bearer sk-live".to_string(),
        });

        match event {
            AgentEvent::Message { content } => {
                assert!(content.contains("Bearer ***REDACTED***"));
            }
            _ => panic!("expected message event"),
        }
    }
}
