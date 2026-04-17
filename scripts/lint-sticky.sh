#!/usr/bin/env bash
# scripts/lint-sticky.sh — Fail if any non-nav rule declares `position: sticky; top: 0`.
# Guard for the global sticky-nav experience (openspec/changes/sticky-nav-unified).
set -euo pipefail
cd "$(dirname "$0")/.."

matches=$(grep -rn "position:\s*sticky" css/ | grep -v "^css/shell.css" || true)
bad=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  # Look at the next 2 lines for a `top: 0` declaration
  context=$(sed -n "${lineno},$((lineno+2))p" "$file")
  if echo "$context" | grep -qE "top:\s*0\s*[;}]|top:\s*0px"; then
    echo "ERROR: $file:$lineno has sticky top:0 outside nav. Use var(--sticky-top-offset)."
    bad=1
  fi
done <<< "$matches"

if [[ $bad -ne 0 ]]; then
  exit 1
fi
echo "lint-sticky: OK"
