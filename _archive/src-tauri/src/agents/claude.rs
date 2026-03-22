use std::collections::HashMap;

use serde_json::{json, Value};

use super::{
    AgentAdapter, AgentCommand, AgentConfig, AgentEvent, AgentStatus, Capability,
    CapabilityEvent, McpServer, TokenUsage,
};

pub struct ClaudeAdapter;

impl AgentAdapter for ClaudeAdapter {
    fn name(&self) -> &'static str {
        "Claude Code"
    }

    fn build_command(&self, workspace_path: &str, config: &AgentConfig) -> AgentCommand {
        let mut args = vec!["--output-format".to_string(), "stream-json".to_string()];
        if let Some(model) = &config.model {
            args.push("--model".to_string());
            args.push(model.clone());
        }

        AgentCommand {
            program: "claude".to_string(),
            args,
            cwd: workspace_path.to_string(),
            env: HashMap::new(),
        }
    }

    fn parse_output(&self, line: &str) -> Option<AgentEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }

        if let Ok(payload) = serde_json::from_str::<Value>(trimmed) {
            if let Some(event) = event_from_json_payload(&payload) {
                return Some(event);
            }
        }

        Some(AgentEvent::Message {
            content: trimmed.to_string(),
        })
    }

    fn detect_status(&self, recent_events: &[AgentEvent]) -> AgentStatus {
        recent_events
            .iter()
            .rev()
            .find_map(|event| match event {
                AgentEvent::Status { status } => Some(status.clone()),
                AgentEvent::Error { .. } => Some(AgentStatus::Error),
                _ => None,
            })
            .unwrap_or(AgentStatus::Idle)
    }

    fn get_usage(&self, recent_events: &[AgentEvent]) -> Option<TokenUsage> {
        recent_events.iter().rev().find_map(|event| match event {
            AgentEvent::ToolResult { name, output } if name == "usage" => parse_usage(output),
            _ => None,
        })
    }

    fn capabilities(&self) -> Vec<Capability> {
        vec![
            Capability::FileRead,
            Capability::FileWrite,
            Capability::Terminal,
            Capability::Mcp,
        ]
    }

    fn parse_capability_event(&self, payload: &str) -> Option<CapabilityEvent> {
        if let Ok(parsed) = serde_json::from_str::<Value>(payload) {
            if let Some(capability) = parsed.get("capability").and_then(Value::as_str) {
                let capability = match capability {
                    "fileRead" => Capability::FileRead,
                    "fileWrite" => Capability::FileWrite,
                    "terminal" => Capability::Terminal,
                    "webSearch" => Capability::WebSearch,
                    "mcp" => Capability::Mcp,
                    _ => Capability::Mcp,
                };

                return Some(CapabilityEvent {
                    capability,
                    payload: parsed,
                });
            }
        }

        Some(CapabilityEvent {
            capability: Capability::Mcp,
            payload: Value::String(payload.to_string()),
        })
    }

    fn mcp_config_format(&self, servers: &[McpServer]) -> Value {
        json!({
            "mcpServers": servers
                .iter()
                .filter(|server| server.enabled)
                .map(|server| {
                    json!({
                        "name": server.name,
                        "transport": server.transport,
                        "target": server.command_or_url,
                        "scope": server.scope
                    })
                })
                .collect::<Vec<_>>()
        })
    }
}

fn event_from_json_payload(payload: &Value) -> Option<AgentEvent> {
    if let Some(error_message) = payload
        .get("error")
        .and_then(|error| error.as_str().or_else(|| error.get("message").and_then(Value::as_str)))
    {
        return Some(AgentEvent::Error {
            message: error_message.to_string(),
        });
    }

    if let Some(status) = payload.get("status").and_then(Value::as_str) {
        if let Some(parsed_status) = parse_status(status) {
            return Some(AgentEvent::Status {
                status: parsed_status,
            });
        }
    }

    if let Some(usage) = payload.get("usage") {
        if usage.is_object() {
            return Some(AgentEvent::ToolResult {
                name: "usage".to_string(),
                output: usage.clone(),
            });
        }
    }

    if let Some(name) = payload
        .get("tool")
        .or_else(|| payload.get("tool_name"))
        .and_then(Value::as_str)
    {
        if payload.get("output").is_some() || payload.get("result").is_some() {
            return Some(AgentEvent::ToolResult {
                name: name.to_string(),
                output: payload
                    .get("output")
                    .cloned()
                    .or_else(|| payload.get("result").cloned())
                    .unwrap_or(Value::Null),
            });
        }

        return Some(AgentEvent::ToolCall {
            name: name.to_string(),
            input: payload
                .get("input")
                .cloned()
                .or_else(|| payload.get("arguments").cloned())
                .unwrap_or(Value::Null),
        });
    }

    extract_message_text(payload).map(|content| AgentEvent::Message { content })
}

fn extract_message_text(payload: &Value) -> Option<String> {
    if let Some(text) = payload.get("text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = payload
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
    {
        return Some(text.to_string());
    }
    if let Some(text) = payload.get("content").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = payload
        .get("delta")
        .and_then(|delta| delta.get("text"))
        .and_then(Value::as_str)
    {
        return Some(text.to_string());
    }

    None
}

fn parse_status(value: &str) -> Option<AgentStatus> {
    match value {
        "working" | "running" => Some(AgentStatus::Working),
        "needs_input" | "needsInput" => Some(AgentStatus::NeedsInput),
        "idle" => Some(AgentStatus::Idle),
        "error" => Some(AgentStatus::Error),
        "done" | "completed" => Some(AgentStatus::Done),
        _ => None,
    }
}

fn parse_usage(value: &Value) -> Option<TokenUsage> {
    let prompt_tokens = value
        .get("prompt_tokens")
        .or_else(|| value.get("input_tokens"))
        .and_then(Value::as_u64)?;
    let completion_tokens = value
        .get("completion_tokens")
        .or_else(|| value.get("output_tokens"))
        .and_then(Value::as_u64)?;
    let total_tokens = value
        .get("total_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(prompt_tokens + completion_tokens);
    let estimated_cost_usd = value
        .get("estimated_cost_usd")
        .or_else(|| value.get("cost_usd"))
        .and_then(Value::as_f64)
        .unwrap_or(0.0);

    Some(TokenUsage {
        prompt_tokens,
        completion_tokens,
        total_tokens,
        estimated_cost_usd,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_output_parses_json_message() {
        let adapter = ClaudeAdapter;
        let event = adapter
            .parse_output(r#"{"text":"hello from claude"}"#)
            .expect("expected parsed event");

        assert!(matches!(event, AgentEvent::Message { content } if content == "hello from claude"));
    }

    #[test]
    fn parse_output_parses_usage_payload() {
        let adapter = ClaudeAdapter;
        let event = adapter
            .parse_output(r#"{"usage":{"input_tokens":12,"output_tokens":8,"total_tokens":20,"cost_usd":0.01}}"#)
            .expect("expected parsed event");

        assert!(matches!(event, AgentEvent::ToolResult { name, .. } if name == "usage"));
    }

    #[test]
    fn get_usage_extracts_latest_usage_event() {
        let adapter = ClaudeAdapter;
        let usage = adapter.get_usage(&[
            AgentEvent::Message {
                content: "x".to_string(),
            },
            AgentEvent::ToolResult {
                name: "usage".to_string(),
                output: json!({
                    "input_tokens": 100,
                    "output_tokens": 40,
                    "total_tokens": 140,
                    "cost_usd": 0.12
                }),
            },
        ]);

        assert!(usage.is_some());
        let usage = usage.expect("usage should be present");
        assert_eq!(usage.prompt_tokens, 100);
        assert_eq!(usage.completion_tokens, 40);
        assert_eq!(usage.total_tokens, 140);
    }
}
