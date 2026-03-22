/**
 * Workflow: Add a Workspace to a Project
 *
 * User expands a project → clicks "+ Add Workspace" → enters optional ticket →
 * workspace appears under the project with correct defaults.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectTree } from "../../components/sidebar/ProjectTree";
import { useProjectStore, useWorkspaceStore, useSettingsStore } from "../../stores";
import { setupTauriMocks, resetMockDb, seedProject } from "../mockTauri";

describe("Workflow: Add a Workspace", () => {
  beforeEach(() => {
    resetMockDb();
    const project = seedProject({ name: "busydev", repoPath: "/Users/test/busydev" });
    setupTauriMocks();
    useProjectStore.setState({
      projects: [project],
      selectedProjectId: null,
      isLoading: false,
      error: null,
    });
    useWorkspaceStore.setState({
      workspaces: [],
      selectedWorkspaceId: null,
      isLoading: false,
      error: null,
    });
    useSettingsStore.setState({ defaultAdapter: "Claude Code" });
  });

  it("shows + Add Workspace button when project is expanded", async () => {
    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));

    // Expand project
    await userEvent.click(screen.getByText("busydev"));

    expect(screen.getByText("+ Add Workspace")).toBeInTheDocument();
  });

  it("shows workspace form when Add Workspace is clicked", async () => {
    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await userEvent.click(screen.getByText("+ Add Workspace"));

    expect(
      screen.getByPlaceholderText("Ticket or description (optional)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("creates workspace with auto-generated branch when submitted with ticket", async () => {
    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await userEvent.click(screen.getByText("+ Add Workspace"));

    const input = screen.getByPlaceholderText("Ticket or description (optional)");
    await userEvent.type(input, "MAN-42");
    await userEvent.click(screen.getByText("Create"));

    // Workspace should appear in the tree
    await waitFor(() => {
      expect(screen.getByText("MAN-42")).toBeInTheDocument();
    });

    // Store should have the workspace with auto-generated values
    const ws = useWorkspaceStore.getState().workspaces[0];
    expect(ws).toBeDefined();
    expect(ws.branch).toBe("busydev/man-42");
    expect(ws.worktreePath).toBe("/Users/test/busydev/.worktrees/man-42");
    expect(ws.agentAdapter).toBe("Claude Code");
    expect(ws.ticket).toBe("MAN-42");
  });

  it("creates workspace with timestamp name when submitted without ticket", async () => {
    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await userEvent.click(screen.getByText("+ Add Workspace"));

    // Submit with empty ticket
    await userEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      const ws = useWorkspaceStore.getState().workspaces;
      expect(ws).toHaveLength(1);
    });

    const ws = useWorkspaceStore.getState().workspaces[0];
    expect(ws.branch).toMatch(/^busydev\/ws-\d+$/);
    expect(ws.ticket).toBeNull();
  });

  it("uses default adapter from settings store", async () => {
    useSettingsStore.setState({ defaultAdapter: "codex" });

    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await userEvent.click(screen.getByText("+ Add Workspace"));
    await userEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
    });

    expect(useWorkspaceStore.getState().workspaces[0].agentAdapter).toBe("codex");
  });

  it("hides form after successful creation", async () => {
    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await userEvent.click(screen.getByText("+ Add Workspace"));
    await userEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(screen.getByText("+ Add Workspace")).toBeInTheDocument();
    });
  });

  it("Cancel hides the form without creating", async () => {
    render(<ProjectTree />);
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await userEvent.click(screen.getByText("+ Add Workspace"));
    await userEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText("+ Add Workspace")).toBeInTheDocument();
    expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
  });
});
