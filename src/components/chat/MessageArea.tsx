import "./MessageArea.css";

interface MessageAreaProps {
  hasWorkspace: boolean;
}

export function MessageArea({ hasWorkspace }: MessageAreaProps) {
  return (
    <div className="message-area">
      <p className="message-area__empty">
        {hasWorkspace
          ? "No messages yet"
          : "Select a workspace to start chatting"}
      </p>
    </div>
  );
}
