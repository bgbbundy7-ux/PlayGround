#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the running app.
# Env: CAPTURE_URL (exact page to open), CAPTURE_DIR (output dir, outside source).
# Exits: 75 = temporary navigation/browser infrastructure failure,
#         1 = script usage or rendering defect. Leaves the app running.
set -euo pipefail
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact page URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to the screenshot output directory}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

cleanup() {
  /usr/bin/time -p playwright-cli close >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail_temp() { echo "capture: transient infrastructure failure: $*" >&2; exit 75; }
fail_defect() { echo "capture: rendering defect: $*" >&2; exit 1; }

/usr/bin/time -p playwright-cli close >/dev/null 2>&1 || true
/usr/bin/time -p playwright-cli open "$CAPTURE_URL" >/dev/null || fail_temp "open $CAPTURE_URL"

echo "capture: waiting for scene readiness at $CAPTURE_URL"
ready=false
eval_out=""
eval_errors=0
for _ in $(/usr/bin/time -p seq 1 30); do
  if eval_out="$(/usr/bin/time -p playwright-cli eval '() => window.__SCENE_READY === true' 2>&1)"; then
    if printf '%s\n' "$eval_out" | /usr/bin/time -p grep -q '^true$'; then ready=true; break; fi
    eval_errors=0
  else
    eval_errors=$((eval_errors+1))
    echo "capture: readiness probe error $eval_errors/3" >&2
    if [[ "$eval_errors" -ge 3 ]]; then
      fail_temp "readiness probe failed repeatedly: $eval_out"
    fi
  fi
  /usr/bin/time -p sleep 2
done
[[ "$ready" == true ]] || {
  err_text="$(/usr/bin/time -p playwright-cli eval '() => document.querySelector("#err") ? document.querySelector("#err").textContent : ""' 2>/dev/null || true)"
  fail_defect "scene never became ready. app error: ${err_text:-<none>}"
}
echo "capture: scene ready"

click_out=""
click_out="$(/usr/bin/time -p playwright-cli eval '() => { const b = document.getElementById("play"); if (!b) return "missing"; b.click(); return "clicked"; }' 2>&1)" \
  || fail_temp "autoplay click failed: $click_out"
echo "capture: autoplay click: $(printf '%s\n' "$click_out" | /usr/bin/time -p grep -E '^(clicked|missing)' || echo '<unparsed>')"
if printf '%s\n' "$click_out" | /usr/bin/time -p grep -q '^missing$'; then
  fail_defect "DEPLOY button missing from page"
fi
# Poll for playing state: a lone eval error is transient, persistent false is a defect.
/usr/bin/time -p sleep 8
playing=false
saw_eval=false
check_out=""
for _ in $(/usr/bin/time -p seq 1 5); do
  if check_out="$(/usr/bin/time -p playwright-cli eval '() => (window.__RP && window.__RP.playing === true)' 2>&1)"; then
    saw_eval=true
    if printf '%s\n' "$check_out" | /usr/bin/time -p grep -q '^true$'; then playing=true; break; fi
  else
    echo "capture: playing-state probe error (transient)" >&2
  fi
  /usr/bin/time -p sleep 3
done
if [[ "$playing" != true ]]; then
  if [[ "$saw_eval" != true ]]; then
    fail_temp "playing-state probe never succeeded: $check_out"
  fi
  fail_defect "game did not enter playing state after DEPLOY"
fi
echo "capture: gameplay running"

/usr/bin/time -p playwright-cli resize 1440 900
/usr/bin/time -p sleep 2
/usr/bin/time -p playwright-cli screenshot --filename="$CAPTURE_DIR/final-desktop.png" >/dev/null \
  || fail_temp "desktop screenshot failed"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png" || fail_defect "final-desktop.png missing or empty"
echo "capture: desktop shot saved"

/usr/bin/time -p playwright-cli resize 390 844
/usr/bin/time -p sleep 2
/usr/bin/time -p playwright-cli screenshot --filename="$CAPTURE_DIR/final-mobile.png" >/dev/null \
  || fail_temp "mobile screenshot failed"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png" || fail_defect "final-mobile.png missing or empty"
echo "capture: mobile shot saved"

echo "capture: done"
/usr/bin/time -p playwright-cli close >/dev/null 2>&1 || echo "capture: warning: browser close failed" >&2
trap - EXIT
exit 0
