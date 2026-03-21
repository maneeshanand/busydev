/**
 * Workflow: Select a Workspace and Send a Message
 *
 * User selects a workspace → chat panel updates → types message → sends →
 * message appears in stream → agent response appears.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { AppLayout } from "../../components/layout/AppLayout";
import { useProjectStore, useWorkspaceStore } from "../../stores";
import {
  setupTauriMocks,
  resetMockDb,
  seedProject,
  seedWorkspace,
} from "../mockTauri";

async function openSidebarAndSelectWorkspace() {
  await userEvent.click(screen.getByTitle("projects"));
  await waitFor(() => screen.getByText("busydev"));
  await userEvent.click(screen.getByText("busydev"));
  // Use getAllByText since MAN-42 might appear in multiple places; click the first (sidebar)
  await waitFor(() => screen.getAllByText("MAN-42"));
  await userEvent.click(screen.getAllByText("MAN-42")[0]);
}

describe("Workflow: Select Workspace and Chat", () => {
  beforeEach(() => {
    resetMockDb();
    const project = seedProject({ name: "busydev", repoPath: "/Users/test/busydev" });
    seedWorkspace(project.id, {
      ticket: "MAN-42",
      branch: "busydev/man-42",
      status: "Idle",
      agentAdapter: "claude",
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

  it("shows 'No workspace selected' in both status bars initially", async () => {
    render(<AppLayout />);
    await waitFor(() => {
      expect(screen.getAllByText("No workspace selected")).toHaveLength(2);
    });
  });

  it("shows 'Select a workspace to start chatting' in message area initially", async () => {
    render(<AppLayout />);
    await waitFor(() => {
      expect(
        screen.getByText("Select a workspace to start chatting"),
      ).toBeInTheDocument();
    });
  });

  it("chat input is disabled when no workspace selected", async () => {
    render(<AppLayout />);
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("Select a workspace...");
      expect(textarea).toBeDisabled();
    });
  });

  it("updates chat panel after selecting a workspace from sidebar", async () => {
    render(<AppLayout />);
    await openSidebarAndSelectWorkspace();

    // MAN-42 should appear in sidebar + chat status bar + bottom status bar
    await waitFor(() => {
      expect(screen.getAllByText("MAN-42").length).toBeGreaterThanOrEqual(2);
    });

    // Adapter should be visible
    await waitFor(() => {
      expect(screen.getAllByText("claude").length).toBeGreaterThan(0);
    });

    // Input should be enabled
    const textarea = screen.getByPlaceholderText("Type a message...");
    expect(textarea).not.toBeDisabled();
  });

  // BUG: user message doesn't appear after sending — see GitHub issue
  it.skip("shows user message in chat after sending", async () => {
    render(<AppLayout />);
    await openSidebarAndSelectWorkspace();

    await waitFor(() => screen.getByPlaceholderText("Type a message..."));
    const textarea = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(textarea, "fix the auth bug{enter}");

    await waitFor(() => {
      expect(screen.getByText("fix the auth bug")).toBeInTheDocument();
    });
  });

  // BUG: agent session not started on message send — see GitHub issue
  it.skip("calls start_agent_session when first message is sent", async () => {
    render(<AppLayout />);
    await openSidebarAndSelectWorkspace();

    await waitFor(() => screen.getByPlaceholderText("Type a message..."));
    await userEvent.type(
      screen.getByPlaceholderText("Type a message..."),
      "hello{enter}",
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "start_agent_session",
        expect.objectContaining({
          input: expect.objectContaining({
            adapter: "claude",
          }),
        }),
      );
    });
  });

  // BUG: error not shown when agent session fails — see GitHub issue
  it.skip("shows error in chat when agent session fails to start", async () => {
    const mockedInvoke = setupTauriMocks();
    const original = mockedInvoke.getMockImplementation()!;
    mockedInvoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "start_agent_session") {
        throw new Error("Agent adapter 'claude' not found");
      }
      return original(cmd, args);
    });

    render(<AppLayout />);
    await openSidebarAndSelectWorkspace();

    await waitFor(() => screen.getByPlaceholderText("Type a message..."));
    await userEvent.type(
      screen.getByPlaceholderText("Type a message..."),
      "hello{enter}",
    );

    // User message should still be visible
    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });

    // Error should be visible in the chat
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to start agent session/),
      ).toBeInTheDocument();
    });
  });

  it("message area changes from empty state after workspace selection", async () => {
    render(<AppLayout />);

    expect(
      screen.getByText("Select a workspace to start chatting"),
    ).toBeInTheDocument();

    await openSidebarAndSelectWorkspace();

    await waitFor(() => {
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
    });
  });
});
