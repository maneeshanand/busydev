import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceItem } from "./WorkspaceItem";
import type { Workspace } from "../../stores";

const baseWorkspace: Workspace = {
  id: "ws-1",
  projectId: "proj-1",
  ticket: null,
  branch: "feat/auth",
  worktreePath: "/tmp/wt",
  agentAdapter: "claude",
  agentConfigJson: null,
  status: "Idle",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("WorkspaceItem", () => {
  it("renders branch name when no ticket", () => {
    render(<WorkspaceItem workspace={baseWorkspace} isSelected={false} onSelect={vi.fn()} />);
    expect(screen.getByText("feat/auth")).toBeInTheDocument();
  });

  it("renders ticket when present", () => {
    const ws = { ...baseWorkspace, ticket: "MAN-42" };
    render(<WorkspaceItem workspace={ws} isSelected={false} onSelect={vi.fn()} />);
    expect(screen.getByText("MAN-42")).toBeInTheDocument();
  });

  it("renders agent adapter", () => {
    render(<WorkspaceItem workspace={baseWorkspace} isSelected={false} onSelect={vi.fn()} />);
    expect(screen.getByText("claude")).toBeInTheDocument();
  });

  it("applies selected class", () => {
    const { container } = render(
      <WorkspaceItem workspace={baseWorkspace} isSelected={true} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".workspace-item--selected")).toBeInTheDocument();
  });

  it("calls onSelect with workspace and project id on click", async () => {
    const onSelect = vi.fn();
    render(<WorkspaceItem workspace={baseWorkspace} isSelected={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("ws-1", "proj-1");
  });
});
