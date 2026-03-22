import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageArea } from "./MessageArea";
import type { ChatEvent } from "./useAgentStream";

describe("MessageArea", () => {
  it("shows path prompt when no target path", () => {
    render(<MessageArea hasTarget={false} events={[]} />);
    expect(screen.getByText("Set a local path to start chatting")).toBeInTheDocument();
  });

  it("shows no messages when target configured but empty", () => {
    render(<MessageArea hasTarget={true} events={[]} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("renders message events", () => {
    const events: ChatEvent[] = [
      {
        id: "1",
        source: "user",
        event: { type: "message", content: "Hello agent" },
        timestamp: Date.now(),
      },
      {
        id: "2",
        source: "agent",
        event: { type: "message", content: "Hello human" },
        timestamp: Date.now(),
      },
    ];
    render(<MessageArea hasTarget={true} events={events} />);
    expect(screen.getByText("Hello agent")).toBeInTheDocument();
    expect(screen.getByText("Hello human")).toBeInTheDocument();
  });
});
