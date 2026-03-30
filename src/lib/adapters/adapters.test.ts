import { describe, expect, it } from "vitest";
import type { CodexStreamEvent } from "../../invoke";
import { getAdapter, formatAgentLabel } from "./index";
import {
  cleanCommand,
  shortenPath,
  formatToolSummary,
  isNoisyInfraOutput,
} from "./shared";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function evt(parsedJson: unknown): CodexStreamEvent {
  return { runId: "r1", kind: "stdout", parsedJson };
}

// ---------------------------------------------------------------------------
// 1. getAdapter
// ---------------------------------------------------------------------------
describe("getAdapter", () => {
  it("returns claude adapter for 'claude'", () => {
    const adapter = getAdapter("claude");
    expect(adapter).toBeDefined();
    expect(typeof adapter.classifyEvent).toBe("function");
  });

  it("returns codex adapter for 'codex'", () => {
    const adapter = getAdapter("codex");
    expect(adapter).toBeDefined();
    expect(typeof adapter.classifyEvent).toBe("function");
  });

  it("returns gemini adapter for 'gemini'", () => {
    const adapter = getAdapter("gemini");
    expect(adapter).toBeDefined();
    expect(typeof adapter.classifyEvent).toBe("function");
  });

  it("returns deepseek adapter for 'deepseek'", () => {
    const adapter = getAdapter("deepseek");
    expect(adapter).toBeDefined();
    expect(typeof adapter.classifyEvent).toBe("function");
  });

  it("defaults to codex for unknown agent", () => {
    const fallback = getAdapter("unknown-agent");
    const codex = getAdapter("codex");
    expect(fallback).toBe(codex);
  });

  it("defaults to codex when agent is undefined", () => {
    const fallback = getAdapter(undefined);
    const codex = getAdapter("codex");
    expect(fallback).toBe(codex);
  });
});

// ---------------------------------------------------------------------------
// 2. formatAgentLabel
// ---------------------------------------------------------------------------
describe("formatAgentLabel", () => {
  it("returns 'Claude' for claude", () => {
    expect(formatAgentLabel("claude")).toBe("Claude");
  });

  it("returns 'DeepSeek' for deepseek", () => {
    expect(formatAgentLabel("deepseek")).toBe("DeepSeek");
  });

  it("returns 'Gemini' for gemini", () => {
    expect(formatAgentLabel("gemini")).toBe("Gemini");
  });

  it("returns 'Codex' for codex", () => {
    expect(formatAgentLabel("codex")).toBe("Codex");
  });

  it("returns 'Codex' for unknown agent", () => {
    expect(formatAgentLabel("gpt")).toBe("Codex");
  });

  it("returns 'Codex' when agent is undefined", () => {
    expect(formatAgentLabel(undefined)).toBe("Codex");
  });
});

// ---------------------------------------------------------------------------
// 3. Shared helpers
// ---------------------------------------------------------------------------
describe("cleanCommand", () => {
  it("strips /bin/zsh -lc '...' wrapper", () => {
    expect(cleanCommand("/bin/zsh -lc 'npm run build'")).toBe("npm run build");
  });

  it("strips /bin/bash -c '...' wrapper", () => {
    expect(cleanCommand("/bin/bash -c 'echo hello'")).toBe("echo hello");
  });

  it("strips /bin/sh -c wrapper with double quotes", () => {
    expect(cleanCommand('/bin/sh -c "ls -la"')).toBe("ls -la");
  });

  it("returns raw string if no shell wrapper", () => {
    expect(cleanCommand("git status")).toBe("git status");
  });
});

describe("shortenPath", () => {
  it("returns last 2 segments for long paths", () => {
    expect(shortenPath("/a/b/c/d/file.ts")).toBe("d/file.ts");
  });

  it("returns path unchanged when 2 or fewer segments", () => {
    expect(shortenPath("src/file.ts")).toBe("src/file.ts");
  });

  it("handles single segment", () => {
    expect(shortenPath("file.ts")).toBe("file.ts");
  });
});

describe("formatToolSummary", () => {
  it("formats Claude Read tool", () => {
    expect(formatToolSummary({ name: "Read", filePath: "/a/b/c/file.ts" })).toBe("Read c/file.ts");
  });

  it("formats Claude Edit tool", () => {
    expect(formatToolSummary({ name: "Edit", filePath: "/a/b/c/file.ts" })).toBe("Edit c/file.ts");
  });

  it("formats Claude Write tool", () => {
    expect(formatToolSummary({ name: "Write", filePath: "/a/b/c/file.ts" })).toBe("Write c/file.ts");
  });

  it("formats Claude Bash tool, stripping shell wrapper", () => {
    const result = formatToolSummary({ name: "Bash", command: "/bin/zsh -lc 'cargo test'" });
    expect(result).toBe("cargo test");
  });

  it("formats Claude Glob tool", () => {
    expect(formatToolSummary({ name: "Glob", pattern: "**/*.ts" })).toBe("Glob **/*.ts");
  });

  it("formats Claude Grep tool", () => {
    expect(formatToolSummary({ name: "Grep", pattern: "TODO" })).toBe("Grep TODO");
  });

  it("formats Claude WebSearch tool", () => {
    expect(formatToolSummary({ name: "WebSearch", query: "rust async" })).toBe("Search: rust async");
  });

  it("formats Claude WebFetch tool", () => {
    expect(formatToolSummary({ name: "WebFetch", url: "https://example.com" })).toBe(
      "Fetch https://example.com"
    );
  });

  it("formats Gemini read_file tool", () => {
    expect(formatToolSummary({ name: "read_file", filePath: "/a/b/README.md" })).toBe(
      "Read b/README.md"
    );
  });

  it("formats Gemini shell tool", () => {
    const result = formatToolSummary({ name: "shell", command: "npm install" });
    expect(result).toBe("npm install");
  });

  it("formats Gemini list_directory tool with dirPath", () => {
    expect(formatToolSummary({ name: "list_directory", dirPath: "/a/b/src" })).toBe("ls b/src");
  });

  it("formats Gemini ls tool without dirPath", () => {
    expect(formatToolSummary({ name: "ls" })).toBe("ls .");
  });

  it("falls back to tool name for unknown tool", () => {
    expect(formatToolSummary({ name: "unknown_tool" })).toBe("unknown_tool");
  });
});

describe("isNoisyInfraOutput", () => {
  it("returns true for rmcp transport noise", () => {
    expect(isNoisyInfraOutput("rmcp::transport::worker error")).toBe(true);
  });

  it("returns true for transport channel closed", () => {
    expect(isNoisyInfraOutput("transport channel closed")).toBe(true);
  });

  it("returns true for cloudflare", () => {
    expect(isNoisyInfraOutput("cloudflare error page")).toBe(true);
  });

  it("returns true for <!doctype html>", () => {
    expect(isNoisyInfraOutput("<!doctype html>")).toBe(true);
  });

  it("returns true for yolo mode message", () => {
    expect(isNoisyInfraOutput("yolo mode is enabled")).toBe(true);
  });

  it("returns false for normal output", () => {
    expect(isNoisyInfraOutput("Running tests...")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isNoisyInfraOutput("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Claude adapter
// ---------------------------------------------------------------------------
describe("Claude adapter", () => {
  const adapter = getAdapter("claude");

  describe("classifyEvent", () => {
    it("classifies assistant text block as message", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Hello from Claude" }],
          },
        })
      );
      expect(row.category).toBe("message");
      expect(row.text).toBe("Hello from Claude");
    });

    it("classifies assistant tool_use as running command", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                name: "Read",
                input: { file_path: "/a/b/c/file.ts" },
              },
            ],
          },
        })
      );
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("running");
    });

    it("classifies control_request can_use_tool as approval", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "control_request",
          request_id: "req-1",
          request: {
            subtype: "can_use_tool",
            tool_name: "Bash",
            input: { command: "rm -rf /tmp/test" },
          },
        })
      );
      expect(row.category).toBe("approval");
      expect((row as { approvalState: string }).approvalState).toBe("pending");
    });

    it("classifies result with cost as status", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "result",
          total_cost_usd: 0.0123,
          num_turns: 5,
        })
      );
      expect(row.category).toBe("status");
      expect(row.text).toContain("$0.0123");
      expect(row.text).toContain("5 turns");
    });

    it("classifies system type as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "system" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });

    it("classifies user with tool_use_result as done command", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "user",
          tool_use_result: { tool_use_id: "tool-1", content: "success" },
        })
      );
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("done");
    });

    it("classifies user without tool_use_result as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "user" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });
  });

  describe("extractTextChunk", () => {
    it("returns text from assistant text block", () => {
      const chunk = adapter.extractTextChunk(
        evt({
          type: "assistant",
          message: {
            content: [{ type: "text", text: "streaming text" }],
          },
        })
      );
      expect(chunk).toBe("streaming text");
    });

    it("returns null for assistant tool_use block", () => {
      const chunk = adapter.extractTextChunk(
        evt({
          type: "assistant",
          message: {
            content: [{ type: "tool_use", name: "Read", input: {} }],
          },
        })
      );
      expect(chunk).toBeNull();
    });

    it("returns null for non-assistant events", () => {
      expect(adapter.extractTextChunk(evt({ type: "system" }))).toBeNull();
    });
  });

  describe("extractLastMessage", () => {
    it("returns last text from array of events", () => {
      const events = [
        { type: "assistant", message: { content: [{ type: "text", text: "First message" }] } },
        { type: "system" },
        { type: "assistant", message: { content: [{ type: "text", text: "Last message" }] } },
      ];
      expect(adapter.extractLastMessage(events)).toBe("Last message");
    });

    it("returns null for empty array", () => {
      expect(adapter.extractLastMessage([])).toBeNull();
    });

    it("returns null for non-array input", () => {
      expect(adapter.extractLastMessage(null)).toBeNull();
      expect(adapter.extractLastMessage("not an array")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Codex adapter
// ---------------------------------------------------------------------------
describe("Codex adapter", () => {
  const adapter = getAdapter("codex");

  describe("classifyEvent", () => {
    it("classifies agent_message as message", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "item.created",
          item: { type: "agent_message", text: "I am done with the task." },
        })
      );
      expect(row.category).toBe("message");
      expect(row.text).toBe("I am done with the task.");
    });

    it("classifies command_execution in_progress as running", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "item.created",
          item: { type: "command_execution", command: "npm test", status: "in_progress" },
        })
      );
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("running");
    });

    it("classifies command_execution completed with exit_code 1 as failed", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "item.created",
          item: {
            type: "command_execution",
            command: "npm test",
            status: "completed",
            exit_code: 1,
          },
        })
      );
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("failed");
    });

    it("classifies command_execution completed with exit_code 0 as done", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "item.created",
          item: {
            type: "command_execution",
            command: "npm test",
            status: "completed",
            exit_code: 0,
          },
        })
      );
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("done");
    });

    it("classifies file_change as file_change", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "item.created",
          item: {
            type: "file_change",
            changes: [{ path: "/a/b/src/index.ts" }, { path: "/a/b/src/utils.ts" }],
          },
        })
      );
      expect(row.category).toBe("file_change");
    });

    it("classifies thread.started as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "thread.started" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });

    it("classifies turn.started as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "turn.started" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });

    it("classifies turn.completed as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "turn.completed" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });
  });

  describe("extractTextChunk", () => {
    it("always returns null", () => {
      expect(
        adapter.extractTextChunk(
          evt({ type: "item.created", item: { type: "agent_message", text: "hello" } })
        )
      ).toBeNull();
    });
  });

  describe("extractLastMessage", () => {
    it("returns last agent_message text", () => {
      const events = [
        { type: "item.created", item: { type: "agent_message", text: "First" } },
        { type: "turn.completed" },
        { type: "item.created", item: { type: "agent_message", text: "Last" } },
      ];
      expect(adapter.extractLastMessage(events)).toBe("Last");
    });

    it("returns null for empty array", () => {
      expect(adapter.extractLastMessage([])).toBeNull();
    });

    it("returns null for non-array input", () => {
      expect(adapter.extractLastMessage({})).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Gemini adapter
// ---------------------------------------------------------------------------
describe("Gemini adapter", () => {
  const adapter = getAdapter("gemini");

  describe("classifyEvent", () => {
    it("classifies init as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "init" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });

    it("classifies user message as hidden", () => {
      const row = adapter.classifyEvent(evt({ type: "message", role: "user", content: "hello" }));
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });

    it("classifies assistant message as message", () => {
      const row = adapter.classifyEvent(
        evt({ type: "message", role: "assistant", content: "Here is my response." })
      );
      expect(row.category).toBe("message");
      expect(row.text).toBe("Here is my response.");
    });

    it("classifies empty assistant message as hidden", () => {
      const row = adapter.classifyEvent(
        evt({ type: "message", role: "assistant", content: "" })
      );
      expect(row.category).toBe("status");
      expect(row.hidden).toBe(true);
    });

    it("classifies tool_use read_file as running with 'Read README.md'", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "tool_use",
          tool_name: "read_file",
          parameters: { file_path: "/a/b/c/README.md" },
        })
      );
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("running");
      expect(row.text).toBe("Read c/README.md");
    });

    it("classifies tool_result as done", () => {
      const row = adapter.classifyEvent(evt({ type: "tool_result" }));
      expect(row.category).toBe("command");
      expect((row as { status: string }).status).toBe("done");
    });

    it("classifies result with stats as status with tokens/duration/tool_calls", () => {
      const row = adapter.classifyEvent(
        evt({
          type: "result",
          stats: { tool_calls: 3, total_tokens: 1500, duration_ms: 5000 },
        })
      );
      expect(row.category).toBe("status");
      expect(row.text).toContain("3 tool calls");
      expect(row.text).toContain("1500 tokens");
      expect(row.text).toContain("5.0s");
    });

    it("classifies result with no stats as 'Done'", () => {
      const row = adapter.classifyEvent(evt({ type: "result" }));
      expect(row.category).toBe("status");
      expect(row.text).toBe("Done");
    });
  });

  describe("extractTextChunk", () => {
    it("returns text from delta:true assistant message", () => {
      const chunk = adapter.extractTextChunk(
        evt({ type: "message", role: "assistant", content: "delta chunk", delta: true })
      );
      expect(chunk).toBe("delta chunk");
    });

    it("returns text for non-delta assistant message", () => {
      const chunk = adapter.extractTextChunk(
        evt({ type: "message", role: "assistant", content: "full message" })
      );
      expect(chunk).toBe("full message");
    });

    it("returns null for non-assistant events", () => {
      expect(adapter.extractTextChunk(evt({ type: "tool_use" }))).toBeNull();
    });
  });

  describe("extractLastMessage", () => {
    it("returns last assistant message content", () => {
      const events = [
        { type: "message", role: "user", content: "hello" },
        { type: "message", role: "assistant", content: "First response" },
        { type: "tool_use", tool_name: "read_file" },
        { type: "message", role: "assistant", content: "Final response" },
      ];
      expect(adapter.extractLastMessage(events)).toBe("Final response");
    });

    it("returns null for empty array", () => {
      expect(adapter.extractLastMessage([])).toBeNull();
    });

    it("returns null for non-array input", () => {
      expect(adapter.extractLastMessage(null)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 7. DeepSeek adapter — uses codex format
// ---------------------------------------------------------------------------
describe("DeepSeek adapter", () => {
  const adapter = getAdapter("deepseek");

  it("classifies agent_message as message (same as codex)", () => {
    const row = adapter.classifyEvent(
      evt({
        type: "item.created",
        item: { type: "agent_message", text: "DeepSeek response" },
      })
    );
    expect(row.category).toBe("message");
    expect(row.text).toBe("DeepSeek response");
  });

  it("extractLastMessage works like codex", () => {
    const events = [
      { type: "item.created", item: { type: "agent_message", text: "DeepSeek last message" } },
    ];
    expect(adapter.extractLastMessage(events)).toBe("DeepSeek last message");
  });
});

// ---------------------------------------------------------------------------
// 8. Lifecycle events — all adapters
// ---------------------------------------------------------------------------
describe("Lifecycle events (all adapters)", () => {
  const agents = ["claude", "codex", "gemini", "deepseek"] as const;

  for (const agent of agents) {
    describe(`${agent} adapter`, () => {
      const adapter = getAdapter(agent);

      it("completed → hidden", () => {
        const row = adapter.classifyEvent({ runId: "r1", kind: "completed" });
        expect(row.category).toBe("status");
        expect(row.hidden).toBe(true);
      });

      it("stderr → error", () => {
        const row = adapter.classifyEvent({
          runId: "r1",
          kind: "stderr",
          line: "Some error message",
        });
        expect(row.category).toBe("error");
        expect(row.text).toBe("Some error message");
      });

      it("noisy stderr → hidden", () => {
        const row = adapter.classifyEvent({
          runId: "r1",
          kind: "stderr",
          line: "rmcp::transport::worker encountered an issue",
        });
        expect(row.category).toBe("status");
        expect(row.hidden).toBe(true);
      });

      it("spawn_error → error", () => {
        const row = adapter.classifyEvent({
          runId: "r1",
          kind: "spawn_error",
          line: "Failed to spawn process",
        });
        expect(row.category).toBe("error");
        expect(row.text).toBe("Failed to spawn process");
      });
    });
  }
});
