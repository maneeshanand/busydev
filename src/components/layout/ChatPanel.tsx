import { useCallback } from "react";
import { useWorkspaceStore } from "../../stores";
import { ChatStatusBar, MessageArea, ChatInput } from "../chat";
import "./ChatPanel.css";

export function ChatPanel() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;

  const handleSubmit = useCallback((message: string) => {
    console.log("[ChatPanel] submit:", message);
  }, []);

  const handleStop = useCallback(() => {
    console.log("[ChatPanel] stop");
  }, []);

  return (
    <div className="chat-panel">
      <ChatStatusBar workspace={workspace} />
      <MessageArea hasWorkspace={workspace !== null} />
      <ChatInput
        onSubmit={handleSubmit}
        onStop={handleStop}
        isRunning={false}
        disabled={workspace === null}
      />
    </div>
  );
}
