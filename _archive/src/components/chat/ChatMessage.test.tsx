import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatMessage } from "./ChatMessage";
import type { ChatEvent } from "./useAgentStream";

describe("ChatMessage", () => {
  it("renders user message bubble", () => {
    const event: ChatEvent = {
      id: "1",
      source: "user",
      event: { type: "message", content: "Hello" },
      timestamp: Date.now(),
    };
    const { container } = render(<ChatMessage event={event} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(container.querySelector(".chat-message--user")).toBeInTheDocument();
  });

  it("renders agent message bubble", () => {
    const event: ChatEvent = {
      id: "2",
      source: "agent",
      event: { type: "message", content: "Hi there" },
      timestamp: Date.now(),
    };
    const { container } = render(<ChatMessage event={event} />);
    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(container.querySelector(".chat-message--agent")).toBeInTheDocument();
  });

  it("renders error message", () => {
    const event: ChatEvent = {
      id: "3",
      source: "agent",
      event: { type: "error", message: "Something failed" },
      timestamp: Date.now(),
    };
    const { container } = render(<ChatMessage event={event} />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
    expect(container.querySelector(".chat-message--error")).toBeInTheDocument();
  });

  it("renders status pill", () => {
    const event: ChatEvent = {
      id: "4",
      source: "agent",
      event: { type: "status", status: "Working" },
      timestamp: Date.now(),
    };
    render(<ChatMessage event={event} />);
    expect(screen.getByText("Agent is working...")).toBeInTheDocument();
  });

  it("renders tool call as expandable card", async () => {
    const event: ChatEvent = {
      id: "5",
      source: "agent",
      event: { type: "toolCall", name: "read_file", input: { path: "/tmp/test" } },
      timestamp: Date.now(),
    };
    render(<ChatMessage event={event} />);
    expect(screen.getByText("Using read_file")).toBeInTheDocument();

    // Expand to see input
    await userEvent.click(screen.getByText("Using read_file"));
    expect(screen.getByText(/\/tmp\/test/)).toBeInTheDocument();
  });

  it("renders tool result as expandable card", async () => {
    const event: ChatEvent = {
      id: "6",
      source: "agent",
      event: { type: "toolResult", name: "read_file", output: "file contents" },
      timestamp: Date.now(),
    };
    render(<ChatMessage event={event} />);
    expect(screen.getByText("read_file result")).toBeInTheDocument();

    await userEvent.click(screen.getByText("read_file result"));
    expect(screen.getByText("file contents")).toBeInTheDocument();
  });
});
