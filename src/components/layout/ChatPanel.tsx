import { useWorkspaceStore } from "../../stores";
import { ChatStatusBar, MessageArea, ChatInputPlaceholder } from "../chat";
import "./ChatPanel.css";

export function ChatPanel() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;

  return (
    <div className="chat-panel">
      <ChatStatusBar workspace={workspace} />
      <MessageArea hasWorkspace={workspace !== null} />
      <ChatInputPlaceholder />
    </div>
  );
}
