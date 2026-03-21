# Project Sidebar — Tree Structure with Status Indicators

**Issue:** #38
**Date:** 2026-03-20
**Status:** Approved

## Overview

The project sidebar renders a tree of projects and their workspaces inside the existing `SidebarFlyout` when `activePanel === "projects"`. It reads from `useProjectStore` and `useWorkspaceStore` (Zustand), displays workspace status indicators, and manages selection state.

## Component Structure

```
src/components/sidebar/
  ProjectTree.tsx          — tree container, fetches data, renders project list
  ProjectTree.css          — tree styles
  ProjectItem.tsx          — expandable project row with workspace children
  WorkspaceItem.tsx        — workspace row with status indicator
  StatusIndicator.tsx      — colored dot for workspace status
  StatusIndicator.css      — status indicator styles
```

### Responsibilities

- **ProjectTree**: Mounts inside `SidebarFlyout` when `activePanel === "projects"`. Calls `fetchProjects()` and `fetchWorkspaces()` (no argument — fetches all workspaces) on mount. Renders a list of `ProjectItem`s. Shows empty/error states.
- **ProjectItem**: Renders project name with expand/collapse toggle. When expanded, shows `WorkspaceItem`s filtered by `projectId`. Clicking the project name calls `setSelectedProjectId(id)` and auto-expands. Expand/collapse is local state (not persisted).
- **WorkspaceItem**: Renders `ticket` as primary text when non-null, otherwise `branch`. Shows `agentAdapter` value as secondary text (displayed verbatim). Includes a `StatusIndicator`. Clicking calls `setSelectedWorkspaceId(id)` and `setSelectedProjectId(parentProjectId)`.
- **StatusIndicator**: Maps workspace `status` string to a colored dot. Unknown status values fall back to gray (no animation).
  - `Idle` — gray
  - `Running` — blue with CSS pulse animation
  - `NeedsInput` — orange
  - `Error` — red

## Data Flow

- `ProjectTree` reads from both Zustand stores via hooks. No props passed from `SidebarFlyout`.
- Workspaces are grouped by `projectId` client-side using `workspaces.filter(w => w.projectId === project.id)`.
- Selection state (`selectedProjectId`, `selectedWorkspaceId`) lives in the existing stores. Clicking a workspace also sets its parent project as selected.
- The selected project and workspace get a highlight CSS class.

## Integration with SidebarFlyout

Modify `SidebarFlyout` to render `<ProjectTree />` when `activePanel === "projects"` instead of the generic placeholder paragraph. The flyout shell (header, close button, positioning) remains unchanged.

## Empty & Error States

- **No projects**: "No projects yet" muted text
- **No workspaces under a project**: "No workspaces" muted text under the expanded project
- **Loading**: No special treatment (fast enough for sidebar)
- **Error (e.g. IPC unavailable in Vite dev)**: Show the first non-null error from either store as a muted error line at top of tree

## Out of Scope

- Creating/editing/deleting projects or workspaces from the sidebar (CRUD UI is a separate issue)
- Drag-and-drop reordering
- Context menus (right-click actions)
- Search/filter within the tree
- Keyboard navigation
