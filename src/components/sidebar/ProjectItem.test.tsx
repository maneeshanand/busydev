import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectItem } from "./ProjectItem";

describe("ProjectItem", () => {
  const defaultProps = {
    id: "proj-1",
    name: "busydev",
    repoPath: "/Users/me/busydev",
    workspaces: [],
    isSelected: false,
    selectedWorkspaceId: null,
    onSelectProject: vi.fn(),
    onSelectWorkspace: vi.fn(),
  };

  it("renders project name", () => {
    render(<ProjectItem {...defaultProps} />);
    expect(screen.getByText("busydev")).toBeInTheDocument();
  });

  it("renders workspace count", () => {
    render(<ProjectItem {...defaultProps} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("calls onSelectProject and expands on click", async () => {
    const onSelectProject = vi.fn();
    render(<ProjectItem {...defaultProps} onSelectProject={onSelectProject} />);
    await userEvent.click(screen.getByText("busydev"));
    expect(onSelectProject).toHaveBeenCalledWith("proj-1");
  });

  it("shows 'Add Workspace' button when expanded with empty list", async () => {
    render(<ProjectItem {...defaultProps} />);
    await userEvent.click(screen.getByText("busydev"));
    expect(screen.getByText("+ Add Workspace")).toBeInTheDocument();
  });

  it("renders workspace children when expanded", async () => {
    const workspaces = [
      {
        id: "ws-1",
        projectId: "proj-1",
        ticket: null,
        branch: "feat/auth",
        worktreePath: "/tmp/wt",
        agentAdapter: "claude",
        agentConfigJson: null,
        status: "Idle",
        createdAt: "2026-01-01",
      },
    ];
    render(<ProjectItem {...defaultProps} workspaces={workspaces} />);
    await userEvent.click(screen.getByText("busydev"));
    expect(screen.getByText("feat/auth")).toBeInTheDocument();
  });
});
