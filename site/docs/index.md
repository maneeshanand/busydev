---
layout: home

hero:
  name: "busydev"
  text: "Run multiple AI coding agents in parallel."
  tagline: "A desktop app for Codex, Claude Code, and other CLI agents."
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: Core Workflows
      link: /core-workflows

features:
  - title: Multi-agent tabs
    details: Run Codex and Claude Code side by side, each in its own tab with independent streaming.
  - title: Todo mode
    details: Define a checklist and let the agent work through it — auto-checks completed items.
  - title: Built-in terminal
    details: Interactive shell in the working directory, persists across panel toggles.
  - title: Human-readable stream
    details: Agent messages, tool calls, file changes, and errors rendered with distinct visual treatment.
---

<script setup>
import pkg from "../../package.json";
</script>

<div style="margin-top: 1rem; margin-bottom: 1.25rem;">
  <span style="display:inline-block;padding:0.35rem 0.65rem;border:1px solid var(--vp-c-divider);border-radius:999px;font-size:0.84rem;color:var(--vp-c-text-2);background:var(--vp-c-bg-soft);">
    Current release: <strong style="color:var(--vp-c-text-1)">v{{ pkg.version }}</strong>
  </span>
</div>

## Supported Platforms

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;margin-top:0.75rem;">
  <div style="display:flex;align-items:center;gap:0.6rem;padding:0.8rem;border:1px solid var(--vp-c-divider);border-radius:10px;background:var(--vp-c-bg-soft);">
    <img src="https://cdn.simpleicons.org/apple/111111" alt="Apple logo" width="20" height="20" />
    <div>
      <div style="font-weight:600;">Mac OS x86</div>
      <div style="font-size:0.84rem;color:var(--vp-c-text-2);">Intel Macs</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:0.6rem;padding:0.8rem;border:1px solid var(--vp-c-divider);border-radius:10px;background:var(--vp-c-bg-soft);">
    <img src="https://cdn.simpleicons.org/apple/111111" alt="Apple logo" width="20" height="20" />
    <div>
      <div style="font-weight:600;">Mac OS Apple Silicon</div>
      <div style="font-size:0.84rem;color:var(--vp-c-text-2);">M1 / M2 / M3 / M4</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:0.6rem;padding:0.8rem;border:1px solid var(--vp-c-divider);border-radius:10px;background:var(--vp-c-bg-soft);">
    <img src="https://cdn.simpleicons.org/ubuntu/E95420" alt="Ubuntu logo" width="20" height="20" />
    <div>
      <div style="font-weight:600;">Linux / Ubuntu</div>
      <div style="font-size:0.84rem;color:var(--vp-c-text-2);">Debian-family distros</div>
    </div>
  </div>
</div>
