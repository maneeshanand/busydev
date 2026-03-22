/**
 * Workflow: Configure path and send a message.
 *
 * User sets a path + adapter in passthrough mode, sends a message,
 * and the app starts an agent session.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { AppLayout } from "../../components/layout/AppLayout";
import { usePassthroughStore } from "../../stores";
import { setupTauriMocks, resetMockDb } from "../mockTauri";
import { __resetAgentStreamSnapshotsForTests } from "../../components/chat/useAgentStream";

describe("Workflow: Configure Path and Chat", () => {
  beforeEach(() => {
    __resetAgentStreamSnapshotsForTests();
    resetMockDb();
    setupTauriMocks();
    usePassthroughStore.setState({
      adapter: "Codex",
      workspacePath: "",
    });
  });

  it("shows path prompt when no path is configured", async () => {
    render(<AppLayout />);
    await waitFor(() => {
      expect(screen.getByText("Set a local path to start chatting")).toBeInTheDocument();
    });
  });

  it("chat input is disabled when no path is configured", async () => {
    render(<AppLayout />);
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("Set a local path...");
      expect(textarea).toBeDisabled();
    });
  });

  it("calls start_agent_session when first message is sent", async () => {
    usePassthroughStore.setState({
      adapter: "Claude Code",
      workspacePath: "/Users/test/busydev",
    });
    render(<AppLayout />);

    await waitFor(() => screen.getByPlaceholderText("Type a message..."));
    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "hello" },
    });
    await userEvent.click(screen.getByTitle("Send message"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "start_agent_session",
        expect.objectContaining({
          input: expect.objectContaining({
            adapter: "Claude Code",
            workspacePath: "/Users/test/busydev",
          }),
        }),
      );
    });
  });
});
