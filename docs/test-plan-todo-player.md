# Test Plan: Todo Player & Goal Breakdown

## Setup
- `cargo tauri dev`
- Set a working directory (any git repo)
- Select an agent (Claude or Codex) and set approval to full-auto

---

## 1. Goal Breakdown (Empty State)

- [ ] Open todo panel (checklist icon in header)
- [ ] Panel shows "What do you want to build?" with input field
- [ ] Type "add user authentication with JWT tokens" and click Generate
- [ ] Agent runs, todos appear in the panel via ADD_TODO markers
- [ ] Todos are editable (double-click to edit)
- [ ] Verify no brainstorming/skills activation — just a direct list

## 2. Goal Breakdown (Existing Todos)

- [ ] With todos already in the list, click "+AI" in header
- [ ] Goal input bar appears above the todo list
- [ ] Type "also add rate limiting" and press Enter
- [ ] New todos appended — existing ones preserved
- [ ] Press Escape to dismiss goal bar without generating

## 3. Manual Todo Management

- [ ] Add a todo manually via "Add a todo..." input
- [ ] Check/uncheck a todo via checkbox
- [ ] Double-click a todo to edit text, press Enter to save
- [ ] Press Escape to cancel edit
- [ ] Delete a todo via × button (hover to reveal)

## 4. Drag and Drop Reorder

- [ ] Hover over a pending todo — grip handle (⠿) appears
- [ ] Mousedown on grip, drag to another item, release
- [ ] Items reorder correctly
- [ ] Completed (checked) items don't show grip handle
- [ ] Dropping outside cancels the drag

## 5. Player Controls — Single Run

- [ ] With pending todos, click Play button
- [ ] Agent runs on the FIRST pending todo specifically (check stream prompt)
- [ ] After completion, todo gets auto-checked
- [ ] Agent stops — does NOT auto-advance to next (auto-play OFF)
- [ ] Click Play again — runs the next pending todo
- [ ] "N left" counter updates correctly

## 6. Player Controls — Auto-Play

- [ ] Click the skip icon (⏭) to enable auto-play — button turns blue
- [ ] Click Play — agent runs first todo
- [ ] After completion, agent auto-starts the next todo (~1s delay)
- [ ] Continues until all todos done or you click Stop
- [ ] Click Stop mid-run — current run stops, auto-play continues to be ON
- [ ] Click skip icon again to disable auto-play — button returns to default

## 7. Stop/Cancel

- [ ] While a todo is running, click Stop (pause icon) — run stops
- [ ] Footer shows "Stopped after Xs"
- [ ] Todo that was being worked on does NOT get auto-checked
- [ ] Esc key also stops the active run
- [ ] Ctrl+C also stops the active run

## 8. Clear All

- [ ] Click × (clear) icon in header
- [ ] All todos removed
- [ ] Auto-play turns off
- [ ] Panel returns to empty state with goal input
- [ ] Clear button not visible while a run is active

## 9. Save as JSON

- [ ] Add several todos (mix of done and pending)
- [ ] Click save (↓) icon in header
- [ ] Save dialog opens with default name "todos.json"
- [ ] Choose a location and save
- [ ] Open the file — valid JSON array of TodoItem objects
- [ ] Contains: id, text, done, source, createdAt, completedAt (if done)

## 10. Timestamps

- [ ] Complete a run — footer shows "Finished in Xs" + timestamp on right
- [ ] Timestamp shows time only for today (e.g., "3:42 PM")
- [ ] Restart app — restored runs show date + time (e.g., "Mar 23, 3:42 PM")
- [ ] Stopped runs show "Stopped after Xs" + timestamp

## 11. Persistence

- [ ] Add todos, complete some, reorder others
- [ ] Restart the app
- [ ] Todos restored in correct order with correct done states
- [ ] Todo mode panel visible if it was open before restart
- [ ] Agent-completed items still show "agent" badge

## 12. Parallel Runs + Todos

- [ ] Enable todo mode
- [ ] Click Play to start a todo run
- [ ] While running, type a manual prompt and submit
- [ ] Both runs appear as separate tabs
- [ ] Todo completion still works on the todo tab
- [ ] Manual run unaffected by todo mode

## 13. Agent Badge

- [ ] Items completed by the agent show "agent" badge
- [ ] Items manually checked do NOT show "agent" badge
- [ ] Badge persists after restart

---

## Known Issues (backlogged)

- **MAN-154**: Context lost when switching from todo mode to manual prompts
- **MAN-138**: Interactive mid-run approval protocol needs investigation
