# Input Area — Prompt Submission, Stop Button, File Attach

**Issue:** #26
**Date:** 2026-03-21
**Status:** Approved

## Overview

Replace `ChatInputPlaceholder` with a functional `ChatInput` component. The input supports typing a prompt, submitting it (Enter or click Send), a stop button to cancel a running agent, and a file attach button. Since the agent backend isn't wired yet, submission calls a callback prop; actual agent IPC comes later.

## Component

```
src/components/chat/
  ChatInput.tsx            — CREATE: textarea + send/stop/attach buttons
  ChatInput.css            — CREATE: input area styles
  ChatInputPlaceholder.tsx — DELETE: replaced by ChatInput
  ChatInputPlaceholder.css — DELETE: replaced by ChatInput
```

### ChatInput

**Props:**
- `onSubmit: (message: string) => void` — called when user submits a prompt
- `onStop: () => void` — called when user clicks stop
- `isRunning: boolean` — when true, show stop button instead of send
- `disabled: boolean` — when true (no workspace selected), disable all inputs

**Behavior:**
- Auto-resizing textarea (grows with content, max ~6 rows)
- **Enter** submits (unless Shift+Enter for newline)
- **Send button** submits and clears textarea
- **Stop button** (shown when `isRunning`) calls `onStop`, styled red/destructive
- **Attach button** (paperclip icon placeholder) — click does nothing for now, just visual. Real file selection comes with agent integration.
- Textarea clears after successful submit
- Disabled state: all inputs grayed out when no workspace selected

## Integration

- `ChatPanel` replaces `<ChatInputPlaceholder />` with `<ChatInput>`.
- `ChatPanel` passes `onSubmit` (currently a no-op `console.log`), `onStop` (no-op), `isRunning={false}`, and `disabled={workspace === null}`.
- When agent integration lands, `ChatPanel` will wire these to actual Tauri commands.
- Update `chat/index.ts` barrel: remove `ChatInputPlaceholder`, export `ChatInput`.

## Out of Scope

- Actual agent message sending (needs AgentManager #20)
- File picker / drag-and-drop upload
- Markdown preview in textarea
- Message history (up arrow to recall)
