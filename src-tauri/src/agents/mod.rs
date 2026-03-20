pub mod claude;
pub mod codex;

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentStatus {
    Working,
    NeedsInput,
    Idle,
    Error,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub model: Option<String>,
    pub mode: Option<String>,
    pub extra: Value,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            model: None,
            mode: None,
            extra: Value::Null,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AgentEvent {
    Message { content: String },
    ToolCall { name: String, input: Value },
    ToolResult { name: String, output: Value },
    Error { message: String },
    Status { status: AgentStatus },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Capability {
    FileRead,
    FileWrite,
    Terminal,
    WebSearch,
    Mcp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityEvent {
    pub capability: Capability,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub name: String,
    pub transport: String,
    pub command_or_url: String,
    pub scope: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentCommand {
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub env: HashMap<String, String>,
}

pub trait AgentAdapter: Send + Sync {
    fn name(&self) -> &'static str;
    fn build_command(&self, workspace_path: &str, config: &AgentConfig) -> AgentCommand;
    fn parse_output(&self, line: &str) -> Option<AgentEvent>;
    fn detect_status(&self, recent_events: &[AgentEvent]) -> AgentStatus;
    fn get_usage(&self, recent_events: &[AgentEvent]) -> Option<TokenUsage>;
    fn capabilities(&self) -> Vec<Capability>;
    fn parse_capability_event(&self, payload: &str) -> Option<CapabilityEvent>;
    fn mcp_config_format(&self, servers: &[McpServer]) -> Value;
}

#[derive(Default)]
pub struct AgentRegistry {
    adapters: HashMap<String, Arc<dyn AgentAdapter>>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register<A: AgentAdapter + 'static>(&mut self, adapter: A) {
        self.adapters
            .insert(adapter.name().to_string(), Arc::new(adapter));
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn AgentAdapter>> {
        self.adapters.get(name).map(Arc::clone)
    }

    pub fn names(&self) -> Vec<String> {
        self.adapters.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct DummyAdapter;

    impl AgentAdapter for DummyAdapter {
        fn name(&self) -> &'static str {
            "dummy"
        }

        fn build_command(&self, workspace_path: &str, _config: &AgentConfig) -> AgentCommand {
            AgentCommand {
                program: "dummy".into(),
                args: vec![],
                cwd: workspace_path.into(),
                env: HashMap::new(),
            }
        }

        fn parse_output(&self, line: &str) -> Option<AgentEvent> {
            Some(AgentEvent::Message {
                content: line.to_string(),
            })
        }

        fn detect_status(&self, _recent_events: &[AgentEvent]) -> AgentStatus {
            AgentStatus::Idle
        }

        fn get_usage(&self, _recent_events: &[AgentEvent]) -> Option<TokenUsage> {
            None
        }

        fn capabilities(&self) -> Vec<Capability> {
            vec![Capability::Terminal]
        }

        fn parse_capability_event(&self, payload: &str) -> Option<CapabilityEvent> {
            Some(CapabilityEvent {
                capability: Capability::Terminal,
                payload: Value::String(payload.to_string()),
            })
        }

        fn mcp_config_format(&self, _servers: &[McpServer]) -> Value {
            Value::Null
        }
    }

    #[test]
    fn registry_registers_and_retrieves_adapter() {
        let mut registry = AgentRegistry::new();
        registry.register(DummyAdapter);

        let adapter = registry.get("dummy");
        assert!(adapter.is_some());
        assert!(registry.names().contains(&"dummy".to_string()));
    }
}
