/**
 * Workflow: Passthrough Status Indicators
 *
 * Adapter/path config is reflected in chat and bottom status bars.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppLayout } from "../../components/layout/AppLayout";
import { usePassthroughStore } from "../../stores";
import { setupTauriMocks, resetMockDb } from "../mockTauri";

describe("Workflow: Passthrough Status Indicators", () => {
  beforeEach(() => {
    resetMockDb();
    setupTauriMocks();
    usePassthroughStore.setState({
      adapter: "Codex",
      workspacePath: "",
    });
  });

  it("shows no path configured when empty", () => {
    render(<AppLayout />);
    expect(screen.getByText("No path configured")).toBeInTheDocument();
  });

  it("shows configured adapter and path in status bar", () => {
    usePassthroughStore.setState({
      adapter: "Claude Code",
      workspacePath: "/Users/test/busydev",
    });
    render(<AppLayout />);
    expect(screen.getAllByText("Claude Code").length).toBeGreaterThan(0);
    expect(screen.getByText("/Users/test/busydev")).toBeInTheDocument();
  });
});
