# Setup

Use this checklist to run busydev locally.

## Required tools

- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Node.js 20+ and npm
- Tauri CLI v2 (`cargo install tauri-cli --version '^2'`)
- macOS command line tools (`xcode-select --install`)

## Agent CLIs

Install at least one:

- **Codex**: `npm i -g @openai/codex`
- **Claude Code**: See [claude.com/claude-code](https://claude.com/claude-code)

## Useful commands

```bash
# Development
npm install              # install frontend deps
cargo tauri dev          # run app in dev mode
npm run build            # build frontend only

# Versioning
npm run version:check    # verify version sync
npm run release:cut patch # bump, commit, tag

# Docs
npm run docs:dev         # local VitePress dev server
npm run docs:build       # build docs site
```
