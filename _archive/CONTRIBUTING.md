# Contributing to busydev

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

Run in development (full app with Tauri):

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

## Testing

Run frontend tests:

```bash
npm test              # single run
npm run test:watch    # watch mode
```

Run Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Run linting:

```bash
npm run lint          # ESLint (frontend)
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Clippy (backend)
```

Check formatting:

```bash
npm run format:check
```

## Local AI Config

This repo supports shared and local Claude configuration:

- Tracked shared defaults: `.claude/settings.shared.json` (no secrets).
- Ignored local override: `.claude/settings.local.json` (machine/user-specific).

Recommended setup for multiple worktrees:

- Keep one machine-level local file, for example: `~/.config/claude/busydev.local.json`
- Symlink each worktree's `.claude/settings.local.json` to that file

## Branch Naming

busydev uses [Conventional Branch](https://conventional-branch.github.io/) naming.

Rules:

- Use format: `<type>/<short-description>`
- Use lowercase and hyphen-separated description
- Keep branch names descriptive and concise
- Reference GitHub issue numbers where applicable (e.g., `feat/issue-37-layout`)

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

Commit message linting:

- Config file: `commitlint.config.cjs`
- Local range check:
  `npm run commitlint`
- PRs are validated in CI by `.github/workflows/commitlint.yml`

## Pull Requests

- Keep PRs scoped to one coherent change set
- Include what changed, why, and how it was validated
- Link related backlog items in PR description (without requiring ticket IDs in branch names)
- Prefer squash merges unless maintainers request otherwise

## Website and Docs Content

- Public site and docs content is powered by VitePress under `site/docs/`
- Primary pages:
  `site/docs/index.md`, `site/docs/getting-started.md`, `site/docs/setup.md`, `site/docs/core-workflows.md`
- Local preview:
  `npm run docs:dev`
- Production build:
  `npm run docs:build`
- Deployment is handled by `.github/workflows/site-pages.yml` on pushes to `main`

## CI/CD and Versioning

busydev will use automated versioning and release pipelines.

Current policy direction:

- Keep `package.json`, `Cargo.toml`, and `tauri.conf.json` versions synchronized
- Enforce branch protection with required checks
- Expand CI to include lint, test, and build verification
- Automate release/tag flow with version bump + changelog generation

Version source of truth:

- `package.json` is the canonical semver source.
- `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` must match it.
- Validate consistency with:
  `npm run version:check`
- Sync files to the canonical version with:
  `npm run version:sync`

Release management commands:

- Prepare next version (updates `package.json`, lockfile, Cargo + Tauri versions):
  `npm run release:prepare -- patch`
  (or `minor`, `major`, `prepatch`, `preminor`, `premajor`, `prerelease`)
- Tag current version:
  `npm run release:tag`
- One-shot release cut from a clean tree (prepare + commit + tag):
  `npm run release:cut -- patch`
- Regenerate changelog from conventional commits:
  `npm run changelog:generate`
- Preview recent changelog entries:
  `npm run changelog:preview`

Tagged release pipeline:

- Push a semantic version tag (for example, `v0.2.0`) to trigger `.github/workflows/release.yml`
- Release workflow builds Linux and macOS artifacts and publishes/updates a GitHub Release
- Release notes include a generated full changelog for the release range:
  merged PRs, linked issues, and notable breaking changes
- Manual reruns are available via `workflow_dispatch` on the release workflow

If a change affects release/version behavior, document it explicitly in the PR description.
