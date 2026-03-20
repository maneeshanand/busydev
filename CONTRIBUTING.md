# Contributing to BusyDev

Thanks for contributing. This project is being built in public, and small, focused changes are preferred.

## Prerequisites

- Rust toolchain (`rustc`, `cargo`)
- Node.js + npm
- Tauri CLI v2 (`cargo install tauri-cli --version '^2'`)
- macOS command line tools (`xcode-select --install`)

## Local Development

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

## Branch Naming

BusyDev uses [Conventional Branch](https://conventional-branch.github.io/) naming.

Rules:

- Use format: `<type>/<short-description>`
- Use lowercase and hyphen-separated description
- Keep branch names descriptive and concise
- Do not include private Linear ticket IDs in branch names

Examples:

- `feat/workspace-crud`
- `fix/terminal-resize-event-order`
- `chore/repo-hygiene-docs-foundation`

## Commit Messages

Use conventional commits:

- `feat(scope): description`
- `fix(scope): description`
- `refactor(scope): description`
- `docs(scope): description`
- `test(scope): description`
- `ci(scope): description`
- `chore(scope): description`

Suggested scopes: `agent`, `git`, `terminal`, `ui`, `db`, `notifications`, `settings`, `build`, `docs`.

## Pull Requests

- Keep PRs scoped to one coherent change set
- Include what changed, why, and how it was validated
- Link related backlog items in PR description (without requiring ticket IDs in branch names)
- Prefer squash merges unless maintainers request otherwise

## CI/CD and Versioning

BusyDev will use automated versioning and release pipelines.

Current policy direction:

- Keep `package.json`, `Cargo.toml`, and `tauri.conf.json` versions synchronized
- Enforce branch protection with required checks
- Expand CI to include lint, test, and build verification
- Automate release/tag flow with version bump + changelog generation

If a change affects release/version behavior, document it explicitly in the PR description.
