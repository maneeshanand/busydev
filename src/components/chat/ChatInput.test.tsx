import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "./ChatInput";

describe("ChatInput", () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onStop: vi.fn(),
    isRunning: false,
    disabled: false,
  };

  it("renders textarea with placeholder", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
  });

  it("renders disabled placeholder when disabled", () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    expect(screen.getByPlaceholderText("Set a local path...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Set a local path...")).toBeDisabled();
  });

  it("shows Send button when not running", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByTitle("Send message")).toBeInTheDocument();
  });

  it("shows Stop button when running", () => {
    render(<ChatInput {...defaultProps} isRunning={true} />);
    expect(screen.getByTitle("Stop agent")).toBeInTheDocument();
  });

  it("Send button is disabled when textarea is empty", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByTitle("Send message")).toBeDisabled();
  });

  it("calls onSubmit and clears textarea on Enter", async () => {
    const onSubmit = vi.fn();
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(textarea, "hello{enter}");

    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(textarea).toHaveValue("");
  });

  it("does not submit on Shift+Enter", async () => {
    const onSubmit = vi.fn();
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(textarea, "line1{shift>}{enter}{/shift}line2");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onStop when Stop button clicked", async () => {
    const onStop = vi.fn();
    render(<ChatInput {...defaultProps} onStop={onStop} isRunning={true} />);
    await userEvent.click(screen.getByTitle("Stop agent"));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("renders attach button", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByTitle("Attach file")).toBeInTheDocument();
  });
});
