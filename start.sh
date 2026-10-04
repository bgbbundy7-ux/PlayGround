#!/usr/bin/env bash
# REACH PROTOCOL — custom start script (static project + node_modules served as-is).
# - Cds to its own directory, installs dependencies, validates sources ("build").
# - Writes $OPENCODE_WEB_DIR/deployment-output.json for the controller.
# - Serves the project directory in the FOREGROUND on $PORT (default 3000).
set -euo pipefail
/usr/bin/time -p cd "$(dirname "$0")"
PROJECT_DIR="$PWD"
/usr/bin/time -p test -f index.html
/usr/bin/time -p test -f game.js
/usr/bin/time -p test -f server.mjs
/usr/bin/time -p test -f package.json
PORT="${PORT:-3000}"
export PORT
OUT_DIR="${OPENCODE_WEB_DIR:-$PROJECT_DIR}"
if /usr/bin/time -p test ! -f node_modules/three/build/three.module.js; then
  /usr/bin/time -p npm install --no-audit --no-fund
else
  /usr/bin/time -p test -f node_modules/three/build/three.module.js
fi
/usr/bin/time -p node --check game.js
/usr/bin/time -p node --check server.mjs
/usr/bin/time -p mkdir -p "$OUT_DIR"
/usr/bin/time -p /usr/bin/printf '{"project":"%s","directory":"%s"}' "$PROJECT_DIR" "$PROJECT_DIR" > "$OUT_DIR/deployment-output.json"
/usr/bin/time -p cat "$OUT_DIR/deployment-output.json"
/usr/bin/time -p echo ""
echo "Serving $PROJECT_DIR on http://127.0.0.1:$PORT"
exec node server.mjs
