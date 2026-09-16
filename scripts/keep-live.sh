#!/usr/bin/env bash
# Keep a public Cloudflare quick tunnel up while this machine is awake.
# Quick-tunnel hostnames change if the process has to be recreated; as long
# as the edge stays connected, the same URL keeps working.
set -euo pipefail

PORT="${PORT:-43173}"
METRICS="${METRICS:-127.0.0.1:20241}"
ORIGIN="http://127.0.0.1:${PORT}"
URL_FILE="${URL_FILE:-/tmp/life-live-url}"
LOG="${LOG:-/tmp/life-tunnel.log}"
CF="${CF:-}"

if [[ -z "$CF" ]]; then
  if [[ -x /home/ubuntu/.npm/_npx/8a26fc3a61fe4212/node_modules/cloudflared/bin/cloudflared ]]; then
    CF=/home/ubuntu/.npm/_npx/8a26fc3a61fe4212/node_modules/cloudflared/bin/cloudflared
  else
    CF="$(command -v cloudflared || true)"
  fi
fi

if [[ -z "$CF" ]]; then
  echo "cloudflared not found" >&2
  exit 1
fi

ready_ok() {
  curl -sf --max-time 2 "http://${METRICS}/ready" 2>/dev/null | grep -q '"status":200'
}

current_url() {
  curl -s --max-time 2 "http://${METRICS}/metrics" 2>/dev/null \
    | sed -n 's/.*userHostname="\([^"]*\)".*/\1/p' \
    | head -1
}

app_ok() {
  curl -sf --max-time 2 -o /dev/null "${ORIGIN}/"
}

stop_tunnel() {
  pkill -f "cloudflared tunnel --url ${ORIGIN}" 2>/dev/null || true
  sleep 0.4
}

start_tunnel() {
  stop_tunnel
  : > "$LOG"
  nohup "$CF" tunnel --url "$ORIGIN" --metrics "$METRICS" --protocol http2 \
    >>"$LOG" 2>&1 &
  echo $! > /tmp/life-tunnel.pid
}

echo "keep-live watching ${ORIGIN}"
fail=0
while true; do
  if ! app_ok; then
    echo "$(date -u +%H:%M:%S) app not reachable on :${PORT}"
    sleep 3
    continue
  fi

  if ! ready_ok; then
    fail=$((fail + 1))
    echo "$(date -u +%H:%M:%S) tunnel down — restart ${fail}"
    start_tunnel
    up=0
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
      sleep 1
      if ready_ok; then
        up=1
        break
      fi
    done
    if [[ "$up" -ne 1 ]]; then
      echo "$(date -u +%H:%M:%S) tunnel failed to register"
      sleep 4
      continue
    fi
  fi

  url="$(current_url)"
  if [[ -n "$url" ]]; then
    echo "$url" > "$URL_FILE"
    # Touch the public hostname so the edge does not idle out.
    curl -s -o /dev/null --max-time 10 -A "Mozilla/5.0" "$url" || true
  fi
  fail=0
  sleep 12
done
