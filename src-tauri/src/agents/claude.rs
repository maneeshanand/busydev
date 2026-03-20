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
        if line.trim().is_empty() {
            return None;
        }
        Some(AgentEvent::Message {
            content: line.to_string(),
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

    fn get_usage(&self, _recent_events: &[AgentEvent]) -> Option<TokenUsage> {
        None
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
