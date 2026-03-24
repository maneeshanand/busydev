import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CodexExecOutput, CodexStreamEvent } from "../invoke";
import type { TodoItem } from "../types";
import {
  buildTodoPrompt,
  classifyEvent,
  cleanCommand,
  formatInline,
  formatMessage,
  formatTimestamp,
  highlightText,
  parseTodoAdditions,
  parseTodoCompletions,
  shouldRenderFinalSummary,
  stripTodoMarkers,
} from "./frontendUtils";

function renderNode(node: React.ReactNode): string {
  return renderToStaticMarkup(<>{node}</>);
}

function makeOutput(parsedJson: unknown): CodexExecOutput {
  return {
    stdoutRaw: "",
    stderrRaw: "",
    parsedJson,
    exitCode: 0,
    durationMs: 1,
  };
}

describe("cleanCommand", () => {
  it("strips shell wrapper", () => {
    expect(cleanCommand("/bin/zsh -lc 'echo hello'")).toBe("echo hello");
  });

  it("returns raw if no wrapper", () => {
    expect(cleanCommand("npm run test")).toBe("npm run test");
  });
});

describe("stripTodoMarkers", () => {
  it("removes DONE and ADD_TODO marker lines", () => {
    const input = "Working\nDONE: 1\nADD_TODO: write tests\nThanks";
    expect(stripTodoMarkers(input)).toBe("Working\n\n\nThanks".trim());
  });
});

describe("formatTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns only time for same day", () => {
    const out = formatTimestamp(new Date("2026-03-23T08:15:00Z").getTime());
    expect(out).not.toContain(",");
  });

  it("returns date and time for previous day", () => {
    const out = formatTimestamp(new Date("2026-03-22T08:15:00Z").getTime());
    expect(out).toContain(",");
  });
});

describe("classifyEvent", () => {
  it("maps codex command in progress", () => {
    const event: CodexStreamEvent = {
      runId: "r1",
      kind: "stdout",
      parsedJson: {
        item: {
          type: "command_execution",
          command: "/bin/zsh -lc 'ls -la'",
          status: "in_progress",
        },
      },
    };

    const row = classifyEvent(event);
    expect(row.category).toBe("command");
    expect(row.command).toBe("ls -la");
    expect(row.status).toBe("running");
  });

  it("maps claude control_request to approval", () => {
    const event: CodexStreamEvent = {
      runId: "r1",
      kind: "stdout",
      parsedJson: {
        type: "control_request",
        request_id: "req_1",
        request: {
          subtype: "can_use_tool",
          tool_name: "Bash",
          input: { command: "echo hi" },
        },
      },
    };

    const row = classifyEvent(event);
    expect(row.category).toBe("approval");
    expect(row.requestId).toBe("req_1");
    expect(row.approvalState).toBe("pending");
  });

  it("maps stderr to error", () => {
    const event: CodexStreamEvent = { runId: "r1", kind: "stderr", line: "boom" };
    const row = classifyEvent(event);
    expect(row.category).toBe("error");
    expect(row.text).toBe("boom");
  });
});

describe("buildTodoPrompt", () => {
  it("returns prompt unchanged when no todos", () => {
    expect(buildTodoPrompt("ship it", [])).toBe("ship it");
  });

  it("embeds todo list and instructions", () => {
    const todos: TodoItem[] = [
      { id: "1", text: "setup", done: false, source: "user", createdAt: 1 },
      { id: "2", text: "test", done: true, source: "user", createdAt: 1 },
    ];
    const out = buildTodoPrompt("implement", todos);
    expect(out).toContain("## Active Todo List (1/2 complete)");
    expect(out).toContain("1. [ ] setup");
    expect(out).toContain("2. [x] test");
    expect(out).toContain("DONE: <number>");
  });
});

describe("todo marker parsers", () => {
  it("parses completions by todo number", () => {
    const todos: TodoItem[] = [
      { id: "a", text: "one", done: false, source: "user", createdAt: 1 },
      { id: "b", text: "two", done: false, source: "user", createdAt: 1 },
    ];

    const output = makeOutput([
      {
        item: {
          type: "agent_message",
          text: "DONE: 2\nDONE: 1",
        },
      },
    ]);

    expect(parseTodoCompletions(output, todos)).toEqual(["b", "a"]);
  });

  it("parses ADD_TODO markers", () => {
    const output = makeOutput([
      {
        item: {
          type: "agent_message",
          text: "ADD_TODO: write docs\nADD_TODO: add tests",
        },
      },
    ]);

    expect(parseTodoAdditions(output)).toEqual(["write docs", "add tests"]);
  });
});

describe("formatters", () => {
  it("formats inline markdown-like tokens", () => {
    const html = renderNode(formatInline("**Bold** `code` *it*"));
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<code class=\"fmt-code\">code</code>");
    expect(html).toContain("<em>it</em>");
  });

  it("formats bullet lines", () => {
    const html = renderNode(formatMessage("- first\nplain"));
    expect(html).toContain("fmt-bullet");
    expect(html).toContain("plain");
  });

  it("highlights matching text", () => {
    const html = renderNode(highlightText("Hello world", "world"));
    expect(html).toContain("<mark class=\"search-highlight\">world</mark>");
  });
});

describe("shouldRenderFinalSummary", () => {
  it("hides final summary when it duplicates the last visible message", () => {
    const shouldRender = shouldRenderFinalSummary(
      [
        { id: 1, category: "status", text: "Done", hidden: true },
        { id: 2, category: "message", text: "Implemented the feature and added tests." },
      ],
      "Implemented the feature and added tests.",
    );
    expect(shouldRender).toBe(false);
  });

  it("renders final summary when no visible message exists", () => {
    const shouldRender = shouldRenderFinalSummary(
      [{ id: 1, category: "status", text: "Done", hidden: true }],
      "Run completed successfully.",
    );
    expect(shouldRender).toBe(true);
  });

  it("renders final summary when last message text is different", () => {
    const shouldRender = shouldRenderFinalSummary(
      [{ id: 1, category: "message", text: "Working on it..." }],
      "All steps completed.",
    );
    expect(shouldRender).toBe(true);
  });
});
