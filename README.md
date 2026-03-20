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

## Current Status

busydev is in active development. The architecture and backlog are defined, and foundational implementation is underway.

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

Run in development:

```bash
cargo tauri dev
```

Build:

```bash
cargo tauri build
```

## Roadmap (High Level)

1. Repo health and project scaffolding
2. Data model + SQLite migrations
3. Three-panel UI shell
4. Git integration (worktrees, diffs, file watching)
5. Terminal manager + xterm integration
6. Agent manager + adapters (Codex/Claude)
7. Chat/diff UX polish
8. Notifications and settings

## Contributing

Contributions are welcome. We are building this in public and keeping the architecture modular so new contributors can pick up focused tickets quickly.

Please open an issue or pick from the busydev backlog in Linear, then submit a PR with a clear scope.
For workflow and branch conventions, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
