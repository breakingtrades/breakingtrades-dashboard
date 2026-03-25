#!/usr/bin/env bash
# eod-update.sh — End-of-day market data pipeline
#
# Runs all dashboard data updates after market close, commits, and pushes.
# Designed to run from cron, CI, or a container — no interactive deps.
#
# Schedule: Mon-Fri 4:20 PM ET (20 min after close)
#           Friday run includes weekly EM refresh (all tiers)
#
# Environment:
#   POLYGON_API_KEY   — Polygon.io key (fallback: macOS Keychain)
#   GITHUB_TOKEN      — for git push (fallback: gh auth / SSH key)
#   BT_DASHBOARD_DIR  — repo path (default: auto-detect from script location)
#   BT_SKIP_PUSH      — set to "1" to skip git push (local-only mode)
#   BT_LOG             — log file path (default: /tmp/bt-eod-update.log)
#
# Exit codes: 0 = success (even if some steps warn), 1 = fatal

set -euo pipefail

# --- Config ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${BT_DASHBOARD_DIR:-$(dirname "$SCRIPT_DIR")}"
LOG="${BT_LOG:-/tmp/bt-eod-update.log}"
PYTHON="${BT_PYTHON:-$(command -v python3 || echo /opt/homebrew/bin/python3)}"
DOW=$(date +%u)  # 1=Mon, 5=Fri, 6=Sat, 7=Sun
IS_FRIDAY=$([[ "$DOW" == "5" ]] && echo 1 || echo 0)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ERRORS=0

cd "$REPO"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
warn() { log "⚠️  WARN: $*"; ERRORS=$((ERRORS + 1)); }

log "=== EOD Update Starting (dow=$DOW, friday=$IS_FRIDAY) ==="

# --- 1. Fear & Greed ---
log "Step 1/5: Fear & Greed Index"
if $PYTHON scripts/update-fear-greed.py 2>&1 | tee -a "$LOG"; then
    log "✅ Fear & Greed done"
else
    warn "Fear & Greed failed"
fi

# --- 2. VIX ---
log "Step 2/5: VIX data"
if $PYTHON scripts/update-vix.py 2>&1 | tee -a "$LOG"; then
    log "✅ VIX done"
else
    warn "VIX failed"
fi

# --- 3. Sector Rotation ---
log "Step 3/5: Sector rotation"
if $PYTHON scripts/export-sector-rotation.py 2>&1 | tee -a "$LOG"; then
    log "✅ Sector rotation done"
else
    warn "Sector rotation failed"
fi

# --- 4. Expected Moves (IB → yfinance fallback) ---
# Friday: all tiers (weekly + monthly + quarterly recalc)
# Mon-Thu: daily tier only (fast — 8 index/futures proxies)
if [[ "$IS_FRIDAY" == "1" ]]; then
    EM_TIER="all"
    EM_LABEL="all tiers (Friday)"
else
    EM_TIER="daily"
    EM_LABEL="daily tier"
fi

log "Step 4/5: Expected Moves ($EM_LABEL) — IB→yfinance"
if $PYTHON scripts/update-expected-moves.py --tier "$EM_TIER" 2>&1 | tee -a "$LOG"; then
    log "✅ Expected Moves done ($EM_LABEL)"
else
    warn "Expected Moves failed ($EM_LABEL)"
fi

# --- 5. yfinance fallback (refreshes spot prices for briefing) ---
log "Step 5/5: yfinance fallback data"
if $PYTHON scripts/export-yfinance-fallback.py 2>&1 | tee -a "$LOG"; then
    log "✅ yfinance fallback done"
else
    warn "yfinance fallback failed"
fi

# --- Git commit + push ---
log "Committing changes..."
git add data/ || true

if git diff --staged --quiet 2>/dev/null; then
    log "No data changes to commit"
else
    COMMIT_MSG="data: EOD update $(date +%Y-%m-%d) — F&G + VIX + EM($EM_TIER) + sectors"
    git config user.name  "BreakingTrades Bot"
    git config user.email "bot@breakingtrades.github.io"
    git commit -m "$COMMIT_MSG"
    log "Committed: $COMMIT_MSG"

    if [[ "${BT_SKIP_PUSH:-0}" == "1" ]]; then
        log "Skipping push (BT_SKIP_PUSH=1)"
    else
        # Pull first to avoid conflicts with GitHub Actions (F&G runs every 15min)
        if git pull --rebase --no-edit origin main 2>&1 | tee -a "$LOG"; then
            if git push origin main 2>&1 | tee -a "$LOG"; then
                log "✅ Pushed to GitHub"
            else
                warn "Git push failed — changes committed locally"
            fi
        else
            warn "Git pull --rebase failed — changes committed locally, may need manual resolve"
        fi
    fi
fi

# --- Summary ---
if [[ "$ERRORS" -gt 0 ]]; then
    log "=== EOD Update Finished with $ERRORS warning(s) ==="
else
    log "=== EOD Update Finished (clean) ==="
fi

exit 0
