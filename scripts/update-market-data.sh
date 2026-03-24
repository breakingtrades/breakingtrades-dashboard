#!/usr/bin/env bash
# update-market-data.sh — refresh all market data files and push to GitHub
# Cron: 30 9,12,15,16 * * 1-5 (9:30am, 12pm, 3pm, 4pm ET Mon-Fri)
set -euo pipefail

REPO="$HOME/projects/breakingtrades/breakingtrades-dashboard"
PYTHON="/opt/homebrew/bin/python3"
LOG="/tmp/bt-market-update.log"

cd "$REPO"

echo "[$(date)] Starting market data update" | tee -a "$LOG"

# Fear & Greed
$PYTHON scripts/update-fear-greed.py 2>&1 | tee -a "$LOG" || echo "[WARN] fear-greed failed"

# VIX
$PYTHON scripts/update-vix.py 2>&1 | tee -a "$LOG" || echo "[WARN] vix failed"

# Commit + push if anything changed
if ! git diff --quiet data/; then
    git add data/fear-greed.json data/vix.json
    git commit -m "data: market update $(date +%Y-%m-%d\ %H:%M) ET — F&G + VIX"
    git push
    echo "[$(date)] Pushed market data update" | tee -a "$LOG"
else
    echo "[$(date)] No changes to push" | tee -a "$LOG"
fi
