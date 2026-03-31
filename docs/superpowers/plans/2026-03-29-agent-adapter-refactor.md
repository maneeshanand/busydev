# Agent Stream Adapter Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract agent-specific stream parsing from App.tsx into a strategy pattern with one adapter per agent, eliminating code duplication and branching.

**Architecture:** Define an `AgentStreamAdapter` interface with three methods (`classifyEvent`, `extractTextChunk`, `extractLastMessage`). Each agent (Claude, Codex, Gemini, DeepSeek) gets its own adapter file. A `getAdapter(agent)` factory returns the correct one. App.tsx and frontendUtils.tsx call the adapter instead of inline branching. Shared helpers (`cleanCommand`, `shortenPath`, `isNoisyInfraOutput`, `stripTodoMarkers`) stay in a shared utils module.

**Tech Stack:** TypeScript, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/adapters/types.ts` | `AgentStreamAdapter` interface, `ClassifiedRow` type, `AgentType` union |
| `src/lib/adapters/shared.ts` | Shared helpers: `cleanCommand`, `shortenPath`, `isNoisyInfraOutput`, `stripTodoMarkers`, `formatToolSummary` |
| `src/lib/adapters/claude.ts` | Claude Code stream event adapter |
| `src/lib/adapters/codex.ts` | Codex (OpenAI) stream event adapter |
| `src/lib/adapters/gemini.ts` | Gemini CLI stream event adapter |
| `src/lib/adapters/deepseek.ts` | DeepSeek adapter (reuses Codex event format from Rust backend) |
| `src/lib/adapters/index.ts` | `getAdapter(agent)` factory, re-exports |
| `src/lib/adapters/adapters.test.ts` | Tests for all adapters |
| `src/lib/frontendUtils.tsx` | **Modified** - remove duplicate `classifyEvent`, `extractLastAgentMessage`, `cleanCommand`, `shortenPath`; import from adapters |
| `src/App.tsx` | **Modified** - remove `classifyEvent`, `extractAssistantTextChunk`, `extractLastAgentMessage`, `cleanCommand`, `shortenPath`, `isNoisyInfraOutput`, `formatAgentLabel`; import from adapters |

---

### Task 1: Create shared types and helpers

**Files:**
- Create: `src/lib/adapters/types.ts`
- Create: `src/lib/adapters/shared.ts`

- [ ] **Step 1: Create the adapter interface and types**

```typescript
// src/lib/adapters/types.ts
import type { CodexStreamEvent } from "../../invoke";
import type { StreamRow } from "../../types";

export type AgentType = "codex" | "claude" | "deepseek" | "gemini";

export type ClassifiedRow = Omit<StreamRow, "id">;

export interface AgentStreamAdapter {
  /** Classify a single stream event into a UI row. */
  classifyEvent(event: CodexStreamEvent): ClassifiedRow;

  /** Extract a text chunk from a streaming assistant event (for live typing). Returns null if this event is not a text chunk. */
  extractTextChunk(event: CodexStreamEvent): string | null;

  /** Scan a full run's parsed JSON array and return the last assistant message text. */
  extractLastMessage(parsedJson: unknown): string | null;
}
```

- [ ] **Step 2: Create shared helpers**

Extract `cleanCommand`, `shortenPath`, `isNoisyInfraOutput`, `stripTodoMarkers` from App.tsx into `shared.ts`. Also extract the repeated tool-summary formatting logic into a reusable `formatToolSummary` function.

```typescript
// src/lib/adapters/shared.ts
import type { ClassifiedRow } from "./types";
import type { CodexStreamEvent } from "../../invoke";

export function cleanCommand(raw: string): string {
  const m = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+['"](.+)['"]$/s);
  if (m) return m[1];
  const m2 = raw.match(/^\/bin\/(?:ba|z)?sh\s+-\w*c\s+'(.+)'$/s);
  return m2 ? m2[1] : raw;
}

export function shortenPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? parts.slice(-2).join("/") : path;
}

export function isNoisyInfraOutput(text: string): boolean {
  return /(rmcp::transport::worker|unexpectedcontenttype|transport channel closed|cloudflare|cf-error|<!doctype html>|cdn-cgi\/styles|yolo mode is enabled|loaded cached credentials)/i.test(text);
}

export function stripTodoMarkers(text: string): string {
  return text
    .replace(/^\s*DONE:\s*\d+\s*[.)]?\s*$/gim, "")
    .replace(/^\s*ADD_TODO:\s*.+\s*$/gim, "")
    .trim();
}

/**
 * Map common tool name + input patterns to a human-readable summary.
 * Each adapter maps its own tool schema to this common shape.
 */
export interface ToolInfo {
  name: string;
  filePath?: string;
  command?: string;
  pattern?: string;
  query?: string;
  url?: string;
  dirPath?: string;
}

export function formatToolSummary(tool: ToolInfo): string {
  const { name } = tool;
  if ((name === "Bash" || name === "shell") && tool.command) {
    return cleanCommand(tool.command);
  }
  if ((name === "Read" || name === "read_file" || name === "read_many_files") && tool.filePath) {
    return `Read ${shortenPath(tool.filePath)}`;
  }
  if ((name === "Edit" || name === "edit") && tool.filePath) {
    return `Edit ${shortenPath(tool.filePath)}`;
  }
  if ((name === "Write" || name === "write_file") && tool.filePath) {
    return `Write ${shortenPath(tool.filePath)}`;
  }
  if ((name === "Glob" || name === "glob") && tool.pattern) {
    return `Glob ${tool.pattern}`;
  }
  if ((name === "Grep" || name === "grep") && tool.pattern) {
    return `Grep ${tool.pattern}`;
  }
  if ((name === "WebSearch" || name === "web_search") && tool.query) {
    return `Search: ${tool.query}`;
  }
  if ((name === "WebFetch" || name === "web_fetch") && tool.url) {
    return `Fetch ${tool.url}`;
  }
  if ((name === "list_directory" || name === "ls") && tool.dirPath) {
    return `ls ${shortenPath(tool.dirPath)}`;
  }
  return name;
}

/** Classify lifecycle events common to all agents (completed, started, stderr, spawn_error). Returns null if this is not a lifecycle event. */
export function classifyLifecycleEvent(event: CodexStreamEvent): ClassifiedRow | null {
  if (event.kind === "completed") {
    return { category: "status", text: "", hidden: true };
  }
  if (event.kind === "started") {
    return { category: "status", text: "Starting...", hidden: true };
  }
  if (event.kind === "spawn_error") {
    return { category: "error", text: event.line ?? "Failed to start process" };
  }
  if (event.kind === "stderr") {
    const text = event.line?.trim() || "stderr output";
    if (isNoisyInfraOutput(text)) {
      return { category: "status", text: "", hidden: true };
    }
    const clipped = text.length > 260 ? `${text.slice(0, 260)}...` : text;
    return { category: "error", text: clipped };
  }
  return null;
}

/** Fallback for unstructured stdout lines. Returns null if line is empty. */
export function classifyFallbackLine(event: CodexStreamEvent): ClassifiedRow | null {
  if (event.line && event.line.trim().length > 0) {
    const trimmed = event.line.trim();
    if (isNoisyInfraOutput(trimmed)) {
      return { category: "status", text: "", hidden: true };
    }
    const text = trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
    return { category: "message", text };
  }
  return null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(adapters): add AgentStreamAdapter interface and shared helpers
```

---

### Task 2: Create Claude adapter

**Files:**
- Create: `src/lib/adapters/claude.ts`

- [ ] **Step 1: Implement ClaudeAdapter**

```typescript
// src/lib/adapters/claude.ts
import type { CodexStreamEvent } from "../../invoke";
import type { AgentStreamAdapter, ClassifiedRow } from "./types";
import {
  classifyLifecycleEvent,
  classifyFallbackLine,
  cleanCommand,
  formatToolSummary,
  shortenPath,
  stripTodoMarkers,
} from "./shared";

export const claudeAdapter: AgentStreamAdapter = {
  classifyEvent(event: CodexStreamEvent): ClassifiedRow {
    const lifecycle = classifyLifecycleEvent(event);
    if (lifecycle) return lifecycle;

    const value = event.parsedJson;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type : "";

      if (type === "system" || type === "rate_limit_event") {
        return { category: "status", text: "", hidden: true };
      }

      if (type === "control_request") {
        const request = obj.request as Record<string, unknown> | undefined;
        if (request?.subtype === "can_use_tool") {
          const toolName = typeof request.tool_name === "string" ? request.tool_name : "unknown";
          const input = request.input as Record<string, unknown> | undefined;
          const requestId = typeof obj.request_id === "string" ? obj.request_id : "";

          let summary = toolName;
          if (toolName === "Bash" && input?.command) {
            summary = `Bash: ${cleanCommand(String(input.command))}`;
          } else if ((toolName === "Edit" || toolName === "Write" || toolName === "Read") && input?.file_path) {
            summary = `${toolName}: ${shortenPath(String(input.file_path))}`;
          }

          return {
            category: "approval",
            text: summary,
            toolName,
            toolInput: input ?? {},
            requestId,
            approvalState: "pending" as const,
          };
        }
      }

      if (type === "assistant") {
        const message = obj.message as Record<string, unknown> | undefined;
        const content = message?.content;
        if (Array.isArray(content) && content.length > 0) {
          const block = content[content.length - 1] as Record<string, unknown>;
          const blockType = typeof block.type === "string" ? block.type : "";

          if (blockType === "thinking") {
            const thinking = typeof block.thinking === "string" ? block.thinking.trim() : "";
            if (!thinking) return { category: "status", text: "", hidden: true };
            const display = thinking.length > 200 ? `${thinking.slice(0, 200)}...` : thinking;
            return { category: "message", text: display };
          }

          if (blockType === "tool_use") {
            const toolName = typeof block.name === "string" ? block.name : "tool";
            const input = block.input as Record<string, unknown> | undefined;
            const summary = formatToolSummary({
              name: toolName,
              filePath: input?.file_path ? String(input.file_path) : undefined,
              command: input?.command ? String(input.command) : undefined,
              pattern: input?.pattern ? String(input.pattern) : undefined,
              query: input?.query ? String(input.query) : undefined,
              url: input?.url ? String(input.url) : undefined,
            });
            return { category: "command", text: summary, command: summary, status: "running" };
          }

          if (blockType === "text") {
            const raw = typeof block.text === "string" ? block.text.trim() : "";
            const text = stripTodoMarkers(raw);
            if (!text) return { category: "status", text: "", hidden: true };
            const isTodoSummary = /working on #\d/i.test(text) || (/todo/i.test(text) && /#\d/.test(text));
            return { category: "message", text, isTodoSummary };
          }
        }
        return { category: "status", text: "", hidden: true };
      }

      if (type === "user") {
        const toolResult = obj.tool_use_result as Record<string, unknown> | undefined;
        if (toolResult) {
          return { category: "command", text: "", command: "", status: "done" };
        }
        return { category: "status", text: "", hidden: true };
      }

      if (type === "result") {
        const cost = typeof obj.total_cost_usd === "number" ? `$${obj.total_cost_usd.toFixed(4)}` : "";
        const turns = typeof obj.num_turns === "number" ? `${obj.num_turns} turns` : "";
        const parts = [turns, cost].filter(Boolean).join(" · ");
        return { category: "status", text: parts || "Done" };
      }
    }

    return classifyFallbackLine(event) ?? { category: "status", text: "", hidden: true };
  },

  extractTextChunk(event: CodexStreamEvent): string | null {
    const value = event.parsedJson;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (obj.type !== "assistant") return null;
    const message = obj.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (!Array.isArray(content) || content.length === 0) return null;
    const block = content[content.length - 1] as Record<string, unknown>;
    if (block.type !== "text") return null;
    const text = typeof block.text === "string" ? block.text : "";
    return text.length > 0 ? text : null;
  },

  extractLastMessage(parsedJson: unknown): string | null {
    if (!Array.isArray(parsedJson)) return null;
    let lastMessage: string | null = null;
    for (const event of parsedJson) {
      if (!event || typeof event !== "object" || Array.isArray(event)) continue;
      const obj = event as Record<string, unknown>;
      if (obj.type !== "assistant") continue;
      const message = obj.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block && typeof block === "object" && (block as Record<string, unknown>).type === "text") {
          const text = typeof (block as Record<string, unknown>).text === "string"
            ? ((block as Record<string, unknown>).text as string).trim()
            : "";
          if (text) lastMessage = text;
        }
      }
    }
    return lastMessage;
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(adapters): add Claude stream adapter
```

---

### Task 3: Create Codex adapter

**Files:**
- Create: `src/lib/adapters/codex.ts`

- [ ] **Step 1: Implement CodexAdapter**

```typescript
// src/lib/adapters/codex.ts
import type { CodexStreamEvent } from "../../invoke";
import type { AgentStreamAdapter, ClassifiedRow } from "./types";
import {
  classifyLifecycleEvent,
  classifyFallbackLine,
  cleanCommand,
  shortenPath,
  stripTodoMarkers,
} from "./shared";

export const codexAdapter: AgentStreamAdapter = {
  classifyEvent(event: CodexStreamEvent): ClassifiedRow {
    const lifecycle = classifyLifecycleEvent(event);
    if (lifecycle) return lifecycle;

    const value = event.parsedJson;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type : "";

      if (type === "thread.started" || type === "turn.started" || type === "turn.completed") {
        return { category: "status", text: "", hidden: true };
      }

      const item = obj.item && typeof obj.item === "object" && !Array.isArray(obj.item)
        ? (obj.item as Record<string, unknown>)
        : null;

      if (item) {
        const itemType = typeof item.type === "string" ? item.type : "";

        if (itemType === "agent_message") {
          const raw = typeof item.text === "string" ? item.text.trim() : "";
          const text = stripTodoMarkers(raw);
          const isTodoSummary = /working on #\d/i.test(text) || (/todo/i.test(text) && /#\d/.test(text));
          return { category: "message", text: text || "Thinking...", isTodoSummary };
        }

        if (itemType === "command_execution") {
          const rawCmd = typeof item.command === "string" ? item.command : "command";
          const cmd = cleanCommand(rawCmd);
          const itemStatus = typeof item.status === "string" ? item.status : "";
          const exitCode = typeof item.exit_code === "number" ? item.exit_code : null;

          if (itemStatus === "in_progress") {
            return { category: "command", text: cmd, command: cmd, status: "running" };
          }
          if (itemStatus === "completed") {
            const failed = exitCode !== null && exitCode !== 0;
            return {
              category: "command",
              text: cmd,
              command: cmd,
              status: failed ? "failed" : "done",
              exitCode,
            };
          }
          return { category: "command", text: cmd, command: cmd, status: "running" };
        }

        if (itemType === "file_change") {
          const changes = Array.isArray(item.changes) ? item.changes : [];
          const paths = changes
            .map((c) => {
              if (c && typeof c === "object" && "path" in c && typeof (c as Record<string, unknown>).path === "string") {
                return shortenPath((c as Record<string, unknown>).path as string);
              }
              return null;
            })
            .filter(Boolean) as string[];
          const count = changes.length;
          const text = paths.length > 0
            ? paths.join(", ")
            : count > 0 ? `${count} file${count === 1 ? "" : "s"}` : "files";
          return { category: "file_change", text, filePaths: paths };
        }
      }
    }

    return classifyFallbackLine(event) ?? { category: "status", text: "", hidden: true };
  },

  extractTextChunk(_event: CodexStreamEvent): string | null {
    // Codex doesn't stream text chunks — messages arrive as complete agent_message items
    return null;
  },

  extractLastMessage(parsedJson: unknown): string | null {
    if (!Array.isArray(parsedJson)) return null;
    let lastMessage: string | null = null;
    for (const event of parsedJson) {
      if (!event || typeof event !== "object" || Array.isArray(event)) continue;
      const obj = event as Record<string, unknown>;
      const item = obj.item;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const eventItem = item as Record<string, unknown>;
        if (eventItem.type === "agent_message") {
          const text = typeof eventItem.text === "string" ? eventItem.text.trim() : "";
          if (text) lastMessage = text;
        }
      }
    }
    return lastMessage;
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(adapters): add Codex stream adapter
```

---

### Task 4: Create Gemini adapter

**Files:**
- Create: `src/lib/adapters/gemini.ts`

- [ ] **Step 1: Implement GeminiAdapter**

```typescript
// src/lib/adapters/gemini.ts
import type { CodexStreamEvent } from "../../invoke";
import type { AgentStreamAdapter, ClassifiedRow } from "./types";
import {
  classifyLifecycleEvent,
  classifyFallbackLine,
  formatToolSummary,
} from "./shared";

export const geminiAdapter: AgentStreamAdapter = {
  classifyEvent(event: CodexStreamEvent): ClassifiedRow {
    const lifecycle = classifyLifecycleEvent(event);
    if (lifecycle) return lifecycle;

    const value = event.parsedJson;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type : "";

      if (type === "init") {
        return { category: "status", text: "", hidden: true };
      }

      if (type === "message" && obj.role === "user") {
        return { category: "status", text: "", hidden: true };
      }

      if (type === "message" && obj.role === "assistant") {
        const text = typeof obj.content === "string" ? obj.content.trim() : "";
        if (!text) return { category: "status", text: "", hidden: true };
        return { category: "message", text };
      }

      if (type === "tool_use") {
        const toolName = typeof obj.tool_name === "string" ? obj.tool_name : "tool";
        const params = obj.parameters as Record<string, unknown> | undefined;
        const summary = formatToolSummary({
          name: toolName,
          filePath: params?.file_path ? String(params.file_path) : undefined,
          command: params?.command ? String(params.command) : undefined,
          pattern: params?.pattern ? String(params.pattern) : undefined,
          query: params?.query ? String(params.query) : undefined,
          url: params?.url ? String(params.url) : undefined,
          dirPath: params?.directory_path
            ? String(params.directory_path)
            : params?.path
              ? String(params.path)
              : undefined,
        });
        return { category: "command", text: summary, command: summary, status: "running" };
      }

      if (type === "tool_result") {
        return { category: "command", text: "", command: "", status: "done" };
      }

      if (type === "result") {
        const stats = obj.stats as Record<string, unknown> | undefined;
        const tokens = typeof stats?.total_tokens === "number" ? `${stats.total_tokens} tokens` : "";
        const duration = typeof stats?.duration_ms === "number" ? `${(stats.duration_ms / 1000).toFixed(1)}s` : "";
        const toolCalls = typeof stats?.tool_calls === "number" && stats.tool_calls > 0 ? `${stats.tool_calls} tool calls` : "";
        const parts = [toolCalls, tokens, duration].filter(Boolean).join(" · ");
        return { category: "status", text: parts || "Done" };
      }
    }

    return classifyFallbackLine(event) ?? { category: "status", text: "", hidden: true };
  },

  extractTextChunk(event: CodexStreamEvent): string | null {
    const value = event.parsedJson;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (obj.type !== "message" || obj.role !== "assistant" || obj.delta !== true) return null;
    const text = typeof obj.content === "string" ? obj.content : "";
    return text.length > 0 ? text : null;
  },

  extractLastMessage(parsedJson: unknown): string | null {
    if (!Array.isArray(parsedJson)) return null;
    let lastMessage: string | null = null;
    for (const event of parsedJson) {
      if (!event || typeof event !== "object" || Array.isArray(event)) continue;
      const obj = event as Record<string, unknown>;
      if (obj.type === "message" && obj.role === "assistant") {
        const text = typeof obj.content === "string" ? obj.content.trim() : "";
        if (text) lastMessage = text;
      }
    }
    return lastMessage;
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```
feat(adapters): add Gemini stream adapter
```

---

### Task 5: Create DeepSeek adapter and adapter registry

**Files:**
- Create: `src/lib/adapters/deepseek.ts`
- Create: `src/lib/adapters/index.ts`

DeepSeek's Rust backend (`run_deepseek_exec`) emits synthetic events in the same format as Codex (`item.type: "agent_message"`, etc.). The DeepSeek adapter reuses the Codex adapter.

- [ ] **Step 1: Create DeepSeek adapter**

```typescript
// src/lib/adapters/deepseek.ts
import { codexAdapter } from "./codex";
import type { AgentStreamAdapter } from "./types";

// DeepSeek's Rust backend emits events in Codex format (agent_message, etc.)
export const deepseekAdapter: AgentStreamAdapter = codexAdapter;
```

- [ ] **Step 2: Create adapter registry**

```typescript
// src/lib/adapters/index.ts
export type { AgentStreamAdapter, AgentType, ClassifiedRow } from "./types";
export {
  cleanCommand,
  shortenPath,
  isNoisyInfraOutput,
  stripTodoMarkers,
  formatToolSummary,
  classifyLifecycleEvent,
  classifyFallbackLine,
} from "./shared";
export { claudeAdapter } from "./claude";
export { codexAdapter } from "./codex";
export { geminiAdapter } from "./gemini";
export { deepseekAdapter } from "./deepseek";

import type { AgentStreamAdapter, AgentType } from "./types";
import { claudeAdapter } from "./claude";
import { codexAdapter } from "./codex";
import { geminiAdapter } from "./gemini";
import { deepseekAdapter } from "./deepseek";

const adapters: Record<AgentType, AgentStreamAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  gemini: geminiAdapter,
  deepseek: deepseekAdapter,
};

export function getAdapter(agent?: string): AgentStreamAdapter {
  if (agent && agent in adapters) {
    return adapters[agent as AgentType];
  }
  return codexAdapter;
}

export function formatAgentLabel(agent?: string): string {
  const labels: Record<string, string> = {
    claude: "Claude",
    deepseek: "DeepSeek",
    gemini: "Gemini",
    codex: "Codex",
  };
  return labels[agent ?? ""] ?? "Codex";
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(adapters): add DeepSeek adapter and adapter registry with getAdapter factory
```

---

### Task 6: Write adapter tests

**Files:**
- Create: `src/lib/adapters/adapters.test.ts`

- [ ] **Step 1: Write tests covering all four adapters**

```typescript
// src/lib/adapters/adapters.test.ts
import { describe, expect, it } from "vitest";
import type { CodexStreamEvent } from "../../invoke";
import { getAdapter, formatAgentLabel } from "./index";
import { cleanCommand, shortenPath, formatToolSummary } from "./shared";

function evt(parsedJson: unknown): CodexStreamEvent {
  return { runId: "r1", kind: "stdout", parsedJson };
}

describe("getAdapter", () => {
  it("returns codex adapter by default", () => {
    expect(getAdapter()).toBeDefined();
    expect(getAdapter("unknown")).toBeDefined();
  });

  it("returns distinct adapters for each agent type", () => {
    for (const agent of ["claude", "codex", "gemini", "deepseek"]) {
      expect(getAdapter(agent)).toBeDefined();
    }
  });
});

describe("formatAgentLabel", () => {
  it("returns correct labels", () => {
    expect(formatAgentLabel("claude")).toBe("Claude");
    expect(formatAgentLabel("deepseek")).toBe("DeepSeek");
    expect(formatAgentLabel("gemini")).toBe("Gemini");
    expect(formatAgentLabel("codex")).toBe("Codex");
    expect(formatAgentLabel()).toBe("Codex");
  });
});

describe("shared helpers", () => {
  it("cleanCommand strips shell wrapper", () => {
    expect(cleanCommand("/bin/zsh -lc 'echo hello'")).toBe("echo hello");
    expect(cleanCommand("npm test")).toBe("npm test");
  });

  it("shortenPath keeps last 2 segments", () => {
    expect(shortenPath("/a/b/c/d.ts")).toBe("c/d.ts");
    expect(shortenPath("a/b")).toBe("a/b");
  });

  it("formatToolSummary formats Read tool", () => {
    expect(formatToolSummary({ name: "Read", filePath: "/a/b/c.ts" })).toBe("Read b/c.ts");
    expect(formatToolSummary({ name: "read_file", filePath: "README.md" })).toBe("Read README.md");
  });

  it("formatToolSummary formats shell/Bash tool", () => {
    expect(formatToolSummary({ name: "Bash", command: "npm test" })).toBe("npm test");
    expect(formatToolSummary({ name: "shell", command: "ls -la" })).toBe("ls -la");
  });
});

describe("Claude adapter", () => {
  const adapter = getAdapter("claude");

  it("classifies assistant text", () => {
    const row = adapter.classifyEvent(evt({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello world" }] },
    }));
    expect(row.category).toBe("message");
    expect(row.text).toBe("Hello world");
  });

  it("classifies tool_use as running command", () => {
    const row = adapter.classifyEvent(evt({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/a/b/c.ts" } }] },
    }));
    expect(row.category).toBe("command");
    expect(row.status).toBe("running");
    expect(row.text).toBe("Read b/c.ts");
  });

  it("classifies control_request as approval", () => {
    const row = adapter.classifyEvent(evt({
      type: "control_request",
      request_id: "req_1",
      request: { subtype: "can_use_tool", tool_name: "Bash", input: { command: "echo hi" } },
    }));
    expect(row.category).toBe("approval");
    expect(row.requestId).toBe("req_1");
  });

  it("classifies result with cost", () => {
    const row = adapter.classifyEvent(evt({ type: "result", total_cost_usd: 0.05, num_turns: 3 }));
    expect(row.category).toBe("status");
    expect(row.text).toContain("$0.0500");
    expect(row.text).toContain("3 turns");
  });

  it("extracts text chunk from assistant event", () => {
    const chunk = adapter.extractTextChunk(evt({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello" }] },
    }));
    expect(chunk).toBe("Hello");
  });

  it("returns null for non-text chunks", () => {
    expect(adapter.extractTextChunk(evt({ type: "assistant", message: { content: [{ type: "tool_use" }] } }))).toBeNull();
  });

  it("extracts last message from parsed JSON", () => {
    const msg = adapter.extractLastMessage([
      { type: "assistant", message: { content: [{ type: "text", text: "first" }] } },
      { type: "assistant", message: { content: [{ type: "text", text: "last" }] } },
    ]);
    expect(msg).toBe("last");
  });
});

describe("Codex adapter", () => {
  const adapter = getAdapter("codex");

  it("classifies agent_message", () => {
    const row = adapter.classifyEvent(evt({ item: { type: "agent_message", text: "Done!" } }));
    expect(row.category).toBe("message");
    expect(row.text).toBe("Done!");
  });

  it("classifies command_execution in_progress", () => {
    const row = adapter.classifyEvent(evt({
      item: { type: "command_execution", command: "/bin/zsh -lc 'ls -la'", status: "in_progress" },
    }));
    expect(row.category).toBe("command");
    expect(row.command).toBe("ls -la");
    expect(row.status).toBe("running");
  });

  it("classifies command_execution completed with failure", () => {
    const row = adapter.classifyEvent(evt({
      item: { type: "command_execution", command: "npm test", status: "completed", exit_code: 1 },
    }));
    expect(row.status).toBe("failed");
    expect(row.exitCode).toBe(1);
  });

  it("classifies file_change", () => {
    const row = adapter.classifyEvent(evt({
      item: { type: "file_change", changes: [{ path: "/a/b/c.ts" }] },
    }));
    expect(row.category).toBe("file_change");
    expect(row.filePaths).toEqual(["b/c.ts"]);
  });

  it("hides thread/turn events", () => {
    expect(adapter.classifyEvent(evt({ type: "thread.started" })).hidden).toBe(true);
    expect(adapter.classifyEvent(evt({ type: "turn.started" })).hidden).toBe(true);
    expect(adapter.classifyEvent(evt({ type: "turn.completed" })).hidden).toBe(true);
  });

  it("extracts last agent_message", () => {
    const msg = adapter.extractLastMessage([
      { item: { type: "agent_message", text: "Working..." } },
      { item: { type: "agent_message", text: "All done." } },
    ]);
    expect(msg).toBe("All done.");
  });

  it("extractTextChunk returns null (Codex has no streaming text)", () => {
    expect(adapter.extractTextChunk(evt({ item: { type: "agent_message", text: "hi" } }))).toBeNull();
  });
});

describe("Gemini adapter", () => {
  const adapter = getAdapter("gemini");

  it("hides init event", () => {
    expect(adapter.classifyEvent(evt({ type: "init", session_id: "abc", model: "gemini-2.5-flash" })).hidden).toBe(true);
  });

  it("hides user message echo", () => {
    expect(adapter.classifyEvent(evt({ type: "message", role: "user", content: "hello" })).hidden).toBe(true);
  });

  it("classifies assistant message", () => {
    const row = adapter.classifyEvent(evt({ type: "message", role: "assistant", content: "Here is the summary." }));
    expect(row.category).toBe("message");
    expect(row.text).toBe("Here is the summary.");
  });

  it("classifies tool_use", () => {
    const row = adapter.classifyEvent(evt({
      type: "tool_use",
      tool_name: "read_file",
      tool_id: "rf_1",
      parameters: { file_path: "README.md" },
    }));
    expect(row.category).toBe("command");
    expect(row.text).toBe("Read README.md");
    expect(row.status).toBe("running");
  });

  it("classifies tool_result as done", () => {
    const row = adapter.classifyEvent(evt({ type: "tool_result", tool_id: "rf_1", status: "success" }));
    expect(row.category).toBe("command");
    expect(row.status).toBe("done");
  });

  it("classifies result with stats", () => {
    const row = adapter.classifyEvent(evt({
      type: "result",
      status: "success",
      stats: { total_tokens: 15868, duration_ms: 8039, tool_calls: 1 },
    }));
    expect(row.category).toBe("status");
    expect(row.text).toContain("15868 tokens");
    expect(row.text).toContain("8.0s");
    expect(row.text).toContain("1 tool calls");
  });

  it("extracts text chunk from delta message", () => {
    const chunk = adapter.extractTextChunk(evt({
      type: "message",
      role: "assistant",
      content: "Hello",
      delta: true,
    }));
    expect(chunk).toBe("Hello");
  });

  it("returns null for non-delta message text chunk", () => {
    expect(adapter.extractTextChunk(evt({
      type: "message",
      role: "assistant",
      content: "Hello",
    }))).toBeNull();
  });

  it("extracts last assistant message", () => {
    const msg = adapter.extractLastMessage([
      { type: "message", role: "assistant", content: "first" },
      { type: "tool_use", tool_name: "read_file" },
      { type: "message", role: "assistant", content: "last" },
    ]);
    expect(msg).toBe("last");
  });
});

describe("DeepSeek adapter", () => {
  const adapter = getAdapter("deepseek");

  it("uses codex format (agent_message)", () => {
    const row = adapter.classifyEvent(evt({ item: { type: "agent_message", text: "response" } }));
    expect(row.category).toBe("message");
    expect(row.text).toBe("response");
  });
});

describe("lifecycle events (all adapters)", () => {
  for (const agent of ["claude", "codex", "gemini", "deepseek"] as const) {
    const adapter = getAdapter(agent);

    it(`${agent}: hides completed event`, () => {
      const row = adapter.classifyEvent({ runId: "r1", kind: "completed" });
      expect(row.hidden).toBe(true);
    });

    it(`${agent}: classifies stderr as error`, () => {
      const row = adapter.classifyEvent({ runId: "r1", kind: "stderr", line: "something broke" });
      expect(row.category).toBe("error");
    });

    it(`${agent}: hides noisy infra stderr`, () => {
      const row = adapter.classifyEvent({ runId: "r1", kind: "stderr", line: "YOLO mode is enabled" });
      expect(row.hidden).toBe(true);
    });

    it(`${agent}: classifies spawn_error`, () => {
      const row = adapter.classifyEvent({ runId: "r1", kind: "spawn_error", line: "not found" });
      expect(row.category).toBe("error");
    });
  }
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/adapters/adapters.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```
test(adapters): add comprehensive tests for all agent stream adapters
```

---

### Task 7: Wire adapters into App.tsx and clean up frontendUtils.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/frontendUtils.tsx`
- Modify: `src/lib/frontendUtils.test.tsx`

This is the integration task. Replace all inline adapter logic with calls to `getAdapter`.

- [ ] **Step 1: Update App.tsx imports**

Replace the `ClassifiedRow` type alias and remove the local functions. Add import:

```typescript
import { getAdapter, formatAgentLabel, stripTodoMarkers, isNoisyInfraOutput } from "./lib/adapters";
import type { ClassifiedRow } from "./lib/adapters";
```

Remove the existing import of `stripTodoMarkers` from `"./lib/frontendUtils"`.

- [ ] **Step 2: Remove these functions from App.tsx**

Delete entirely:
- `extractLastAgentMessage` (lines 115-157)
- `cleanCommand` (lines 182-187)
- `shortenPath` (lines 189-192)
- `formatAgentLabel` (lines 194-199)
- `isNoisyInfraOutput` (lines 201-203)
- `type ClassifiedRow = ...` (line 205)
- `extractAssistantTextChunk` (lines 207-232)
- `classifyEvent` (lines 234-505)

- [ ] **Step 3: Update buildFinalSummary to use adapter**

Replace the body of `buildFinalSummary`. It needs to know which agent produced the run. Find where `buildFinalSummary` is called (it receives a `RunEntry`). The `RunEntry` type doesn't carry `agent` — look at how it's called to see if the agent is available in scope.

If the agent is available in scope at the call site, pass it through. Otherwise, try all adapters (codex then claude then gemini) and use the first non-null result — this matches the current behavior where all three branches are tried in sequence.

```typescript
function buildFinalSummary(run: RunEntry, agent?: string): string {
  if (run.stopped) {
    return "Stopped. What should I do instead?";
  }
  const adapter = getAdapter(agent);
  const lastAgentMessage = adapter.extractLastMessage(run.output.parsedJson);
  if (lastAgentMessage) return stripTodoMarkers(lastAgentMessage);

  if ((run.output.exitCode ?? 1) === 0) {
    return `You asked me to ${summarizePrompt(run.prompt)}, and I finished it.`;
  }
  return `You asked me to ${summarizePrompt(run.prompt)}, but the run ended with exit code ${run.output.exitCode ?? "N/A"}.`;
}
```

Update the call site of `buildFinalSummary` to pass the agent. Search for all usages and pass the agent from the session/run context.

- [ ] **Step 4: Update stream event listener to use adapter**

Find the stream event listener (where `classifyEvent` and `extractAssistantTextChunk` are called). Replace with:

```typescript
// Where agent is the current session's agent
const adapter = getAdapter(agent);
const row = adapter.classifyEvent(event);
const textChunk = adapter.extractTextChunk(event);
```

- [ ] **Step 5: Clean up frontendUtils.tsx**

Remove from `frontendUtils.tsx`:
- `extractLastAgentMessage` (lines 7-41, now private inside each adapter)
- `cleanCommand` (lines 59-64, now in `adapters/shared.ts`)
- `shortenPath` (lines 66-69, now in `adapters/shared.ts`)
- `classifyEvent` (lines 71-262, replaced by adapter pattern)
- `type ClassifiedRow` (line 5, now in `adapters/types.ts`)

Re-export from adapters for backward compat:
```typescript
export { classifyEvent } from "./adapters/codex"; // or remove if no external consumers
export { cleanCommand, stripTodoMarkers } from "./adapters/shared";
export type { ClassifiedRow } from "./adapters/types";
```

Actually — check all import sites first. `frontendUtils.test.tsx` imports `classifyEvent` and `cleanCommand`. Update that test file to import from the adapters instead, then remove the duplicates from `frontendUtils.tsx` entirely.

- [ ] **Step 6: Update frontendUtils.test.tsx imports**

Change:
```typescript
import { classifyEvent, cleanCommand, ... } from "./frontendUtils";
```
to:
```typescript
import { cleanCommand } from "./adapters/shared";
import { getAdapter } from "./adapters";
```

Update the `classifyEvent` test calls to use `getAdapter("codex").classifyEvent(...)` and `getAdapter("claude").classifyEvent(...)` as appropriate for each test case.

- [ ] **Step 7: Update parseTodoCompletions/parseTodoAdditions**

These functions in `frontendUtils.tsx` call the local `extractLastAgentMessage`. They need to work across all agent types. Replace with trying all adapters:

```typescript
import { getAdapter } from "./adapters";
import type { AgentType } from "./adapters";

function extractLastAgentMessage(parsedJson: unknown): string | null {
  for (const agent of ["codex", "claude", "gemini"] as AgentType[]) {
    const msg = getAdapter(agent).extractLastMessage(parsedJson);
    if (msg) return msg;
  }
  return null;
}
```

This is a private helper inside `frontendUtils.tsx` used only by `parseTodoCompletions` and `parseTodoAdditions`.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (adapter tests + existing frontendUtils tests)

- [ ] **Step 10: Commit**

```
refactor(adapters): wire adapter pattern into App.tsx and frontendUtils, remove duplicate code
```

---

## Self-Review

**Spec coverage:**
- [x] Each agent (Claude, Codex, Gemini, DeepSeek) has its own adapter file
- [x] Common interface (`AgentStreamAdapter`) with 3 methods
- [x] Factory function (`getAdapter`) returns correct adapter
- [x] Shared helpers extracted to avoid duplication across adapters
- [x] Duplicate code removed from both `App.tsx` and `frontendUtils.tsx`
- [x] All existing tests updated to use new imports
- [x] New tests for all adapters

**Placeholder scan:** No TBD/TODO/placeholder language found.

**Type consistency:** `AgentStreamAdapter`, `ClassifiedRow`, `AgentType`, `ToolInfo`, `CodexStreamEvent` used consistently across all tasks. Method names `classifyEvent`, `extractTextChunk`, `extractLastMessage` match interface definition.
