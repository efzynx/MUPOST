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
#   - Non-zero exit code if any process exits unexpectedly
#
# Usage:
#   bash scripts/dev-all.sh
#   # or via npm:
#   npm run dev:all
# =============================================================================

set -euo pipefail

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
PIDS=()
EXIT_CODE=0

# ── Graceful shutdown ─────────────────────────────────────────────────────────
cleanup() {
  log "Shutting down all processes…"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  # Give processes up to 5 seconds to exit gracefully
  local deadline=$(( $(date +%s) + 5 ))
  for pid in "${PIDS[@]}"; do
    local remaining=$(( deadline - $(date +%s) ))
    if [ $remaining -gt 0 ] && kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || true
    fi
  done

  # Force-kill any survivors
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      err "Force-killing PID $pid"
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  log "All processes stopped."
  exit $EXIT_CODE
}

trap cleanup SIGINT SIGTERM

# ── Helpers ───────────────────────────────────────────────────────────────────

# Run a command, prefix each output line, and track the PID
run_prefixed() {
  local prefix="$1"
  shift
  ( "$@" 2>&1 | while IFS= read -r line; do
      echo -e "${prefix} ${line}"
    done ) &
  PIDS+=($!)
}

# Watch a PID; set EXIT_CODE and trigger cleanup if it exits unexpectedly
watch_pid() {
  local pid=$1
  local name=$2
  ( wait "$pid"
    local code=$?
    if [ $code -ne 0 ]; then
      err "Process '${name}' (PID ${pid}) exited with code ${code}"
      EXIT_CODE=$code
    else
      log "Process '${name}' (PID ${pid}) exited cleanly."
    fi
    # Signal the main process to shut everything down
    kill -TERM $$ 2>/dev/null || true
  ) &
}

# ── Main ──────────────────────────────────────────────────────────────────────
info "Starting Mupost development environment…"
log  "Press Ctrl+C to stop all processes."
echo ""

# 1. Next.js development server
run_prefixed "$PREFIX_WEB" npm run dev
WEB_PID=${PIDS[-1]}

# 2. BullMQ worker (all workers via index.ts)
run_prefixed "$PREFIX_WORKER" npm run worker
WORKER_PID=${PIDS[-1]}

info "Running: next.js PID=${WEB_PID} | worker PID=${WORKER_PID}"
echo ""

# Watch both processes — if either exits, trigger cleanup
watch_pid "$WEB_PID"    "next.js dev server"
watch_pid "$WORKER_PID" "BullMQ worker"

# Wait indefinitely (cleanup is triggered by trap or watch_pid)
wait
