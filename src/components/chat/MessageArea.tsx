import { useEffect, useRef } from "react";
import type { ChatEvent } from "./useAgentStream";
import { ChatMessage } from "./ChatMessage";
import "./MessageArea.css";

interface MessageAreaProps {
  hasTarget: boolean;
  events: ChatEvent[];
}

export function MessageArea({ hasTarget, events }: MessageAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  if (!hasTarget) {
    return (
      <div className="message-area message-area--empty">
        <p className="message-area__placeholder">Set a local path to start chatting</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="message-area message-area--empty">
        <p className="message-area__placeholder">No messages yet</p>
      </div>
    );
  }

  return (
    <div className="message-area" ref={scrollRef}>
      <div className="message-area__list">
        {events.map((event) => (
          <ChatMessage key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
