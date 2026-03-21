# Status Bar — Model, Context Usage, Cost Display

**Issue:** #45
**Date:** 2026-03-21
**Status:** Approved

## Overview

A thin bottom bar spanning the full app width, showing the active agent's model/adapter, token usage, and estimated cost. Reads from workspace and agent session state.

## Component

```
src/components/layout/
  StatusBar.tsx            — CREATE: bottom status bar
  StatusBar.css            — CREATE: status bar styles
  AppLayout.tsx            — MODIFY: add StatusBar below panels
  AppLayout.css            — MODIFY: adjust layout for bottom bar
```

### StatusBar

Displays left-to-right:
- **Left section:** Active workspace name (branch/ticket) + agent adapter name
- **Right section:** Token usage (`prompt / completion / total tokens`), estimated cost (`$0.0042`), agent status indicator

Reads from `useWorkspaceStore` for workspace info. Receives `usage` and `isRunning` as props from `AppLayout` (which will need to lift agent state up, or StatusBar reads from a shared source).

**Simpler approach:** StatusBar reads directly from stores. For token usage, since `useAgentStream` is local to ChatPanel, we'll add a lightweight Zustand slice for agent usage that the hook writes to and StatusBar reads from.

Actually — even simpler for now: StatusBar shows workspace info from the store, and for usage/cost, we add an `agentStore` with minimal state that `useAgentStream` updates.

## Data

- Workspace name: from `useWorkspaceStore` → `selectedWorkspaceId` → workspace
- Agent adapter: from workspace's `agentAdapter` field
- Token usage + cost: from new `useAgentStore` Zustand store
- Agent running status: from `useAgentStore`

## New Store

```
src/stores/agentStore.ts — CREATE: tracks active agent usage + running state
```

Minimal store:
- `isRunning: boolean`
- `usage: { promptTokens, completionTokens, totalTokens, estimatedCostUsd } | null`
- `setRunning(running: boolean)`
- `setUsage(usage)`

`useAgentStream` hook updates this store as a side effect. StatusBar reads from it.

## Out of Scope

- Model name display (adapter name is shown; actual model requires backend config)
- Context window percentage bar
- Click-to-copy cost
