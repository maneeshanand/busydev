/**
 * Workflow: Workspace Status Updates
 *
 * Workspace status should be reflected in sidebar indicators,
 * chat status bar, and bottom status bar.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppLayout } from "../../components/layout/AppLayout";
import { useProjectStore, useWorkspaceStore } from "../../stores";
import { setupTauriMocks, resetMockDb, seedProject, seedWorkspace } from "../mockTauri";

describe("Workflow: Workspace Status Indicators", () => {
  beforeEach(() => {
    resetMockDb();
    const project = seedProject({ name: "busydev" });
    seedWorkspace(project.id, {
      ticket: "MAN-42",
      branch: "busydev/man-42",
      status: "Running",
      agentAdapter: "Claude Code",
    });
    seedWorkspace(project.id, {
      ticket: "MAN-43",
      branch: "busydev/man-43",
      status: "NeedsInput",
      agentAdapter: "codex",
    });
    setupTauriMocks();
    useProjectStore.setState({
      projects: [],
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
  });

  it("shows status indicators in sidebar for each workspace", async () => {
    render(<AppLayout />);

    // Open sidebar and expand project
    await userEvent.click(screen.getByTitle("projects"));
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));

    // Both workspaces should show with their status
    await waitFor(() => {
      expect(screen.getByText("MAN-42")).toBeInTheDocument();
      expect(screen.getByText("MAN-43")).toBeInTheDocument();
    });

    // Status indicators should be present
    expect(screen.getByTitle("Running")).toBeInTheDocument();
    expect(screen.getByTitle("NeedsInput")).toBeInTheDocument();
  });

  it("shows selected workspace status in chat status bar", async () => {
    render(<AppLayout />);

    // Select workspace
    await userEvent.click(screen.getByTitle("projects"));
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await waitFor(() => screen.getByText("MAN-42"));
    await userEvent.click(screen.getByText("MAN-42"));

    // Chat status bar should show workspace info
    await waitFor(() => {
      // Should show adapter name in the chat status bar
      const claudeElements = screen.getAllByText("Claude Code");
      expect(claudeElements.length).toBeGreaterThan(0);
    });
  });

  it("bottom status bar shows workspace info after selection", async () => {
    render(<AppLayout />);

    // Initially shows "No workspace selected" in the bottom bar
    const bottomBar = screen.getAllByText("No workspace selected");
    expect(bottomBar.length).toBeGreaterThan(0);

    // Select workspace
    await userEvent.click(screen.getByTitle("projects"));
    await waitFor(() => screen.getByText("busydev"));
    await userEvent.click(screen.getByText("busydev"));
    await waitFor(() => screen.getByText("MAN-42"));
    await userEvent.click(screen.getByText("MAN-42"));

    // Bottom status bar should update with workspace name
    await waitFor(() => {
      // MAN-42 should appear in both sidebar and status bar
      expect(screen.getAllByText("MAN-42").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("workspace count badge updates in project header", async () => {
    render(<AppLayout />);

    await userEvent.click(screen.getByTitle("projects"));
    await waitFor(() => screen.getByText("busydev"));

    // Should show "2" as workspace count
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
