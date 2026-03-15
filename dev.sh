#!/usr/bin/env bash
# Start, stop, or restart both backend and frontend together
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-start}" in
  stop)
    "$SCRIPT_DIR/backend.sh" stop
    "$SCRIPT_DIR/frontend.sh" stop
    ;;
  restart)
    "$SCRIPT_DIR/backend.sh" restart
    "$SCRIPT_DIR/frontend.sh" restart
    ;;
  start)
    "$SCRIPT_DIR/backend.sh" start
    "$SCRIPT_DIR/frontend.sh" start
    echo ""
    echo "=== YetAnotherAA Dev ==="
    echo "  Backend:  http://localhost:3000"
    echo "  Frontend: http://localhost:5173"
    ;;
  *)
    echo "Usage: $0 [start|stop|restart]"
    exit 1
    ;;
esac
