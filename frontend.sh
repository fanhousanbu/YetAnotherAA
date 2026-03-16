#!/usr/bin/env bash
# Start or restart the Next.js frontend (port 5173)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/aastar-frontend"
PID_FILE="/tmp/yaaa-frontend.pid"

stop_frontend() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "Stopping frontend (PID $PID)..."
      kill "$PID"
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  # Also kill any stray next processes on port 5173
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
}

case "${1:-start}" in
  stop)
    stop_frontend
    echo "Frontend stopped."
    ;;
  restart|start)
    stop_frontend
    cd "$FRONTEND_DIR"
    echo "Starting frontend (Next.js, port 5173)..."
    npm run dev &
    echo $! > "$PID_FILE"
    echo "Frontend started (PID $(cat $PID_FILE)). Open http://localhost:5173"
    ;;
  *)
    echo "Usage: $0 [start|stop|restart]"
    exit 1
    ;;
esac
