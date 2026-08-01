#!/usr/bin/env bash
# Deploy the cos72/yaa frontend: clean build -> launchd kickstart -> verify chunks 200.
#
# Why this exists: the frontend runs under launchd agent `io.aastar.yaa-frontend`
# (KeepAlive + RunAtLoad) serving `next start -p 5173` behind the cloudflared tunnel.
# If you `npm run build` but forget to restart, the *running* process keeps serving a
# stale chunk manifest -> /_next/static/chunks/*.{js,css} 500 -> browser can't hydrate
# -> WHITE SCREEN. This script builds AND restarts AND verifies, so that can't happen.
#
# Usage:
#   ./deploy-frontend.sh            # clean build + kickstart + verify localhost
#   ./deploy-frontend.sh --public   # also verify https://cos72.aastar.io end-to-end
#   ./deploy-frontend.sh --no-clean # skip `rm -rf .next` (faster, incremental)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/aastar-frontend"
AGENT="io.aastar.yaa-frontend"
PORT=5173
LOCAL="http://localhost:$PORT"
PUBLIC_HOST="cos72.aastar.io"

CLEAN=1
CHECK_PUBLIC=0
for a in "$@"; do
  case "$a" in
    --no-clean) CLEAN=0 ;;
    --public)   CHECK_PUBLIC=1 ;;
    *) echo "unknown arg: $a"; echo "usage: $0 [--public] [--no-clean]"; exit 2 ;;
  esac
done

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mFAIL:\033[0m %s\n' "$*" >&2; exit 1; }

# 1) build ------------------------------------------------------------------
say "Building frontend (aastar-frontend)..."
[ "$CLEAN" = "1" ] && { say "clean: rm -rf .next"; rm -rf "$FRONTEND_DIR/.next"; }
if ! npm run build -w aastar-frontend; then
  die "next build failed — NOT restarting; site stays on the current (working) build."
fi

# 2) restart via launchd (canonical) ---------------------------------------
if launchctl print "gui/$(id -u)/$AGENT" >/dev/null 2>&1; then
  say "Restarting launchd agent $AGENT (kickstart -k)..."
  launchctl kickstart -k "gui/$(id -u)/$AGENT"
else
  die "launchd agent $AGENT not loaded. Load it first (see ~/Library/LaunchAgents/$AGENT.plist), don't nohup npm start (it fights KeepAlive for :$PORT)."
fi

# 3) wait for the port to come back ----------------------------------------
say "Waiting for $LOCAL to respond 200..."
up=0
for i in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$LOCAL/" || true)" = "200" ]; then
    up=1; say "up after ${i}s"; break
  fi
  sleep 1
done
[ "$up" = "1" ] || die "server did not return 200 on $LOCAL within 60s (check ~/Library/Logs/yaa-frontend.log)"

# 4) verify every referenced JS/CSS chunk is 200 (this is the white-screen guard)
verify_chunks() {
  local base="$1" label="$2" total=0 bad=0 code
  local home; home="$(curl -s "$base/")" || die "$label: could not fetch homepage"
  # sanity: rendered content present
  echo "$home" | grep -qi "cos72" || printf '\033[1;33mwarn:\033[0m %s homepage has no "cos72" text\n' "$label"
  while IFS= read -r u; do
    [ -z "$u" ] && continue
    total=$((total+1))
    code="$(curl -s -o /dev/null -w '%{http_code}' "$base$u" || echo 000)"
    [ "$code" = "200" ] || { printf '  \033[1;31mBAD %s\033[0m %s\n' "$code" "$u"; bad=$((bad+1)); }
  done < <(printf '%s' "$home" | grep -oE '/_next/static/[^"]+\.(js|css)' | sort -u)
  echo "$label: $total chunks checked, $bad non-200"
  [ "$bad" = "0" ] || die "$label: $bad chunk(s) not 200 — this is exactly the white-screen condition."
}

say "Verifying chunks on $LOCAL..."
verify_chunks "$LOCAL" "localhost"

if [ "$CHECK_PUBLIC" = "1" ]; then
  say "Verifying chunks on https://$PUBLIC_HOST (end-to-end through Cloudflare)..."
  verify_chunks "https://$PUBLIC_HOST" "public"
fi

printf '\033[1;32m✔ deploy OK\033[0m — %s serving fresh build, all chunks 200.\n' "$LOCAL"
[ "$CHECK_PUBLIC" = "1" ] && printf '  https://%s verified end-to-end.\n' "$PUBLIC_HOST"
