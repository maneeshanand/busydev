# Diff Viewer — File List, Unified Diff Display, Accept/Revert

**Issue:** #23
**Date:** 2026-03-21
**Status:** Approved

## Overview

Replace the DiffContent empty state with a functional diff viewer. Parses unified diff output from the `generate_unified_diff` Tauri command, displays a file list with expandable unified diffs, and provides accept/revert actions per file via `accept_file_changes` and `revert_file_changes` commands.

## Tauri Commands Available

- `generate_unified_diff({ repoPath, baseRef?, paths?, staged?, contextLines? })` → `string` (raw unified diff)
- `accept_file_changes({ repoPath, paths })` → `void` (git add)
- `revert_file_changes({ repoPath, paths })` → `void` (git reset + checkout)

## Components

```
src/components/diff/
  DiffHeader.tsx           — MODIFY: add refresh button
  DiffContent.tsx          — MODIFY: replace empty state with file list + diff display
  DiffContent.css          — MODIFY: add styles for file list and diff
  DiffFileItem.tsx         — CREATE: file entry with expand, accept/revert buttons
  DiffFileItem.css         — CREATE: file item styles
  UnifiedDiff.tsx          — CREATE: renders parsed hunks as colored +/- lines
  UnifiedDiff.css          — CREATE: diff line styles

src/lib/
  parseDiff.ts             — CREATE: parse unified diff string into structured data
```

### Data Types (`parseDiff.ts`)

```typescript
interface DiffHunk {
  header: string;        // @@ -1,3 +1,4 @@
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

interface DiffFile {
  path: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}
```

### Component Responsibilities

- **DiffHeader** (modified): Add a refresh button that re-fetches the diff.
- **DiffContent** (modified): When workspace is selected, calls `generate_unified_diff` via Tauri invoke using the workspace's `worktreePath` as `repoPath`. Parses the result with `parseDiff()`. Renders a list of `DiffFileItem`s. Shows "No changes" when diff is empty. Shows error state on IPC failure.
- **DiffFileItem**: Shows file path, +/- count, expand/collapse toggle. When expanded, renders `UnifiedDiff`. Has Accept and Revert buttons that call the respective Tauri commands.
- **UnifiedDiff**: Renders hunk headers and colored diff lines (green for add, red for remove, default for context). Monospace font, line numbers in gutter.

## Data Flow

- `DiffContent` fetches diff when `selectedWorkspaceId` changes (via `useEffect`).
- Workspace's `worktreePath` field provides the `repoPath` argument for Tauri commands.
- After accept/revert, `DiffContent` re-fetches the diff to reflect changes.
- No Zustand store for diff state — local component state is sufficient (diff data doesn't need to be shared).

## Out of Scope

- Syntax highlighting beyond +/- coloring
- Inline editing of diff content
- Side-by-side diff view
- Staging individual hunks (only whole-file accept/revert)
