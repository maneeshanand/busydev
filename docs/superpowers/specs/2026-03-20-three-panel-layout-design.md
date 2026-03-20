# Three-Panel Resizable Layout — Design Spec

**Issue:** #37
**Date:** 2026-03-20
**Status:** Approved

## Overview

busydev's main window uses a hybrid three-panel layout: a fixed icon rail with expandable flyout sidebar, a resizable agent chat panel, and a resizable context panel (diff viewer + terminal). Built with `react-resizable-panels`.

## Panel Structure

```
┌──────┬─────────────────────────────┬────────────────────┐
│ Icon │                             │   Diff Viewer      │
│ Rail │      Agent Chat Panel       │────────────────────│
│(44px │      (resizable)            │   Terminal         │
│fixed)│                             │   (resizable)      │
└──────┴─────────────────────────────┴────────────────────┘
        ◄── flyout overlays here (absolute positioned)
```

- **Icon rail**: Fixed 44px width, not a resizable panel. Always visible. Contains icon buttons for Projects, Settings, etc.
- **Sidebar flyout**: Absolute-positioned overlay (200px wide, CSS variable `--flyout-width`), toggled by clicking an icon rail button. Does not push other panels — sits on top of the chat panel with `z-index`.
- **Chat panel**: Resizable, default ~55% of remaining width (after icon rail).
- **Context panel**: Resizable, default ~45%. Internally split vertically into Diff Viewer (60%) and Terminal (40%).

## Component Architecture

```
src/
  App.tsx                    — mounts AppLayout
  components/
    layout/
      AppLayout.tsx          — icon rail + PanelGroup (chat | context)
      IconRail.tsx           — fixed sidebar with icon buttons, manages flyout toggle
      SidebarFlyout.tsx      — absolute-positioned project tree overlay
      ChatPanel.tsx          — placeholder shell (content added by #27)
      ContextPanel.tsx       — vertical PanelGroup: DiffPanel + TerminalPanel
      DiffPanel.tsx          — placeholder (content added by #23)
      TerminalPanel.tsx      — placeholder (content added by #33)
```

### Responsibilities

- **AppLayout**: Top-level flex container. Renders `IconRail` (fixed) alongside a `PanelGroup` (horizontal) containing `ChatPanel` and `ContextPanel`. Also renders `SidebarFlyout` as an overlay.
- **IconRail**: Renders icon buttons. Manages `activePanel: string | null` state. Clicking an icon toggles the flyout; clicking the same icon again or pressing Escape closes it.
- **SidebarFlyout**: Receives `activePanel` and renders the corresponding content (initially just a project tree placeholder). Positioned absolute, z-indexed above chat panel. Clicking outside dismisses it (icon rail is excluded from "outside" — it has its own toggle logic).
- **ContextPanel**: Contains its own `PanelGroup` (vertical) with `DiffPanel` and `TerminalPanel`.
- **ChatPanel, DiffPanel, TerminalPanel**: Placeholder components rendering a styled container with a label. Will be filled by subsequent issues.

## Collapse & Resize Behavior

- **Panel persistence**: `autoSaveId` prop on both `PanelGroup` instances — `"busydev-main"` (horizontal) and `"busydev-context"` (vertical) — persists sizes to localStorage.
- **Collapsible panels**: Both chat and context panels use `collapsible={true}`, `collapsedSize={0}`, `minSize={20}` (percent).
- **Resize handles**: Custom `PanelResizeHandle` — 4px wide/tall, visible grab indicator on hover.
- **Flyout dismiss**: Click outside or press Escape closes the flyout. Same icon rail button toggles off.
- **No responsive breakpoints**: Desktop-only Tauri app. Collapsible panels handle narrow windows.

## Dependencies

- `react-resizable-panels` (already in package.json)
- No additional packages needed

## Integration Points

- Subsequent issues (#27, #23, #33, #38) will replace placeholder panel contents.
- Icon rail icons will use text labels or emoji placeholders for now (real icons decided when #38 lands).
- No Tauri IPC needed for this issue — purely frontend layout.

## Out of Scope

- Actual panel content (chat, diff, terminal, sidebar tree)
- Theming / dark mode toggle
- Responsive / mobile layout
- Keyboard navigation between panels
