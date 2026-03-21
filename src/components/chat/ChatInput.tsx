import { useCallback, useRef, useState } from "react";
import "./ChatInput.css";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  onStop: () => void;
  isRunning: boolean;
  disabled: boolean;
}

const MAX_ROWS = 6;

export function ChatInput({ onSubmit, onStop, isRunning, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * MAX_ROWS;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    adjustHeight();
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={`chat-input ${disabled ? "chat-input--disabled" : ""}`}>
      <button className="chat-input__attach" disabled={disabled} title="Attach file">
        {"\uD83D\uDCCE"}
      </button>
      <textarea
        ref={textareaRef}
        className="chat-input__textarea"
        placeholder={disabled ? "Select a workspace..." : "Type a message..."}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      {isRunning ? (
        <button className="chat-input__stop" onClick={onStop} title="Stop agent">
          Stop
        </button>
      ) : (
        <button
          className="chat-input__send"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          title="Send message"
        >
          Send
        </button>
      )}
    </div>
  );
}
