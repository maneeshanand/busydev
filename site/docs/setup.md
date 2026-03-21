# Setup

Use this checklist to run busydev locally.

## Required tools

- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Node.js + npm
- Tauri CLI v2 (`cargo install tauri-cli --version '^2'`)
- macOS command line tools (`xcode-select --install`) when on macOS

## Useful commands

```bash
npm run lint
npm run test
cargo test --manifest-path src-tauri/Cargo.toml
cargo tauri build
```
