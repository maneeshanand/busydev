# Chat Panel Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder ChatPanel with a three-zone shell: status bar, message area, and input placeholder.

**Architecture:** Three new components in `src/components/chat/` compose inside the existing `ChatPanel` layout slot. `ChatPanel` reads workspace selection from the Zustand store and passes data down as props. `StatusIndicator` is reused from the sidebar.

**Tech Stack:** React 19, TypeScript, Zustand, CSS

**Spec:** `docs/superpowers/specs/2026-03-21-chat-panel-shell-design.md`

**Working directory:** `/Users/maneesh/Documents/coding/busydev/.worktrees/frontend`

---

## File Structure

```
src/components/chat/
  ChatStatusBar.tsx        — CREATE: workspace context bar
  ChatStatusBar.css        — CREATE: status bar styles
  MessageArea.tsx          — CREATE: scrollable empty-state container
  MessageArea.css          — CREATE: message area styles
  ChatInputPlaceholder.tsx — CREATE: disabled textarea + send button
  ChatInputPlaceholder.css — CREATE: input placeholder styles
  index.ts                 — MODIFY: export new components

src/components/layout/
  ChatPanel.tsx            — MODIFY: replace PlaceholderPanel with chat shell
  ChatPanel.css            — CREATE: chat panel layout styles
```

---

### Task 1: Create ChatStatusBar component

**Files:**
- Create: `src/components/chat/ChatStatusBar.tsx`
- Create: `src/components/chat/ChatStatusBar.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/chat/ChatStatusBar.tsx
import type { Workspace } from "../../stores";
import { StatusIndicator } from "../sidebar/StatusIndicator";
import "./ChatStatusBar.css";

interface ChatStatusBarProps {
  workspace: Workspace | null;
}

export function ChatStatusBar({ workspace }: ChatStatusBarProps) {
  if (!workspace) {
    return (
      <div className="chat-status-bar">
        <span className="chat-status-bar__empty">No workspace selected</span>
      </div>
    );
  }

  const primaryText = workspace.ticket ?? workspace.branch;

  return (
    <div className="chat-status-bar">
      <StatusIndicator status={workspace.status} />
      <span className="chat-status-bar__name">{primaryText}</span>
      <span className="chat-status-bar__adapter">{workspace.agentAdapter}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/chat/ChatStatusBar.css */
.chat-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #0f3460);
  background: var(--rail-bg, #16213e);
  flex-shrink: 0;
}

.chat-status-bar__empty {
  font-size: 12px;
  color: var(--text-muted, #888);
}

.chat-status-bar__name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #ccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-status-bar__adapter {
  font-size: 11px;
  color: var(--text-muted, #888);
  margin-left: auto;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatStatusBar.tsx src/components/chat/ChatStatusBar.css
git commit -m "feat(ui): add ChatStatusBar component with workspace context"
```

---

### Task 2: Create MessageArea component

**Files:**
- Create: `src/components/chat/MessageArea.tsx`
- Create: `src/components/chat/MessageArea.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/chat/MessageArea.tsx
import "./MessageArea.css";

interface MessageAreaProps {
  hasWorkspace: boolean;
}

export function MessageArea({ hasWorkspace }: MessageAreaProps) {
  return (
    <div className="message-area">
      <p className="message-area__empty">
        {hasWorkspace
          ? "No messages yet"
          : "Select a workspace to start chatting"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/chat/MessageArea.css */
.message-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-area__empty {
  font-size: 13px;
  color: var(--text-muted, #888);
  opacity: 0.6;
  text-align: center;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MessageArea.tsx src/components/chat/MessageArea.css
git commit -m "feat(ui): add MessageArea component with empty states"
```

---

### Task 3: Create ChatInputPlaceholder component

**Files:**
- Create: `src/components/chat/ChatInputPlaceholder.tsx`
- Create: `src/components/chat/ChatInputPlaceholder.css`

- [ ] **Step 1: Create the component**

```tsx
// src/components/chat/ChatInputPlaceholder.tsx
import "./ChatInputPlaceholder.css";

export function ChatInputPlaceholder() {
  return (
    <div className="chat-input-placeholder">
      <textarea
        className="chat-input-placeholder__textarea"
        placeholder="Type a message..."
        disabled
        rows={2}
      />
      <button className="chat-input-placeholder__send" disabled>
        Send
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/components/chat/ChatInputPlaceholder.css */
.chat-input-placeholder {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color, #0f3460);
  background: var(--rail-bg, #16213e);
  flex-shrink: 0;
}

.chat-input-placeholder__textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--border-color, #0f3460);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  background: var(--panel-bg, #1a1a2e);
  color: var(--text-muted, #888);
  outline: none;
  opacity: 0.5;
}

.chat-input-placeholder__send {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: var(--handle-active, #3b82f6);
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.4;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatInputPlaceholder.tsx src/components/chat/ChatInputPlaceholder.css
git commit -m "feat(ui): add ChatInputPlaceholder component"
```

---

### Task 4: Update chat barrel export

**Files:**
- Modify: `src/components/chat/index.ts`

- [ ] **Step 1: Replace placeholder export**

```tsx
// src/components/chat/index.ts
export { ChatStatusBar } from "./ChatStatusBar";
export { MessageArea } from "./MessageArea";
export { ChatInputPlaceholder } from "./ChatInputPlaceholder";
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/index.ts
git commit -m "feat(ui): export chat components from barrel"
```

---

### Task 5: Update ChatPanel to use chat components

**Files:**
- Modify: `src/components/layout/ChatPanel.tsx`
- Create: `src/components/layout/ChatPanel.css`

- [ ] **Step 1: Replace ChatPanel**

```tsx
// src/components/layout/ChatPanel.tsx
import { useWorkspaceStore } from "../../stores";
import { ChatStatusBar, MessageArea, ChatInputPlaceholder } from "../chat";
import "./ChatPanel.css";

export function ChatPanel() {
  const { workspaces, selectedWorkspaceId } = useWorkspaceStore();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? null;

  return (
    <div className="chat-panel">
      <ChatStatusBar workspace={workspace} />
      <MessageArea hasWorkspace={workspace !== null} />
      <ChatInputPlaceholder />
    </div>
  );
}
```

- [ ] **Step 2: Create the layout styles**

```css
/* src/components/layout/ChatPanel.css */
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel-bg, #1a1a2e);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/maneesh/Documents/coding/busydev/.worktrees/frontend
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ChatPanel.tsx src/components/layout/ChatPanel.css
git commit -m "feat(ui): replace placeholder ChatPanel with chat shell (#27)"
```

---

### Task 6: Visual verification

- [ ] **Step 1: Start dev server and verify**

```bash
cd /Users/maneesh/Documents/coding/busydev/.worktrees/frontend
npx vite --port 1421
```

Open http://localhost:1421 and verify:
- Chat panel shows three zones: status bar (top), message area (center), input (bottom)
- Status bar says "No workspace selected" (no Tauri backend)
- Message area says "Select a workspace to start chatting"
- Input textarea is disabled with placeholder text, send button is muted
- Resize handles still work between chat and context panels
