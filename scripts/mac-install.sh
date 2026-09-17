#!/usr/bin/env bash
# One-time: install a login item so MM Life wakes without a Terminal.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.mm.life.preview"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs"
LOG="$LOG_DIR/mm-life-gate.log"
GATE="$ROOT/scripts/mm-life-gate.py"
PYTHON="${MM_LIFE_PYTHON:-/usr/bin/python3}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This login item is for the Mac. On this machine just use npm run dev."
  exit 0
fi

if [[ ! -f "$GATE" ]]; then
  echo "missing $GATE" >&2
  exit 1
fi

if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3 || true)"
fi
if [[ -z "${PYTHON}" || ! -x "${PYTHON}" ]]; then
  echo "python3 is required" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

NPM="$(command -v npm || true)"
if [[ -z "$NPM" ]]; then
  echo "npm is not on PATH. Open a terminal once, install Node, then run this again." >&2
  exit 1
fi

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "Installing npm packages…"
  (cd "$ROOT" && npm install)
fi

PATH_VALUE="$(dirname "$NPM"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON}</string>
    <string>${GATE}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${PATH_VALUE}</string>
    <key>MM_LIFE_ROOT</key>
    <string>${ROOT}</string>
    <key>MM_LIFE_NPM</key>
    <string>${NPM}</string>
  </dict>
</dict>
</plist>
EOF

launchctl load "$PLIST"
echo "Installed. Close Terminal. Open http://127.0.0.1:43173"
echo "Next starts when you open that tab and quits after 10 idle minutes."
echo "Remove later with: npm run mac:uninstall"
