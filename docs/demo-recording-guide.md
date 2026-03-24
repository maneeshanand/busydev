# busydev Demo Recording Guide

## Hero Demo (30-60s GIF for README)

Record one smooth flow: open busydev, add a project, type a prompt, agent streams output, completes with green checkmark, switch to Session 2 where another agent is already running. This single clip shows the core value prop: **parallel AI agents across sessions**.

---

## Feature Highlights (5-10s each)

| Feature | What to capture | Tip |
|---|---|---|
| **Project Tabs** | Add 3 projects, click between them — instant switch | Show different repos with recognizable names |
| **Parallel Sessions** | Split view: Session 1 finishing, Session 2 mid-stream | The spinner on one tab + checkmark on another tells the story |
| **Agent Streaming** | A real prompt with file edits, bash commands, green exit codes flowing in | Use something visual like "add dark mode support" |
| **Cmd+K Session Viewer** | Hit Cmd+K, type to filter, arrow down, Enter — jumps to session | Fast and snappy, shows power-user feel |
| **Todo Mode** | Open todo panel, generate todos from a goal, auto-play runs through them | The "auto-pilot" moment is the money shot |
| **Notifications** | Switch to Finder, agent finishes, macOS notification pops up, come back to bell badge | Shows you can walk away |
| **Tray Icon** | Hover tray showing "busydev (2)", click Show | Quick, 3 seconds |

---

## Screenshots (for docs site feature grid)

- Full app dark theme — the hero image
- Project tabs with 3-4 real project names
- Agent stream mid-run with colorful output (commands, file changes, success)
- Todo panel with mix of done/pending items
- Global Session Viewer with multiple sessions listed
- Notification toast stack (2-3 stacked)
- Settings panel

---

## Recording Tips

- **Use real repos** — "busydev", "api-server", "mobile-app" look better than "test-project"
- **Dark theme only** — it photographs better and matches the dev aesthetic
- **Window size ~1280x800** — standard for screenshots
- **Record at 2x then speed up** — gives smooth GIFs without jank
- **Keep GIFs under 5MB** — GitHub README renders them inline
- **Use the script** (`./scripts/record-demo.sh`) for consistent output paths and auto-GIF conversion

---

## Script Quick Reference

```bash
# Prerequisites
brew install ffmpeg imagemagick gifsicle

# Screenshots
./scripts/record-demo.sh screenshot app-overview
./scripts/record-demo.sh screenshot dark-theme
./scripts/record-demo.sh screenshot project-tabs
./scripts/record-demo.sh screenshot session-tabs
./scripts/record-demo.sh screenshot agent-stream
./scripts/record-demo.sh screenshot todo-panel
./scripts/record-demo.sh screenshot global-session-viewer
./scripts/record-demo.sh screenshot notification-toast
./scripts/record-demo.sh screenshot notification-panel
./scripts/record-demo.sh screenshot settings-panel
./scripts/record-demo.sh screenshot tray-icon

# Recordings (auto-generate GIFs on stop)
./scripts/record-demo.sh record add-project
# ... perform the action ...
./scripts/record-demo.sh stop

./scripts/record-demo.sh record agent-run
# ... type prompt, run agent, show streaming ...
./scripts/record-demo.sh stop

./scripts/record-demo.sh record parallel-sessions
# ... create session 2, run agents in both, switch ...
./scripts/record-demo.sh stop

./scripts/record-demo.sh record todo-mode
# ... open panel, add items, auto-play ...
./scripts/record-demo.sh stop

./scripts/record-demo.sh record session-viewer
# ... Cmd+K, filter, arrows, Enter ...
./scripts/record-demo.sh stop

./scripts/record-demo.sh record notifications
# ... switch away, agent finishes, toast + bell + tray ...
./scripts/record-demo.sh stop

# Convert existing video to GIF
./scripts/record-demo.sh gif path/to/video.mov 12

# List all captured assets
./scripts/record-demo.sh list
```

---

## Output

All assets save to `docs/public/demos/`. Reference in markdown as:

```markdown
![Feature name](/demos/feature-name.gif)
![Screenshot](/demos/screenshot-name.png)
```
