import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageArea } from "./MessageArea";
import type { ChatEvent } from "./useAgentStream";

describe("MessageArea", () => {
  it("shows workspace prompt when no workspace", () => {
    render(<MessageArea hasWorkspace={false} events={[]} />);
    expect(screen.getByText("Select a workspace to start chatting")).toBeInTheDocument();
  });

  it("shows no messages when workspace selected but empty", () => {
    render(<MessageArea hasWorkspace={true} events={[]} />);
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
    render(<MessageArea hasWorkspace={true} events={events} />);
    expect(screen.getByText("Hello agent")).toBeInTheDocument();
    expect(screen.getByText("Hello human")).toBeInTheDocument();
  });
});
