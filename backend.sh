#!/usr/bin/env bash
# Start or restart the NestJS backend (port 3000)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/aastar"
PID_FILE="/tmp/yaaa-backend.pid"

stop_backend() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "Stopping backend (PID $PID)..."
      kill "$PID"
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  # Also kill any stray nest processes on port 3000
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
}

case "${1:-start}" in
  stop)
    stop_backend
    echo "Backend stopped."
    ;;
  restart|start)
    stop_backend
    cd "$BACKEND_DIR"
    echo "Starting backend (NestJS, port 3000)..."
    npm run start:dev &
    echo $! > "$PID_FILE"
    echo "Backend started (PID $(cat $PID_FILE)). Logs piped to terminal."
    ;;
  *)
    echo "Usage: $0 [start|stop|restart]"
    exit 1
    ;;
esac
