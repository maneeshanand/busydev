# BusyDev Contributor Context

## Project Summary

BusyDev is an open-source desktop app for managing multiple AI coding agent sessions across repos and branches in parallel.

## Stack

- Backend: Rust (Tauri 2)
- Frontend: Vite + React + TypeScript
- State: Zustand
- Terminal: xterm.js + portable-pty
- Persistence: SQLite (rusqlite)

## Primary Commands

- Install dependencies: `npm install`
- Run app in dev: `cargo tauri dev`
- Build app: `cargo tauri build`
- Frontend lint: `npm run lint`
- Rust lint: `cargo clippy -- -D warnings`
- Rust tests: `cargo test`

## Directory Shape

- `src-tauri/`: Rust backend and Tauri integration
- `src/`: React frontend
- `src/components/`: UI components
- `src/stores/`: Zustand stores
- `src/hooks/`: Tauri invoke/listen hooks

## Conventions

- Rust naming: `snake_case` for variables/functions, `CamelCase` for types
- TypeScript naming: `camelCase` for variables/functions, `PascalCase` for components/types
- Keep IPC payloads explicit and typed
- Favor small, composable modules over large files

## Commit Message Format

Use conventional commits:

- `feat(scope): short description`
- `fix(scope): short description`
- `refactor(scope): short description`
- `docs(scope): short description`
- `test(scope): short description`
- `chore(scope): short description`

Suggested scopes: `agent`, `git`, `terminal`, `ui`, `db`, `notifications`, `settings`, `build`.
