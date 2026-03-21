# xterm.js Frontend Integration + Terminal Tabs

**Issue:** #33
**Date:** 2026-03-21
**Status:** Approved

## Overview

Integrate xterm.js into the terminal panel with tab management. Each workspace can have multiple terminal sessions. Tabs allow switching between sessions and creating/closing them. The xterm.js instance mounts in the terminal content area and resizes with the panel via the fit addon.

**Note:** The backend PTY manager (`TerminalManager`) supports create/list/resize/close but does not yet expose PTY read/write via Tauri events. The xterm.js terminal will mount and resize correctly, but actual I/O (typing, output) requires a follow-up backend ticket to stream data between the PTY and frontend.

## Tauri Commands Available

- `create_terminal_session({ cwd, shell?, cols?, rows? })` → `TerminalSession { id, cwd, shell, cols, rows }`
- `list_terminal_sessions()` → `TerminalSession[]`
- `resize_terminal_session({ id, cols, rows })` → `TerminalSession`
- `close_terminal_session({ id })` → `void`

## Components

```
src/components/terminal/
  TerminalTabBar.tsx       — MODIFY: real tab management with add/close
  TerminalTabBar.css       — MODIFY: tab styles
  TerminalContent.tsx      — MODIFY: mount xterm.js instance
  TerminalContent.css      — MODIFY: xterm container styles
  useTerminalSession.ts    — CREATE: hook managing session lifecycle + xterm instance
```

### Component Responsibilities

- **TerminalTabBar** (modified): Renders tabs for each terminal session. Active tab is highlighted. "+" button creates a new session. Each tab has a close "x" button. Receives `sessions`, `activeSessionId`, `onSelectSession`, `onCreateSession`, `onCloseSession` as props.
- **TerminalContent** (modified): Mounts an xterm.js `Terminal` instance into a container div. Uses `@xterm/addon-fit` to auto-resize when the panel resizes (via `ResizeObserver`). Calls `resize_terminal_session` Tauri command when terminal dimensions change. Shows a placeholder message when no active session.
- **useTerminalSession** (hook): Manages terminal sessions for the selected workspace. Creates a session on demand, tracks active session ID, provides create/close/select handlers. Calls Tauri commands for lifecycle.

## Data Flow

- `TerminalPanel` (layout) passes `workspace` to `TerminalContent`.
- `useTerminalSession` hook manages session state (list of sessions, active ID).
- When user clicks "+", hook calls `create_terminal_session` with workspace's `worktreePath` as cwd.
- When panel resizes, `FitAddon.fit()` recalculates cols/rows and calls `resize_terminal_session`.
- xterm.js `Terminal` instance is created per session, stored in a ref map keyed by session ID.
- Tab switching swaps which xterm instance is visible (show/hide via DOM, not destroy/recreate).

## xterm.js Setup

- Import `Terminal` from `@xterm/xterm` and `FitAddon` from `@xterm/addon-fit`
- Import xterm.css: `@xterm/xterm/css/xterm.css`
- Theme: dark background matching `--panel-bg`, cursor color matching `--handle-active`
- Font: "SF Mono", "Fira Code", monospace, 13px

## Out of Scope

- PTY read/write streaming (requires backend Tauri event bridge)
- Terminal search (Ctrl+F)
- Terminal copy/paste customization
- Split terminal panes within a tab
