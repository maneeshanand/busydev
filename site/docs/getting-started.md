# Getting Started

busydev is a desktop app for running multiple AI coding agents in parallel.

## Prerequisites

- Rust toolchain (`rustup`)
- Node.js 20+ and npm
- Tauri CLI (`cargo install tauri-cli --version '^2'`)
- macOS command line tools (`xcode-select --install`)
- At least one agent CLI: `codex` and/or `claude`

## Install and run

```bash
npm install
cargo tauri dev
```

## First-time flow

1. Set a working directory using the folder icon.
2. Pick an agent (Codex or Claude Code) and model from the prompt composer.
3. Type a prompt and hit Enter or click Run.
4. Watch the agent work in the event stream.
5. Open the terminal panel to run commands alongside the agent.
6. Toggle Todo mode to define a checklist the agent works through.

Continue to [Setup](./setup.md) for full local environment details.
