# Agent Chat Panel Shell — Status Bar, Message Area, Input

**Issue:** #27
**Date:** 2026-03-21
**Status:** Approved

## Overview

The chat panel shell replaces the placeholder `ChatPanel` with three structural zones: a status bar showing workspace context, a scrollable message area with empty states, and a disabled input placeholder. Real message streaming (#28) and input functionality (#26) land in subsequent issues.

## Component Structure

```
src/components/chat/
  ChatStatusBar.tsx        — workspace name + agent adapter + status indicator
  ChatStatusBar.css
  MessageArea.tsx          — scrollable message container with empty states
  MessageArea.css
  ChatInputPlaceholder.tsx — disabled textarea placeholder
  ChatInputPlaceholder.css

src/components/layout/
  ChatPanel.tsx            — MODIFY: replace PlaceholderPanel with chat components
```

### Responsibilities

- **ChatPanel** (modified): Reads `selectedWorkspaceId` from `useWorkspaceStore`. Renders `ChatStatusBar`, `MessageArea`, and `ChatInputPlaceholder` in a vertical flex layout.
- **ChatStatusBar**: Receives the active `Workspace | null` as a prop from `ChatPanel`. Displays branch/ticket (ticket preferred when non-null), `agentAdapter` verbatim, and a `StatusIndicator` (reused from `src/components/sidebar/StatusIndicator`). When workspace is null, shows "No workspace selected" in muted text.
- **MessageArea**: Receives `hasWorkspace: boolean` prop. Shows "Select a workspace to start chatting" when `false`, "No messages yet" when `true`. Scrollable container ready for message list in #28.
- **ChatInputPlaceholder**: Fully static — disabled textarea with "Type a message..." placeholder and a muted send button. No props, no store access. Replaced entirely by #26.

## Data Flow

- `ChatPanel` reads `selectedWorkspaceId` and `workspaces` from `useWorkspaceStore`, finds the workspace via `workspaces.find(w => w.id === selectedWorkspaceId)`, passes it to `ChatStatusBar` as a prop and `hasWorkspace` boolean to `MessageArea`.
- `ChatInputPlaceholder` has no data dependencies.
- `StatusIndicator` is imported from `src/components/sidebar/StatusIndicator` — no duplication.

## Out of Scope

- Agent message rendering (issue #28)
- Input submission, stop button, file attach (issue #26)
- Message persistence or store
- Keyboard shortcuts
