import "./ChatInputPlaceholder.css";

export function ChatInputPlaceholder() {
  return (
    <div className="chat-input-placeholder">
      <textarea
        className="chat-input-placeholder__textarea"
        placeholder="Type a message..."
        disabled
        rows={2}
      />
      <button className="chat-input-placeholder__send" disabled>
        Send
      </button>
    </div>
  );
}
