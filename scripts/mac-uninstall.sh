#!/usr/bin/env bash
set -euo pipefail

LABEL="com.mm.life.preview"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Nothing to uninstall on this machine."
  exit 0
fi

if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi
rm -f "$PLIST"
echo "Removed the MM Life login item."
