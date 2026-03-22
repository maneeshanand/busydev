import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { __resetAgentStreamSnapshotsForTests, useAgentStream } from "./useAgentStream";

const mockInvoke = vi.mocked(invoke);

function installAgentMocks() {
  mockInvoke.mockImplementation((command: string) => {
    if (command === "start_agent_session") {
      return Promise.resolve({
        id: "session-1",
        adapter: "codex",
        workspacePath: "/tmp/ws",
        status: "Working",
        startedAtMs: Date.now(),
      });
    }

    if (command === "send_agent_input") {
      return Promise.resolve(undefined);
    }

    if (command === "stream_agent_events") {
      return Promise.resolve({
        session: {
          id: "session-1",
          adapter: "codex",
          workspacePath: "/tmp/ws",
          status: "NeedsInput",
          startedAtMs: Date.now(),
        },
        events: [],
        nextSeq: 0,
        usage: null,
      });
    }

    return Promise.resolve(undefined);
  });
}

describe("useAgentStream", () => {
  beforeEach(() => {
    __resetAgentStreamSnapshotsForTests();
    vi.clearAllMocks();
    installAgentMocks();
  });

  it("keeps first user message when workspace is selected then message is sent", async () => {
    const { result, rerender } = renderHook(
      ({ path }) => useAgentStream(path, "codex"),
      { initialProps: { path: null as string | null } },
    );

    rerender({ path: "/tmp/ws" });

    await act(async () => {
      await result.current.sendInput("hello");
    });

    expect(result.current.events.some((e) => e.source === "user" && e.event.content === "hello")).toBe(true);
  });

  it("restores chat events after remount for the same workspace", async () => {
    const first = renderHook(() => useAgentStream("/tmp/ws", "codex"));

    await act(async () => {
      await first.result.current.sendInput("persist me");
    });

    first.unmount();

    const second = renderHook(() => useAgentStream("/tmp/ws", "codex"));

    expect(
      second.result.current.events.some(
        (e) => e.source === "user" && e.event.content === "persist me",
      ),
    ).toBe(true);
  });
});
