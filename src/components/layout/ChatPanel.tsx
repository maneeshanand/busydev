import { usePassthroughStore } from "../../stores";
import { ChatStatusBar, MessageArea, ChatInput, useAgentStream } from "../chat";
import "./ChatPanel.css";

export function ChatPanel() {
  const { adapter, workspacePath } = usePassthroughStore();
  const hasTarget = workspacePath.trim().length > 0;

  const { events, isRunning, sendInput, stopSession } = useAgentStream(
    hasTarget ? workspacePath : null,
    adapter,
  );

  return (
    <div className="chat-panel">
      <ChatStatusBar />
      <MessageArea hasTarget={hasTarget} events={events} />
      <ChatInput
        onSubmit={sendInput}
        onStop={stopSession}
        isRunning={isRunning}
        disabled={!hasTarget}
      />
    </div>
  );
}
