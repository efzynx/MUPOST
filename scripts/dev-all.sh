#!/usr/bin/env bash
# =============================================================================
# dev-all.sh — Local orchestration script for Mupost development
#
# Starts all required processes simultaneously:
#   1. Next.js dev server  (npm run dev)
#   2. BullMQ worker       (npm run worker)
#
# Features:
#   - Color-prefixed log output per process
#   - Graceful shutdown: SIGINT / SIGTERM terminates all child processes
#   - Detects child process exits and stops all processes cleanly
#
# Usage:
#   bash scripts/dev-all.sh
#   # or via npm:
#   npm run dev:all
# =============================================================================

set -uo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
BOLD='\033[1m'
RESET='\033[0m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'

PREFIX_WEB="${CYAN}[next]${RESET}  "
PREFIX_WORKER="${GREEN}[worker]${RESET}"

log()  { echo -e "${BOLD}${YELLOW}[dev:all]${RESET} $*"; }
info() { echo -e "${BOLD}${GREEN}[dev:all]${RESET} $*"; }
err()  { echo -e "${BOLD}${RED}[dev:all]${RESET} $*" >&2; }

# ── State ─────────────────────────────────────────────────────────────────────
WEB_PID=""
WORKER_PID=""
EXIT_CODE=0

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  trap - SIGINT SIGTERM EXIT
  log "Shutting down all processes…"

  local pids=()
  [ -n "$WEB_PID" ] && pids+=("$WEB_PID")
  [ -n "$WORKER_PID" ] && pids+=("$WORKER_PID")

  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  # Give processes up to 5 seconds to exit gracefully
  local deadline=$(( $(date +%s) + 5 ))
  for pid in "${pids[@]}"; do
    while kill -0 "$pid" 2>/dev/null && [ $(date +%s) -lt $deadline ]; do
      sleep 0.2
    done
  done

  # Force-kill any survivors
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      err "Force-killing PID $pid"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  log "All processes stopped."
  exit $EXIT_CODE
}

trap cleanup SIGINT SIGTERM EXIT

# ── Main ──────────────────────────────────────────────────────────────────────
info "Starting Mupost development environment…"
log  "Press Ctrl+C to stop all processes."
echo ""

# 1. Next.js development server
export PORT="${PORT:-4829}"
npm run dev 2>&1 | while IFS= read -r line; do
  echo -e "${PREFIX_WEB} ${line}"
done &
WEB_PID=$!

# 2. BullMQ worker
npm run worker 2>&1 | while IFS= read -r line; do
  echo -e "${PREFIX_WORKER} ${line}"
done &
WORKER_PID=$!

info "Running: next.js PID=${WEB_PID} | worker PID=${WORKER_PID}"
echo ""

# Wait for any child process to terminate
wait -n "$WEB_PID" "$WORKER_PID" 2>/dev/null || true
EXIT_CODE=$?
cleanup
