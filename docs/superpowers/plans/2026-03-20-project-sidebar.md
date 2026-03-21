# Project Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project/workspace tree inside the sidebar flyout with status indicators and selection state.

**Architecture:** New components in `src/components/sidebar/` render a tree from existing Zustand stores (`useProjectStore`, `useWorkspaceStore`). `SidebarFlyout` is modified to mount `ProjectTree` when `activePanel === "projects"`. Selection updates existing store state.

**Tech Stack:** React 19, TypeScript, Zustand, CSS

**Spec:** `docs/superpowers/specs/2026-03-20-project-sidebar-design.md`

**Working directory:** `/Users/maneesh/Documents/coding/busydev/.worktrees/frontend`

---

## File Structure

```
src/components/sidebar/
  StatusIndicator.tsx      — CREATE: colored dot mapping status to color
  StatusIndicator.css      — CREATE: dot styles + pulse animation
  WorkspaceItem.tsx        — CREATE: workspace row with status + selection
  WorkspaceItem.css        — CREATE: workspace row styles
  ProjectItem.tsx          — CREATE: expandable project row
  ProjectItem.css          — CREATE: project row styles
  ProjectTree.tsx          — CREATE: tree container, data fetching, empty/error states
  ProjectTree.css          — CREATE: tree container styles
  index.ts                 — MODIFY: export ProjectTree

src/components/layout/
  SidebarFlyout.tsx        — MODIFY: render ProjectTree when activePanel === "projects"
```

---

### Task 1: Create StatusIndicator component

**Files:**
- Create: `src/components/sidebar/StatusIndicator.tsx`
- Create: `src/components/sidebar/StatusIndicator.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/sidebar/StatusIndicator.tsx
import "./StatusIndicator.css";

const STATUS_COLORS: Record<string, string> = {
  Idle: "var(--status-idle, #666)",
  Running: "var(--status-running, #3b82f6)",
  NeedsInput: "var(--status-needs-input, #f59e0b)",
  Error: "var(--status-error, #ef4444)",
};

interface StatusIndicatorProps {
  status: string;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const color = STATUS_COLORS[status] ?? "var(--status-idle, #666)";
  const isRunning = status === "Running";

  return (
    <span
      className={`status-indicator ${isRunning ? "status-indicator--pulse" : ""}`}
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/sidebar/StatusIndicator.css */
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator--pulse {
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/StatusIndicator.tsx src/components/sidebar/StatusIndicator.css
git commit -m "feat(ui): add StatusIndicator component for workspace status dots"
```

---

### Task 2: Create WorkspaceItem component

**Files:**
- Create: `src/components/sidebar/WorkspaceItem.tsx`
- Create: `src/components/sidebar/WorkspaceItem.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/sidebar/WorkspaceItem.tsx
import type { Workspace } from "../../stores";
import { StatusIndicator } from "./StatusIndicator";
import "./WorkspaceItem.css";

interface WorkspaceItemProps {
  workspace: Workspace;
  isSelected: boolean;
  onSelect: (workspaceId: string, projectId: string) => void;
}

export function WorkspaceItem({ workspace, isSelected, onSelect }: WorkspaceItemProps) {
  const primaryText = workspace.ticket ?? workspace.branch;

  return (
    <button
      className={`workspace-item ${isSelected ? "workspace-item--selected" : ""}`}
      onClick={() => onSelect(workspace.id, workspace.projectId)}
    >
      <StatusIndicator status={workspace.status} />
      <div className="workspace-item__text">
        <span className="workspace-item__name">{primaryText}</span>
        <span className="workspace-item__adapter">{workspace.agentAdapter}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/sidebar/WorkspaceItem.css */
.workspace-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 8px 4px 24px;
  border: none;
  background: transparent;
  color: var(--text-muted, #888);
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
  transition: background 0.1s;
}

.workspace-item:hover {
  background: var(--rail-hover, #0f3460);
  color: var(--text-primary, #ccc);
}

.workspace-item--selected {
  background: var(--rail-active, #0f3460);
  color: var(--text-primary, #ccc);
}

.workspace-item__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.workspace-item__name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-item__adapter {
  font-size: 10px;
  opacity: 0.6;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/WorkspaceItem.tsx src/components/sidebar/WorkspaceItem.css
git commit -m "feat(ui): add WorkspaceItem component with status indicator"
```

---

### Task 3: Create ProjectItem component

**Files:**
- Create: `src/components/sidebar/ProjectItem.tsx`
- Create: `src/components/sidebar/ProjectItem.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/sidebar/ProjectItem.tsx
import { useState } from "react";
import type { Workspace } from "../../stores";
import { WorkspaceItem } from "./WorkspaceItem";
import "./ProjectItem.css";

interface ProjectItemProps {
  id: string;
  name: string;
  workspaces: Workspace[];
  isSelected: boolean;
  selectedWorkspaceId: string | null;
  onSelectProject: (id: string) => void;
  onSelectWorkspace: (workspaceId: string, projectId: string) => void;
}

export function ProjectItem({
  id,
  name,
  workspaces,
  isSelected,
  selectedWorkspaceId,
  onSelectProject,
  onSelectWorkspace,
}: ProjectItemProps) {
  const [expanded, setExpanded] = useState(false);

  function handleClick() {
    onSelectProject(id);
    setExpanded(true);
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }

  return (
    <div className="project-item">
      <button
        className={`project-item__header ${isSelected ? "project-item__header--selected" : ""}`}
        onClick={handleClick}
      >
        <span
          className={`project-item__chevron ${expanded ? "project-item__chevron--open" : ""}`}
          onClick={handleToggle}
        >
          {"\u25B6"}
        </span>
        <span className="project-item__name">{name}</span>
        <span className="project-item__count">{workspaces.length}</span>
      </button>
      {expanded && (
        <div className="project-item__children">
          {workspaces.length === 0 ? (
            <p className="project-item__empty">No workspaces</p>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceItem
                key={ws.id}
                workspace={ws}
                isSelected={selectedWorkspaceId === ws.id}
                onSelect={onSelectWorkspace}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/sidebar/ProjectItem.css */
.project-item__header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text-primary, #ccc);
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.1s;
}

.project-item__header:hover {
  background: var(--rail-hover, #0f3460);
}

.project-item__header--selected {
  background: var(--rail-active, #0f3460);
}

.project-item__chevron {
  font-size: 8px;
  transition: transform 0.15s;
  opacity: 0.6;
  padding: 2px;
}

.project-item__chevron--open {
  transform: rotate(90deg);
}

.project-item__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-item__count {
  font-size: 10px;
  opacity: 0.5;
}

.project-item__children {
  padding: 2px 0;
}

.project-item__empty {
  padding: 4px 8px 4px 32px;
  font-size: 11px;
  color: var(--text-muted, #666);
  opacity: 0.6;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/ProjectItem.tsx src/components/sidebar/ProjectItem.css
git commit -m "feat(ui): add ProjectItem component with expand/collapse"
```

---

### Task 4: Create ProjectTree component

**Files:**
- Create: `src/components/sidebar/ProjectTree.tsx`
- Create: `src/components/sidebar/ProjectTree.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/sidebar/ProjectTree.tsx
import { useEffect } from "react";
import { useProjectStore, useWorkspaceStore } from "../../stores";
import { ProjectItem } from "./ProjectItem";
import "./ProjectTree.css";

export function ProjectTree() {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    fetchProjects,
    error: projectError,
  } = useProjectStore();

  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    fetchWorkspaces,
    error: workspaceError,
  } = useWorkspaceStore();

  useEffect(() => {
    fetchProjects();
    fetchWorkspaces();
  }, [fetchProjects, fetchWorkspaces]);

  const error = projectError ?? workspaceError;

  function handleSelectWorkspace(workspaceId: string, projectId: string) {
    setSelectedWorkspaceId(workspaceId);
    setSelectedProjectId(projectId);
  }

  return (
    <div className="project-tree">
      {error && <p className="project-tree__error">{error}</p>}
      {projects.length === 0 && !error ? (
        <p className="project-tree__empty">No projects yet</p>
      ) : (
        projects.map((project) => (
          <ProjectItem
            key={project.id}
            id={project.id}
            name={project.name}
            workspaces={workspaces.filter((w) => w.projectId === project.id)}
            isSelected={selectedProjectId === project.id}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelectProject={setSelectedProjectId}
            onSelectWorkspace={handleSelectWorkspace}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/sidebar/ProjectTree.css */
.project-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-tree__empty {
  padding: 12px 0;
  font-size: 12px;
  color: var(--text-muted, #666);
  text-align: center;
  opacity: 0.6;
}

.project-tree__error {
  padding: 6px 8px;
  font-size: 11px;
  color: var(--status-error, #ef4444);
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  margin-bottom: 4px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/ProjectTree.tsx src/components/sidebar/ProjectTree.css
git commit -m "feat(ui): add ProjectTree component with data fetching and selection"
```

---

### Task 5: Update sidebar barrel export

**Files:**
- Modify: `src/components/sidebar/index.ts`

- [ ] **Step 1: Replace placeholder export**

```tsx
// src/components/sidebar/index.ts
export { ProjectTree } from "./ProjectTree";
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar/index.ts
git commit -m "feat(ui): export ProjectTree from sidebar barrel"
```

---

### Task 6: Wire ProjectTree into SidebarFlyout

**Files:**
- Modify: `src/components/layout/SidebarFlyout.tsx`

- [ ] **Step 1: Import ProjectTree and render conditionally**

Replace the placeholder paragraph in `SidebarFlyout` with a conditional render:

```tsx
// src/components/layout/SidebarFlyout.tsx
import { useEffect, useRef } from "react";
import { ProjectTree } from "../sidebar";
import "./SidebarFlyout.css";

interface SidebarFlyoutProps {
  activePanel: string | null;
  onClose: () => void;
}

export function SidebarFlyout({ activePanel, onClose }: SidebarFlyoutProps) {
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePanel) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        !target.closest(".icon-rail")
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activePanel, onClose]);

  if (!activePanel) return null;

  return (
    <div className="sidebar-flyout" ref={flyoutRef}>
      <div className="sidebar-flyout__header">
        <span className="sidebar-flyout__title">{activePanel}</span>
        <button className="sidebar-flyout__close" onClick={onClose}>
          {"\u2715"}
        </button>
      </div>
      <div className="sidebar-flyout__content">
        {activePanel === "projects" ? (
          <ProjectTree />
        ) : (
          <p className="sidebar-flyout__placeholder">
            {activePanel} panel content
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS variables for status colors to App.css**

Add these variables to the `:root` block in `src/App.css`:

```css
  /* Status colors */
  --status-idle: #666;
  --status-running: #3b82f6;
  --status-needs-input: #f59e0b;
  --status-error: #ef4444;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/maneesh/Documents/coding/busydev/.worktrees/frontend
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/SidebarFlyout.tsx src/App.css
git commit -m "feat(ui): wire ProjectTree into SidebarFlyout (#38)"
```

---

### Task 7: Visual verification

- [ ] **Step 1: Start dev server and verify**

```bash
cd /Users/maneesh/Documents/coding/busydev/.worktrees/frontend
npx vite --port 1421
```

Open http://localhost:1421 and verify:
- Click "P" icon in the rail — flyout opens showing "No projects yet" (no backend in Vite mode) or an error message
- Other icon buttons still show generic placeholder text
- Flyout header still says "projects" with close button
- Flyout dismiss (Escape / click-outside) still works
