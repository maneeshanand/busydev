use tauri::State;

use crate::agents::manager::{
    AgentEventBatch, AgentManager, AgentSessionInfo, StartAgentSessionInput,
};
use crate::agents::AgentRegistry;

#[tauri::command]
pub fn start_agent_session(
    input: StartAgentSessionInput,
    agent_registry: State<'_, AgentRegistry>,
    agent_manager: State<'_, AgentManager>,
) -> Result<AgentSessionInfo, String> {
    let adapter = agent_registry
        .get(&input.adapter)
        .ok_or_else(|| format!("unknown agent adapter '{}'", input.adapter))?;

    agent_manager.start_session(adapter, input)
}

#[tauri::command]
pub fn stop_agent_session(id: String, agent_manager: State<'_, AgentManager>) -> Result<(), String> {
    agent_manager.stop_session(&id)
}

#[tauri::command]
pub fn send_agent_input(id: String, input: String, agent_manager: State<'_, AgentManager>) -> Result<(), String> {
    agent_manager.send_input(&id, &input)
}

#[tauri::command]
pub fn list_agent_sessions(agent_manager: State<'_, AgentManager>) -> Result<Vec<AgentSessionInfo>, String> {
    agent_manager.list_sessions()
}

#[tauri::command]
pub fn stream_agent_events(
    id: String,
    since_seq: Option<u64>,
    agent_manager: State<'_, AgentManager>,
) -> Result<AgentEventBatch, String> {
    agent_manager.stream_events(&id, since_seq)
}
