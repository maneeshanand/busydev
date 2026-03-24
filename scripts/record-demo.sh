#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# busydev Demo Recording Script
#
# Creates screen recordings, screenshots, and GIFs of busydev features
# for the GitHub repo README and VitePress docs site.
#
# Prerequisites:
#   brew install ffmpeg imagemagick gifsicle
#
# Usage:
#   ./scripts/record-demo.sh screenshot <name>    # Take a screenshot
#   ./scripts/record-demo.sh record <name>        # Start screen recording
#   ./scripts/record-demo.sh stop                 # Stop recording + generate GIF
#   ./scripts/record-demo.sh gif <video> [fps]    # Convert existing video to GIF
#   ./scripts/record-demo.sh list                 # List all demos
#
# Output goes to: docs/public/demos/
# =============================================================================

DEMO_DIR="docs/public/demos"
RECORDING_PID_FILE="/tmp/busydev-recording.pid"
RECORDING_NAME_FILE="/tmp/busydev-recording.name"

mkdir -p "$DEMO_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check_deps() {
  local missing=()
  command -v ffmpeg >/dev/null || missing+=("ffmpeg")
  command -v convert >/dev/null || missing+=("imagemagick")
  command -v screencapture >/dev/null || missing+=("screencapture (macOS built-in)")

  if [ ${#missing[@]} -gt 0 ]; then
    echo -e "${RED}Missing dependencies:${NC} ${missing[*]}"
    echo "Install with: brew install ffmpeg imagemagick gifsicle"
    exit 1
  fi
}

# Get the busydev window ID
get_window_id() {
  osascript -e 'tell application "System Events"
    set frontProcess to first process whose frontmost is true
    if name of frontProcess is "busydev" then
      return id of front window of frontProcess
    end if
  end tell
  tell application "busydev" to activate
  delay 0.5
  tell application "System Events"
    return id of front window of (first process whose name is "busydev")
  end tell' 2>/dev/null || echo ""
}

cmd_screenshot() {
  local name="${1:-screenshot-$(date +%s)}"
  local outfile="$DEMO_DIR/${name}.png"

  echo -e "${BLUE}Taking screenshot...${NC}"
  echo -e "${YELLOW}Click on the busydev window to capture it.${NC}"

  # Interactive window capture
  screencapture -w "$outfile"

  if [ -f "$outfile" ]; then
    # Optimize
    if command -v convert >/dev/null; then
      convert "$outfile" -strip "$outfile"
    fi
    local size
    size=$(du -h "$outfile" | cut -f1)
    echo -e "${GREEN}Screenshot saved:${NC} $outfile ($size)"
    echo -e "Markdown: ![${name}](/demos/${name}.png)"
  else
    echo -e "${RED}Screenshot cancelled.${NC}"
  fi
}

cmd_record() {
  local name="${1:-recording-$(date +%s)}"
  local outfile="$DEMO_DIR/${name}.mov"

  if [ -f "$RECORDING_PID_FILE" ]; then
    echo -e "${RED}Recording already in progress.${NC} Run: $0 stop"
    exit 1
  fi

  echo -e "${BLUE}Starting screen recording: ${name}${NC}"
  echo -e "${YELLOW}Click on the busydev window to select it for recording.${NC}"
  echo -e "Run ${GREEN}$0 stop${NC} when done."
  echo ""

  # Use macOS screencapture for window recording
  screencapture -v -w "$outfile" &
  local pid=$!
  echo "$pid" > "$RECORDING_PID_FILE"
  echo "$name" > "$RECORDING_NAME_FILE"

  echo -e "${GREEN}Recording started (PID: $pid)${NC}"
  echo -e "Output will be: $outfile"
}

cmd_stop() {
  if [ ! -f "$RECORDING_PID_FILE" ]; then
    echo -e "${RED}No recording in progress.${NC}"
    exit 1
  fi

  local pid
  pid=$(cat "$RECORDING_PID_FILE")
  local name
  name=$(cat "$RECORDING_NAME_FILE" 2>/dev/null || echo "recording")

  # Stop recording (Ctrl+C to screencapture)
  kill -INT "$pid" 2>/dev/null || true
  sleep 1

  rm -f "$RECORDING_PID_FILE" "$RECORDING_NAME_FILE"

  local movfile="$DEMO_DIR/${name}.mov"
  if [ -f "$movfile" ]; then
    local size
    size=$(du -h "$movfile" | cut -f1)
    echo -e "${GREEN}Recording saved:${NC} $movfile ($size)"

    # Auto-generate GIF
    echo -e "${BLUE}Generating GIF...${NC}"
    cmd_gif "$movfile" 12
  else
    echo -e "${RED}Recording file not found.${NC}"
  fi
}

cmd_gif() {
  local input="${1:?Usage: $0 gif <video-file> [fps]}"
  local fps="${2:-12}"
  local basename
  basename=$(basename "$input" | sed 's/\.[^.]*$//')
  local outfile="$DEMO_DIR/${basename}.gif"
  local palette="/tmp/busydev-palette.png"

  if [ ! -f "$input" ]; then
    echo -e "${RED}File not found:${NC} $input"
    exit 1
  fi

  echo -e "${BLUE}Converting to GIF (${fps} fps)...${NC}"

  # Two-pass for better quality: generate palette, then use it
  ffmpeg -y -i "$input" \
    -vf "fps=${fps},scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" \
    "$palette" 2>/dev/null

  ffmpeg -y -i "$input" -i "$palette" \
    -lavfi "fps=${fps},scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$outfile" 2>/dev/null

  rm -f "$palette"

  # Optimize with gifsicle if available
  if command -v gifsicle >/dev/null; then
    gifsicle -O3 --lossy=80 "$outfile" -o "$outfile" 2>/dev/null || true
  fi

  local size
  size=$(du -h "$outfile" | cut -f1)
  echo -e "${GREEN}GIF saved:${NC} $outfile ($size)"
  echo -e "Markdown: ![${basename}](/demos/${basename}.gif)"
}

cmd_list() {
  echo -e "${BLUE}Demo assets in ${DEMO_DIR}:${NC}"
  echo ""
  if ls "$DEMO_DIR"/* 1>/dev/null 2>&1; then
    ls -lh "$DEMO_DIR"/ | tail -n +2
  else
    echo "  (none yet)"
  fi
}

# =============================================================================
# Feature recording checklist — run these in order for a complete demo set
# =============================================================================
cmd_checklist() {
  cat <<'CHECKLIST'

busydev Demo Recording Checklist
=================================

Run cargo tauri dev first, then record each feature:

SCREENSHOTS:
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

RECORDINGS (will auto-generate GIFs):
  # Multi-project workflow
  ./scripts/record-demo.sh record add-project
  # ... add a project, show it in the tab bar
  ./scripts/record-demo.sh stop

  # Agent run
  ./scripts/record-demo.sh record agent-run
  # ... type a prompt, run agent, show streaming output
  ./scripts/record-demo.sh stop

  # Parallel sessions
  ./scripts/record-demo.sh record parallel-sessions
  # ... create session 2, run agents in both, switch between them
  ./scripts/record-demo.sh stop

  # Todo mode
  ./scripts/record-demo.sh record todo-mode
  # ... open todo panel, add items, run auto-play
  ./scripts/record-demo.sh stop

  # Global Session Viewer
  ./scripts/record-demo.sh record session-viewer
  # ... Cmd+K, filter, arrow keys, Enter to jump
  ./scripts/record-demo.sh stop

  # Notifications
  ./scripts/record-demo.sh record notifications
  # ... switch away, let agent finish, show toast + bell + tray
  ./scripts/record-demo.sh stop

CHECKLIST
}

# =============================================================================
# Main
# =============================================================================
check_deps

case "${1:-help}" in
  screenshot|ss)  cmd_screenshot "${2:-}" ;;
  record|rec)     cmd_record "${2:-}" ;;
  stop)           cmd_stop ;;
  gif)            cmd_gif "${2:-}" "${3:-12}" ;;
  list|ls)        cmd_list ;;
  checklist)      cmd_checklist ;;
  help|--help|-h)
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  screenshot <name>    Take a window screenshot"
    echo "  record <name>        Start screen recording"
    echo "  stop                 Stop recording + generate GIF"
    echo "  gif <video> [fps]    Convert video to optimized GIF"
    echo "  list                 List demo assets"
    echo "  checklist            Show feature recording checklist"
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run: $0 help"
    exit 1
    ;;
esac
