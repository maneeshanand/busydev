import { useState } from "react";
import type { ChatEvent } from "./useAgentStream";
import "./ChatMessage.css";

interface ChatMessageProps {
  event: ChatEvent;
}

export function ChatMessage({ event }: ChatMessageProps) {
  const { source, event: agentEvent } = event;

  if (agentEvent.type === "status") {
    return (
      <div className="chat-message chat-message--status">
        <span className="chat-message__status-pill">
          {formatStatus(agentEvent.status ?? "Idle")}
        </span>
      </div>
    );
  }

  if (agentEvent.type === "message") {
    return (
      <div className={`chat-message chat-message--${source}`}>
        <div className={`chat-message__bubble chat-message__bubble--${source}`}>
          <pre className="chat-message__text">{agentEvent.content}</pre>
        </div>
      </div>
    );
  }

  if (agentEvent.type === "toolCall") {
    return <ToolCard label={`Using ${agentEvent.name}`} data={agentEvent.input} />;
  }

  if (agentEvent.type === "toolResult") {
    return <ToolCard label={`${agentEvent.name} result`} data={agentEvent.output} />;
  }

  if (agentEvent.type === "error") {
    return (
      <div className="chat-message chat-message--error">
        <div className="chat-message__bubble chat-message__bubble--error">
          <pre className="chat-message__text">{agentEvent.message}</pre>
        </div>
      </div>
    );
  }

  return null;
}

function ToolCard({ label, data }: { label: string; data: unknown }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="chat-message chat-message--tool">
      <button
        className="chat-message__tool-header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="chat-message__tool-icon">{"\u2699"}</span>
        <span className="chat-message__tool-label">{label}</span>
        <span className={`chat-message__tool-chevron ${expanded ? "chat-message__tool-chevron--open" : ""}`}>
          {"\u25B6"}
        </span>
      </button>
      {expanded && (
        <pre className="chat-message__tool-data">
          {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function formatStatus(status: string): string {
  switch (status) {
    case "Working": return "Agent is working...";
    case "NeedsInput": return "Agent needs input";
    case "Idle": return "Agent idle";
    case "Error": return "Agent error";
    case "Done": return "Agent finished";
    default: return status;
  }
}
