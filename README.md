# busydev

A desktop app for running multiple AI coding agents in parallel.

## What It Does

- **Multi-agent support** — Run Codex and Claude Code side by side, each in its own tab
- **Parallel runs** — Submit prompts to multiple agents simultaneously
- **Human-readable event stream** — Agent messages, tool calls, file changes, and errors rendered with distinct visual treatment
- **Todo mode** — Define a checklist, the agent works through it and auto-checks completed items
- **Built-in terminal** — Interactive shell in the working directory, persists across panel toggles
- **Search** — Cmd/Ctrl+F to search across all agent output with highlighted matches
- **Inline controls** — Agent, model, approval policy, and sandbox mode selectable directly in the prompt composer
- **Session persistence** — Run history, todos, settings, and window size persist across restarts
- **Stop/cancel** — Stop any running agent via button, Esc, or Ctrl+C

## Tech Stack

- Rust + Tauri 2 (desktop backend)
- React + TypeScript + Vite (frontend)
- `portable-pty` + `xterm.js` (terminal)
- `tauri-plugin-store` (persistence)

## Getting Started

Prerequisites:

- Rust toolchain (`rustup`)
- Node.js 20+ and npm
- Tauri CLI (`cargo install tauri-cli --version '^2'`)
- macOS command line tools (`xcode-select --install`)
- At least one agent CLI: `codex` and/or `claude`

```bash
npm install
cargo tauri dev
```

## Versioning

All three version sources (package.json, Cargo.toml, tauri.conf.json) must stay in sync.

```bash
npm run version:check          # verify versions are in sync
npm run version:sync           # sync Cargo.toml + tauri.conf.json to package.json
npm run release:prepare patch  # bump version (patch/minor/major)
npm run release:cut patch      # bump, commit, and tag
```

Pushing to `main` auto-tags the next patch version and triggers the release workflow.

## Contributing

1. Browse [open issues](https://github.com/maneeshanand/busydev/issues)
2. Comment on one you'd like to take
3. Submit a PR — CI runs TypeScript checks and Rust builds on macOS

Use conventional commits: `feat(scope):`, `fix(scope):`, `chore(scope):`.

## License

MIT
