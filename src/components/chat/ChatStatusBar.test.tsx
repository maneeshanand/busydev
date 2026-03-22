import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatStatusBar } from "./ChatStatusBar";
import type { Workspace } from "../../stores";

const workspace: Workspace = {
  id: "ws-1",
  projectId: "proj-1",
  ticket: "MAN-42",
  branch: "feat/auth",
  worktreePath: "/tmp/wt",
  agentAdapter: "Claude Code",
  agentConfigJson: null,
  status: "Running",
  createdAt: "2026-01-01",
};

describe("ChatStatusBar", () => {
  it("shows 'No workspace selected' when workspace is null", () => {
    render(<ChatStatusBar workspace={null} />);
    expect(screen.getByText("No workspace selected")).toBeInTheDocument();
  });

  it("shows ticket when workspace has one", () => {
    render(<ChatStatusBar workspace={workspace} />);
    expect(screen.getByText("MAN-42")).toBeInTheDocument();
  });

  it("shows branch when no ticket", () => {
    const ws = { ...workspace, ticket: null };
    render(<ChatStatusBar workspace={ws} />);
    expect(screen.getByText("feat/auth")).toBeInTheDocument();
  });

  it("shows adapter selector", () => {
    render(<ChatStatusBar workspace={workspace} />);
    expect(screen.getByLabelText("Adapter")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Claude Code")).toBeInTheDocument();
  });

  it("shows status indicator", () => {
    render(<ChatStatusBar workspace={workspace} />);
    expect(screen.getByTitle("Running")).toBeInTheDocument();
  });
});
