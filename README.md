# busydev

busydev is an open-source desktop app for running multiple AI coding agent sessions across repos and branches at the same time.

## Why busydev

If you use CLI agents (Codex, Claude Code, Aider, etc.) across several repos, you end up juggling terminal tabs, losing context, and missing when an agent needs attention. busydev gives you one place to coordinate all of that.

## What It Does

- Manage multiple projects and agent workspaces in one app
- Create isolated git worktrees per workspace automatically
- View agent chat output with status and usage context
- Review code changes in a built-in diff viewer
- Run integrated terminal tabs per workspace
- Get attention signals via in-app notifications and tray badge
- Stay LLM-agnostic through an adapter-based agent system

## Screenshot

> _Coming soon — the app is in active development._

## Website and Docs

Initial public website content for `busydev.com` now lives in `site/`:

- VitePress docs root: `site/docs/`
- Home/landing page: `site/docs/index.md`
- Getting started and setup guides: `site/docs/*.md`

Content is built with VitePress and deployed through `.github/workflows/site-pages.yml`.

## Current Status

busydev is in active development. Core UI and backend are implemented:

- Three-panel resizable layout (sidebar, chat, diff/terminal)
- Project and workspace management with SQLite persistence
- Agent chat with live event streaming (message, tool call, status)
- Unified diff viewer with per-file accept/revert
- xterm.js terminal integration with tab management
- Claude and Codex agent adapters
- Git worktree lifecycle management
- Settings panel with MCP server configuration
- Status bar with token usage and cost tracking

## Tech Stack

- Rust + Tauri 2 (desktop backend/runtime)
- React + TypeScript + Vite (frontend)
- Zustand (state management)
- SQLite via `rusqlite` (persistence)
- `portable-pty` + `xterm.js` (terminal integration)

## Getting Started (Dev)

Prerequisites:

- Rust toolchain
- Node.js + npm
- Tauri 2 CLI (`cargo install tauri-cli --version '^2'`)
- macOS command line tools (`xcode-select --install`)

Install dependencies:

```bash
npm install
```

Run frontend lint and tests:

```bash
npm run lint
npm test
```

Run in development:

```bash
cargo tauri dev
```

Run frontend only (no Tauri runtime):

```bash
npm run dev
```

Build:

```bash
cargo tauri build
```

## Contributing

Contributions are welcome. busydev is built in public with a modular architecture so contributors can pick up focused tickets.

1. Browse [open issues](https://github.com/maneeshanand/busydev/issues)
2. Comment on one you'd like to take
3. Submit a PR with a clear scope

For setup, conventions, and workflow details, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
