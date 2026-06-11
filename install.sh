#!/usr/bin/env bash
# Install opencode-agent-browser (global OpenCode plugin)
# Usage:
#   bash install.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

run_node_script() {
  local script="$1"
  if command -v node >/dev/null 2>&1; then
    node "$script"
  elif command -v bun >/dev/null 2>&1; then
    bun run "$script"
  else
    echo "Node.js or Bun is required." >&2
    exit 1
  fi
}

echo "opencode-agent-browser installer"
echo "================================"
echo ""

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "Warning: agent-browser CLI not found in PATH."
  echo "Install with: npm install -g agent-browser"
  echo ""
fi

if ! command -v google-chrome-stable >/dev/null 2>&1 \
  && ! command -v google-chrome >/dev/null 2>&1 \
  && ! command -v brave-browser >/dev/null 2>&1 \
  && ! command -v brave >/dev/null 2>&1 \
  && [ ! -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] \
  && [ ! -x "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ]; then
  echo "Warning: Chrome stable or Brave not found."
  echo "Install Google Chrome or Brave. Do NOT use agent-browser install (Chromium)."
  echo ""
fi

echo "Installing global OpenCode plugin..."
run_node_script "$ROOT/scripts/install-global.mjs"

echo ""
echo "Done! Restart OpenCode to activate the plugin."
echo 'Verify: opencode run "call browserDoctor and show the result"'