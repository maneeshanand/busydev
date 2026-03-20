# Three-Panel Resizable Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the main app shell with a hybrid icon rail, expandable sidebar flyout, and two resizable panels (chat + context with diff/terminal split).

**Architecture:** Fixed icon rail (44px) on the left, with a `react-resizable-panels` horizontal group for chat and context panels. The context panel nests a vertical panel group for diff/terminal. A sidebar flyout overlays on demand via absolute positioning.

**Tech Stack:** React 19, TypeScript, react-resizable-panels, CSS modules (plain CSS files)

**Spec:** `docs/superpowers/specs/2026-03-20-three-panel-layout-design.md`

**Working directory:** `/Users/maneesh/Documents/coding/busydev/.worktrees/frontend`

---

## File Structure

```
src/
  App.tsx                          — MODIFY: replace scaffold with AppLayout mount
  App.css                          — MODIFY: replace scaffold styles with global reset/base
  components/
    layout/
      AppLayout.tsx                — CREATE: top-level flex container, icon rail + panels + flyout
      AppLayout.css                — CREATE: layout styles
      IconRail.tsx                 — CREATE: fixed icon rail with toggle buttons
      IconRail.css                 — CREATE: icon rail styles
      SidebarFlyout.tsx            — CREATE: overlay sidebar panel
      SidebarFlyout.css            — CREATE: flyout styles
      ChatPanel.tsx                — CREATE: placeholder chat panel
      ContextPanel.tsx             — CREATE: vertical Group with diff + terminal
      ContextPanel.css             — CREATE: context panel styles
      DiffPanel.tsx                — CREATE: placeholder diff viewer
      TerminalPanel.tsx            — CREATE: placeholder terminal
      ResizeHandle.tsx             — CREATE: custom styled Separator
      ResizeHandle.css             — CREATE: resize handle styles
      PlaceholderPanel.tsx         — CREATE: reusable placeholder component for empty panels
      PlaceholderPanel.css         — CREATE: placeholder styles
```

---

### Task 1: Create PlaceholderPanel component

**Files:**
- Create: `src/components/layout/PlaceholderPanel.tsx`
- Create: `src/components/layout/PlaceholderPanel.css`

This reusable component renders a labeled empty container. Used by ChatPanel, DiffPanel, and TerminalPanel.

- [ ] **Step 1: Create the component**

```tsx
// src/components/layout/PlaceholderPanel.tsx
import "./PlaceholderPanel.css";

interface PlaceholderPanelProps {
  label: string;
}

export function PlaceholderPanel({ label }: PlaceholderPanelProps) {
  return (
    <div className="placeholder-panel">
      <span className="placeholder-panel__label">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/layout/PlaceholderPanel.css */
.placeholder-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--panel-bg, #1a1a2e);
  color: var(--text-muted, #666);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  user-select: none;
}

.placeholder-panel__label {
  opacity: 0.6;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/PlaceholderPanel.tsx src/components/layout/PlaceholderPanel.css
git commit -m "feat(ui): add PlaceholderPanel component for empty panel states"
```

---

### Task 2: Create ResizeHandle component

**Files:**
- Create: `src/components/layout/ResizeHandle.tsx`
- Create: `src/components/layout/ResizeHandle.css`

Custom styled separator for `react-resizable-panels` v4.7.3. Note: v4.7.3 exports `Separator` (not `PanelResizeHandle`), and uses `data-separator` attribute for active styling.

- [ ] **Step 1: Create the component**

```tsx
// src/components/layout/ResizeHandle.tsx
import { Separator } from "react-resizable-panels";
import "./ResizeHandle.css";

interface ResizeHandleProps {
  orientation?: "horizontal" | "vertical";
}

export function ResizeHandle({ orientation = "horizontal" }: ResizeHandleProps) {
  return (
    <Separator
      className={`resize-handle resize-handle--${orientation}`}
    >
      <div className="resize-handle__indicator" />
    </Separator>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/layout/ResizeHandle.css */
.resize-handle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle--horizontal {
  width: 4px;
  cursor: col-resize;
}

.resize-handle--vertical {
  height: 4px;
  cursor: row-resize;
}

.resize-handle:hover,
.resize-handle[data-separator]:not([data-separator="disabled"]):active {
  background: var(--handle-active, #3b82f6);
}

.resize-handle__indicator {
  border-radius: 2px;
  background: var(--handle-color, #444);
  transition: background 0.15s;
}

.resize-handle--horizontal .resize-handle__indicator {
  width: 2px;
  height: 24px;
}

.resize-handle--vertical .resize-handle__indicator {
  height: 2px;
  width: 24px;
}

.resize-handle:hover .resize-handle__indicator,
.resize-handle[data-separator]:not([data-separator="disabled"]):active .resize-handle__indicator {
  background: var(--handle-active, #3b82f6);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ResizeHandle.tsx src/components/layout/ResizeHandle.css
git commit -m "feat(ui): add ResizeHandle component for panel resize controls"
```

---

### Task 3: Create ChatPanel, DiffPanel, TerminalPanel placeholders

**Files:**
- Create: `src/components/layout/ChatPanel.tsx`
- Create: `src/components/layout/DiffPanel.tsx`
- Create: `src/components/layout/TerminalPanel.tsx`

Thin wrappers around PlaceholderPanel with the correct labels.

- [ ] **Step 1: Create all three files**

```tsx
// src/components/layout/ChatPanel.tsx
import { PlaceholderPanel } from "./PlaceholderPanel";

export function ChatPanel() {
  return <PlaceholderPanel label="Agent Chat" />;
}
```

```tsx
// src/components/layout/DiffPanel.tsx
import { PlaceholderPanel } from "./PlaceholderPanel";

export function DiffPanel() {
  return <PlaceholderPanel label="Diff Viewer" />;
}
```

```tsx
// src/components/layout/TerminalPanel.tsx
import { PlaceholderPanel } from "./PlaceholderPanel";

export function TerminalPanel() {
  return <PlaceholderPanel label="Terminal" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/ChatPanel.tsx src/components/layout/DiffPanel.tsx src/components/layout/TerminalPanel.tsx
git commit -m "feat(ui): add placeholder ChatPanel, DiffPanel, TerminalPanel"
```

---

### Task 4: Create ContextPanel with vertical split

**Files:**
- Create: `src/components/layout/ContextPanel.tsx`
- Create: `src/components/layout/ContextPanel.css`

Nests a vertical `Group` containing DiffPanel (60%) and TerminalPanel (40%). Uses `useDefaultLayout` hook for localStorage persistence.

- [ ] **Step 1: Create the component**

```tsx
// src/components/layout/ContextPanel.tsx
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { DiffPanel } from "./DiffPanel";
import { TerminalPanel } from "./TerminalPanel";
import { ResizeHandle } from "./ResizeHandle";
import "./ContextPanel.css";

export function ContextPanel() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "busydev-context",
  });

  return (
    <div className="context-panel">
      <Group
        orientation="vertical"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel id="diff" defaultSize="60%" minSize="20%">
          <DiffPanel />
        </Panel>
        <ResizeHandle orientation="vertical" />
        <Panel id="terminal" defaultSize="40%" minSize="20%">
          <TerminalPanel />
        </Panel>
      </Group>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/layout/ContextPanel.css */
.context-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ContextPanel.tsx src/components/layout/ContextPanel.css
git commit -m "feat(ui): add ContextPanel with vertical diff/terminal split"
```

---

### Task 5: Create IconRail component

**Files:**
- Create: `src/components/layout/IconRail.tsx`
- Create: `src/components/layout/IconRail.css`

Fixed 44px sidebar with icon buttons. Manages flyout toggle state.

- [ ] **Step 1: Create the component**

```tsx
// src/components/layout/IconRail.tsx
import "./IconRail.css";

interface IconRailProps {
  activePanel: string | null;
  onTogglePanel: (panel: string) => void;
}

const ICONS = [
  { id: "projects", label: "P" },
  { id: "search", label: "S" },
  { id: "settings", label: "⚙" },
];

export function IconRail({ activePanel, onTogglePanel }: IconRailProps) {
  return (
    <nav className="icon-rail">
      {ICONS.map((icon) => (
        <button
          key={icon.id}
          className={`icon-rail__button ${
            activePanel === icon.id ? "icon-rail__button--active" : ""
          }`}
          onClick={() => onTogglePanel(icon.id)}
          title={icon.id}
        >
          {icon.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/layout/IconRail.css */
.icon-rail {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
  background: var(--rail-bg, #16213e);
  border-right: 1px solid var(--border-color, #0f3460);
}

.icon-rail__button {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #888);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.icon-rail__button:hover {
  background: var(--rail-hover, #0f3460);
  color: var(--text-primary, #ccc);
}

.icon-rail__button--active {
  background: var(--rail-active, #0f3460);
  color: var(--text-primary, #ccc);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/IconRail.tsx src/components/layout/IconRail.css
git commit -m "feat(ui): add IconRail component with toggle buttons"
```

---

### Task 6: Create SidebarFlyout component

**Files:**
- Create: `src/components/layout/SidebarFlyout.tsx`
- Create: `src/components/layout/SidebarFlyout.css`

Absolute-positioned overlay that renders based on `activePanel`. Dismisses on Escape or click outside (excluding icon rail).

- [ ] **Step 1: Create the component**

```tsx
// src/components/layout/SidebarFlyout.tsx
import { useEffect, useRef } from "react";
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
          ✕
        </button>
      </div>
      <div className="sidebar-flyout__content">
        <p className="sidebar-flyout__placeholder">
          {activePanel} panel content
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/layout/SidebarFlyout.css */
.sidebar-flyout {
  --flyout-width: 200px;
  position: absolute;
  top: 0;
  left: 44px;
  width: var(--flyout-width);
  height: 100%;
  background: var(--flyout-bg, #16213e);
  border-right: 1px solid var(--border-color, #0f3460);
  z-index: 10;
  display: flex;
  flex-direction: column;
}

.sidebar-flyout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #0f3460);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--text-muted, #888);
}

.sidebar-flyout__close {
  background: none;
  border: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
}

.sidebar-flyout__close:hover {
  background: var(--rail-hover, #0f3460);
  color: var(--text-primary, #ccc);
}

.sidebar-flyout__content {
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
}

.sidebar-flyout__placeholder {
  color: var(--text-muted, #666);
  font-size: 12px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SidebarFlyout.tsx src/components/layout/SidebarFlyout.css
git commit -m "feat(ui): add SidebarFlyout overlay component"
```

---

### Task 7: Create AppLayout and wire everything together

**Files:**
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/AppLayout.css`

Top-level layout: flex container with icon rail (fixed) + panel group (flex) + flyout (absolute).

- [ ] **Step 1: Create the component**

```tsx
// src/components/layout/AppLayout.tsx
import { useCallback, useState } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { IconRail } from "./IconRail";
import { SidebarFlyout } from "./SidebarFlyout";
import { ChatPanel } from "./ChatPanel";
import { ContextPanel } from "./ContextPanel";
import { ResizeHandle } from "./ResizeHandle";
import "./AppLayout.css";

export function AppLayout() {
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "busydev-main",
  });

  const handleTogglePanel = useCallback((panel: string) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleCloseFlyout = useCallback(() => {
    setActivePanel(null);
  }, []);

  return (
    <div className="app-layout">
      <IconRail activePanel={activePanel} onTogglePanel={handleTogglePanel} />
      <div className="app-layout__panels">
        <SidebarFlyout activePanel={activePanel} onClose={handleCloseFlyout} />
        <Group
          orientation="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel id="chat" defaultSize="55%" minSize="20%" collapsible collapsedSize="0%">
            <ChatPanel />
          </Panel>
          <ResizeHandle orientation="horizontal" />
          <Panel id="context" defaultSize="45%" minSize="20%" collapsible collapsedSize="0%">
            <ContextPanel />
          </Panel>
        </Group>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/layout/AppLayout.css */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--app-bg, #1a1a2e);
}

.app-layout__panels {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppLayout.tsx src/components/layout/AppLayout.css
git commit -m "feat(ui): add AppLayout with icon rail + resizable panels + flyout"
```

---

### Task 8: Replace App.tsx scaffold and update styles

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

Replace the Tauri boilerplate with AppLayout mount. Strip scaffold styles, keep global reset and CSS variables.

- [ ] **Step 1: Replace App.tsx**

```tsx
// src/App.tsx
import { AppLayout } from "./components/layout/AppLayout";
import "./App.css";

function App() {
  return <AppLayout />;
}

export default App;
```

- [ ] **Step 2: Replace App.css with global reset and CSS variables**

```css
/* src/App.css — global reset and theme variables */
:root {
  /* Theme colors */
  --app-bg: #1a1a2e;
  --panel-bg: #1a1a2e;
  --rail-bg: #16213e;
  --rail-hover: #0f3460;
  --rail-active: #0f3460;
  --flyout-bg: #16213e;
  --border-color: #0f3460;
  --handle-color: #444;
  --handle-active: #3b82f6;
  --text-primary: #ccc;
  --text-muted: #888;

  /* Typography */
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
  color: var(--text-primary);
  background-color: var(--app-bg);

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
```

- [ ] **Step 3: Remove unused assets**

Delete `src/assets/react.svg` since the scaffold is removed. The `public/vite.svg` and `public/tauri.svg` can stay — they don't affect the build.

```bash
rm src/assets/react.svg
```

- [ ] **Step 4: Verify the app builds**

```bash
cd /Users/maneesh/Documents/coding/busydev/.worktrees/frontend
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css
git rm src/assets/react.svg
git commit -m "feat(ui): replace scaffold with three-panel layout shell (#37)"
```

---

### Task 9: Visual verification

- [ ] **Step 1: Verify layout renders correctly**

If `cargo tauri dev` is available, run it. Otherwise verify with Vite dev server:

```bash
cd /Users/maneesh/Documents/coding/busydev/.worktrees/frontend
npm run dev
```

Open in browser and verify:
- Icon rail visible on left (44px, dark background, 3 buttons)
- Chat panel and context panel fill remaining space
- Context panel split into diff viewer (top) and terminal (bottom)
- Resize handles work between chat/context and diff/terminal
- Clicking icon rail buttons toggles flyout overlay
- Flyout dismisses on Escape and click-outside
- Panels collapse when dragged to minimum
- Panel sizes persist on page reload (localStorage)

- [ ] **Step 2: Commit .gitignore change**

```bash
git add .gitignore
git commit -m "chore(build): add .superpowers/ to gitignore"
```
