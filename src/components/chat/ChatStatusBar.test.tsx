import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatStatusBar } from "./ChatStatusBar";
import { usePassthroughStore } from "../../stores";

describe("ChatStatusBar", () => {
  beforeEach(() => {
    usePassthroughStore.setState({
      adapter: "Codex",
      workspacePath: "",
    });
  });

  it("shows adapter selector", () => {
    render(<ChatStatusBar />);
    expect(screen.getByLabelText("Adapter")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Codex")).toBeInTheDocument();
  });

  it("shows path input", () => {
    render(<ChatStatusBar />);
    expect(screen.getByPlaceholderText("/absolute/path/to/repo")).toBeInTheDocument();
  });

  it("updates adapter in store", async () => {
    render(<ChatStatusBar />);
    await userEvent.selectOptions(screen.getByLabelText("Adapter"), "Claude Code");
    expect(usePassthroughStore.getState().adapter).toBe("Claude Code");
  });
});
