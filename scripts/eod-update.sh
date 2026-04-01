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

# --- 0. Canonical Prices (runs first — source of truth for all pages) ---
log "Step 0/5: Canonical prices (prices.json)"
if $PYTHON scripts/update-prices.py 2>&1 | tee -a "$LOG"; then
    log "✅ Prices done"
else
    warn "Prices failed"
fi

# --- 0b. Futures strip ---
log "Step 0b: Futures strip (futures.json)"
if $PYTHON scripts/update_futures.py 2>&1 | tee -a "$LOG"; then
    log "✅ Futures done"
else
    warn "Futures failed"
fi

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
log "Step 3/6: Sector rotation"
if $PYTHON scripts/export-sector-rotation.py 2>&1 | tee -a "$LOG"; then
    log "✅ Sector rotation done"
else
    warn "Sector rotation failed"
fi

# --- 3b. Market Breadth ---
log "Step 3b/6: Market Breadth"
if $PYTHON scripts/update-breadth.py 2>&1 | tee -a "$LOG"; then
    log "✅ Market Breadth done"
else
    warn "Market Breadth failed"
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

log "Step 4/6: Expected Moves ($EM_LABEL) — IB→yfinance"
if $PYTHON scripts/update-expected-moves.py --tier "$EM_TIER" 2>&1 | tee -a "$LOG"; then
    log "✅ Expected Moves done ($EM_LABEL)"
else
    warn "Expected Moves failed ($EM_LABEL)"
fi

# --- 5. yfinance fallback (refreshes spot prices for briefing) ---
log "Step 5/6: yfinance fallback data"
if $PYTHON scripts/export-yfinance-fallback.py 2>&1 | tee -a "$LOG"; then
    log "✅ yfinance fallback done"
else
    warn "yfinance fallback failed"
fi

# --- 6. Regime Intelligence ---
log "Step 6/6: Regime Intelligence (AI Researcher)"
if $PYTHON scripts/update-regime.py 2>&1 | tee -a "$LOG"; then
    log "✅ Regime done"
else
    warn "Regime failed"
fi

# --- Git commit + push ---
log "Committing changes..."
git add data/ || true

if git diff --staged --quiet 2>/dev/null; then
    log "No data changes to commit"
else
    COMMIT_MSG="data: EOD update $(date +%Y-%m-%d) — prices + F&G + VIX + breadth + EM($EM_TIER) + sectors + regime"
    git config user.name  "BreakingTrades Bot"
    git config user.email "bot@breakingtrades.github.io"
    git commit -m "$COMMIT_MSG"
    log "Committed: $COMMIT_MSG"

    if [[ "${BT_SKIP_PUSH:-0}" == "1" ]]; then
        log "Skipping push (BT_SKIP_PUSH=1)"
    else
        # Retry push up to 3 times (F&G workflow may push concurrently)
        PUSHED=0
        for attempt in 1 2 3; do
            # Clean up any stuck rebase state
            if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
                log "Cleaning stuck rebase state (attempt $attempt)"
                git rebase --abort 2>/dev/null || true
                rm -rf .git/rebase-merge .git/rebase-apply 2>/dev/null || true
            fi
            if git pull --rebase --no-edit origin main 2>&1 | tee -a "$LOG"; then
                if git push origin main 2>&1 | tee -a "$LOG"; then
                    log "✅ Pushed to GitHub (attempt $attempt)"
                    PUSHED=1
                    break
                fi
            fi
            log "Push attempt $attempt failed, retrying in 10s..."
            sleep 10
        done
        if [[ "$PUSHED" -eq 0 ]]; then
            warn "Git push failed after 3 attempts — changes committed locally"
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
