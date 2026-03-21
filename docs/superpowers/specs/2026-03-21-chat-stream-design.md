# Chat Stream — Render Agent Output with Visual Treatment

**Issue:** #28
**Date:** 2026-03-21
**Status:** Approved

## Overview

Replace the MessageArea empty state with a live chat stream that renders agent events. Polls `stream_agent_events` while an agent session is active, renders messages, tool calls, tool results, errors, and status changes with distinct visual treatments. Wires ChatInput's submit/stop to real agent commands.

## Tauri Commands

- `start_agent_session({ adapter, workspacePath, config? })` → `AgentSessionInfo`
- `stop_agent_session({ id })` → `void`
- `send_agent_input({ id, input })` → `void`
- `stream_agent_events({ id, sinceSeq? })` → `AgentEventBatch { session, events, nextSeq, usage }`

## Agent Event Types (tagged union, `type` field)

- `message` — `{ content: string }` — agent text output
- `toolCall` — `{ name: string, input: Value }` — agent invoking a tool
- `toolResult` — `{ name: string, output: Value }` — tool response
- `error` — `{ message: string }` — error message
- `status` — `{ status: AgentStatus }` — status change (Working/NeedsInput/Idle/Error/Done)

## Components

```
src/components/chat/
  MessageArea.tsx          — MODIFY: render event stream instead of empty state
  MessageArea.css          — MODIFY: message list styles
  ChatMessage.tsx          — CREATE: renders a single agent event with visual treatment
  ChatMessage.css          — CREATE: message bubble styles
  useAgentStream.ts        — CREATE: hook for polling agent events

src/components/layout/
  ChatPanel.tsx            — MODIFY: wire ChatInput to real agent commands
```

### Responsibilities

- **useAgentStream**: Hook that manages agent session lifecycle. Polls `stream_agent_events` every 500ms while session is active. Returns `events[]`, `isRunning`, `usage`, `startSession`, `stopSession`, `sendInput`. Tracks `nextSeq` for incremental polling.
- **MessageArea**: Receives `events` and `isRunning` from hook. Renders list of `ChatMessage` components. Auto-scrolls to bottom on new events. Shows empty state when no events.
- **ChatMessage**: Renders a single event with visual treatment based on type:
  - `message` — text bubble, agent-colored left border
  - `toolCall` — compact card: "Using {name}" with collapsed input JSON
  - `toolResult` — compact card: "{name} result" with collapsed output JSON
  - `error` — red-tinted bubble
  - `status` — small centered status pill (e.g., "Agent is working...")
- **ChatPanel**: Wires `useAgentStream` hook. Passes `onSubmit`→`sendInput`, `onStop`→`stopSession`, `isRunning` to ChatInput.

## Data Flow

- `ChatPanel` creates `useAgentStream(workspace)` hook.
- On first user message (when no session), hook calls `start_agent_session` then `send_agent_input`.
- Polling starts automatically when session is active.
- Events accumulate in hook state, passed to `MessageArea`.
- User messages are added to the stream as synthetic "user" events (local only, not from backend).

## Out of Scope

- Markdown rendering in message content
- Code syntax highlighting in messages
- Message editing or regeneration
- Conversation history persistence across sessions
