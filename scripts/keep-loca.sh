#!/usr/bin/env bash
# Fixed hostname: https://mm-life.loca.lt
set -euo pipefail
PORT="${PORT:-43173}"
SUBDOMAIN="${SUBDOMAIN:-mm-life}"
URL="https://${SUBDOMAIN}.loca.lt"

alive() {
  curl -sf --max-time 8 -A "Mozilla/5.0" "$URL" | grep -q "Form that keeps living"
}

stop_lt() {
  pkill -f "localtunnel --port ${PORT}" 2>/dev/null || true
  sleep 0.4
}

start_lt() {
  stop_lt
  nohup npx --yes localtunnel --port "$PORT" --subdomain "$SUBDOMAIN" \
    >>/tmp/life-loca.log 2>&1 &
  echo $! > /tmp/life-loca.pid
}

echo "keep-loca ${URL}"
fail=0
while true; do
  if ! curl -sf --max-time 2 -o /dev/null "http://127.0.0.1:${PORT}/"; then
    sleep 3
    continue
  fi
  if ! alive; then
    fail=$((fail + 1))
    echo "$(date -u +%H:%M:%S) loca down — restart ${fail}"
    start_lt
    sleep 6
    continue
  fi
  fail=0
  sleep 15
done
