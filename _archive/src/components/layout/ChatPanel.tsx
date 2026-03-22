import { useWorkspaceStore } from "../../stores";
import { ChatStatusBar, MessageArea, ChatInput, useAgentStream } from "../chat";
import "./ChatPanel.css";

export function ChatPanel() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;

  const { events, isRunning, sendInput, stopSession } = useAgentStream(
    workspace?.worktreePath ?? null,
    workspace?.agentAdapter ?? null,
  );

  return (
    <div className="chat-panel">
      <ChatStatusBar workspace={workspace} />
      <MessageArea hasWorkspace={workspace !== null} events={events} />
      <ChatInput
        onSubmit={sendInput}
        onStop={stopSession}
        isRunning={isRunning}
        disabled={workspace === null}
      />
    </div>
  );
}
