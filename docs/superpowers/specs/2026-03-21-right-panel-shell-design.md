# Right Panel Shell — Diff Viewer + Terminal Split

**Issue:** #25
**Date:** 2026-03-21
**Status:** Approved

## Overview

Replace the placeholder `DiffPanel` and `TerminalPanel` with structured shells. Each gets a header bar and empty-state content area. Real diff rendering (#23) and xterm.js (#33) land in subsequent issues.

## Components

### DiffPanel shell (`src/components/diff/`)

- **DiffHeader**: Shows "Changes" label and a file count badge (0 for now). Reads from `useWorkspaceStore` to show context. When no workspace selected, shows "No workspace".
- **DiffContent**: Empty state — "No changes to review" when workspace selected, "Select a workspace to view changes" when not. Scrollable container for future file list + unified diff (#23).

### TerminalPanel shell (`src/components/terminal/`)

- **TerminalTabBar**: Shows a single placeholder tab "Terminal" (real tabs from #33). Static, no tab switching logic.
- **TerminalContent**: Empty state — "No terminal session" when workspace selected, "Select a workspace" when not. Container for future xterm.js mount (#33).

### Modified (`src/components/layout/`)

- **DiffPanel.tsx**: Replace `PlaceholderPanel` with `DiffHeader` + `DiffContent` in vertical flex.
- **TerminalPanel.tsx**: Replace `PlaceholderPanel` with `TerminalTabBar` + `TerminalContent` in vertical flex.

## Data Flow

- Both `DiffPanel` and `TerminalPanel` read `selectedWorkspaceId` from `useWorkspaceStore` and pass `hasWorkspace` boolean to their content components.
- Headers/tab bars are mostly static for now.

## Out of Scope

- File list, unified diff rendering, accept/revert (issue #23)
- xterm.js integration, real terminal tabs (issue #33)
- Terminal session management
