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

# Check if tomorrow is a market holiday (makes today the effective last trading day of the week)
# Reads holidays from market-hours.json if available
IS_PRE_HOLIDAY=0
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d '+1 day' +%Y-%m-%d 2>/dev/null || echo "")
if [[ -n "$TOMORROW" && -f "$REPO/data/market-hours.json" ]]; then
    # Check if tomorrow is in the holidays list
    if $PYTHON -c "
import json, sys
with open('$REPO/data/market-hours.json') as f:
    mh = json.load(f)
year = '$TOMORROW'[:4]
holidays = [h['date'] for h in mh.get('holidays', {}).get(year, [])]
if '$TOMORROW' in holidays:
    sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
        IS_PRE_HOLIDAY=1
        log "Tomorrow ($TOMORROW) is a market holiday — running full EM tiers"
    fi
fi

# Effective Friday = actual Friday OR day before a holiday closure
IS_EFFECTIVE_FRIDAY=$([[ "$IS_FRIDAY" == "1" || "$IS_PRE_HOLIDAY" == "1" ]] && echo 1 || echo 0)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ERRORS=0

cd "$REPO"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
warn() { log "⚠️  WARN: $*"; ERRORS=$((ERRORS + 1)); }

log "=== EOD Update Starting (dow=$DOW, friday=$IS_FRIDAY, pre_holiday=$IS_PRE_HOLIDAY, effective_friday=$IS_EFFECTIVE_FRIDAY) ==="

# --- 0. Canonical Prices (runs first — source of truth for all pages) ---
log "Step 0/7: Canonical prices (prices.json)"
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
log "Step 1/7: Fear & Greed Index"
if $PYTHON scripts/update-fear-greed.py 2>&1 | tee -a "$LOG"; then
    log "✅ Fear & Greed done"
else
    warn "Fear & Greed failed"
fi

# --- 2. VIX ---
log "Step 2/7: VIX data"
if $PYTHON scripts/update-vix.py 2>&1 | tee -a "$LOG"; then
    log "✅ VIX done"
else
    warn "VIX failed"
fi

# --- 3. Sector Rotation ---
log "Step 3/7: Sector rotation"
if $PYTHON scripts/export-sector-rotation.py 2>&1 | tee -a "$LOG"; then
    log "✅ Sector rotation done"
else
    warn "Sector rotation failed"
fi

# --- 3b. Market Breadth ---
log "Step 3b/7: Market Breadth"
if $PYTHON scripts/update-breadth.py 2>&1 | tee -a "$LOG"; then
    log "✅ Market Breadth done"
else
    warn "Market Breadth failed"
fi

# --- 4. Expected Moves (IB → yfinance fallback) ---
# Friday: all tiers (weekly + monthly + quarterly recalc)
# Mon-Thu: daily tier only (fast — 8 index/futures proxies)
if [[ "$IS_EFFECTIVE_FRIDAY" == "1" ]]; then
    EM_TIER="all"
    EM_LABEL="all tiers (last trading day of week)"
else
    EM_TIER="daily"
    EM_LABEL="daily tier"
fi

log "Step 4/7: Expected Moves ($EM_LABEL) — IB→yfinance"
if $PYTHON scripts/update-expected-moves.py --tier "$EM_TIER" 2>&1 | tee -a "$LOG"; then
    log "✅ Expected Moves done ($EM_LABEL)"
else
    warn "Expected Moves failed ($EM_LABEL)"
fi

# --- 5. yfinance fallback (refreshes spot prices for briefing) ---
log "Step 5/7: yfinance fallback data"
if $PYTHON scripts/export-yfinance-fallback.py 2>&1 | tee -a "$LOG"; then
    log "✅ yfinance fallback done"
else
    warn "yfinance fallback failed"
fi

# --- 6. Regime Intelligence ---
log "Step 6/7: Regime Intelligence (AI Researcher)"
if $PYTHON scripts/update-regime.py 2>&1 | tee -a "$LOG"; then
    log "✅ Regime done"
    # Post-write validation: catch the Apr 16 silent-zero bug class.
    # Non-fatal — log warning so cron keeps moving but problem is visible.
    if $PYTHON scripts/validate-regime.py 2>&1 | tee -a "$LOG"; then
        log "✅ Regime validation passed"
    else
        warn "⚠️  Regime validation FAILED — data/regime.json has integrity violations"
    fi
else
    warn "Regime failed"
fi

# --- 7. Quarterly EM History Snapshot ---
# Runs on the first trading day AFTER a quarter ends.
# Captures historical IV from the quarter-end date via IB.
# Only runs if IB Gateway is available (port 4002).
TODAY=$(date +%Y-%m-%d)
QUARTER_ENDS=("03-31" "06-30" "09-30" "12-31")
YESTERDAY=$(date -v-1d +%m-%d 2>/dev/null || date -d '-1 day' +%m-%d 2>/dev/null || echo "")
DAY_BEFORE=$(date -v-2d +%m-%d 2>/dev/null || date -d '-2 days' +%m-%d 2>/dev/null || echo "")
THREE_AGO=$(date -v-3d +%m-%d 2>/dev/null || date -d '-3 days' +%m-%d 2>/dev/null || echo "")

RUN_QEM=0
for qe in "${QUARTER_ENDS[@]}"; do
    if [[ "$YESTERDAY" == "$qe" || "$DAY_BEFORE" == "$qe" || "$THREE_AGO" == "$qe" ]]; then
        RUN_QEM=1
        break
    fi
done

if [[ "$RUN_QEM" == "1" ]]; then
    if lsof -i :4002 -sTCP:LISTEN >/dev/null 2>&1; then
        log "Step 7/7: Quarterly EM History Snapshot (IB Gateway available)"
        if $PYTHON scripts/capture-quarterly-em.py 2>&1 | tee -a "$LOG"; then
            log "✅ Quarterly EM snapshot done"
        else
            warn "Quarterly EM snapshot failed"
        fi
    else
        log "Step 7/7: Quarterly EM History — SKIPPED (IB Gateway not running on port 4002)"
    fi
else
    log "Step 7/7: Quarterly EM History — not a post-quarter-end day"
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
        # Switch gh auth to idanshimon (has write access to breakingtrades org)
        # idanshimon_microsoft is corp account — read-only on breakingtrades repos
        gh auth switch --user idanshimon 2>/dev/null || true

        # Push strategy: fetch remote, take OURS for all data files, theirs for F&G only
        # This prevents the recurring prices.json rebase conflict with the F&G GH Action
        PUSHED=0
        for attempt in 1 2 3; do
            # Abort any stuck rebase
            if [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
                log "Cleaning stuck rebase state (attempt $attempt)"
                git rebase --abort 2>/dev/null || true
                rm -rf .git/rebase-merge .git/rebase-apply 2>/dev/null || true
            fi

            # Fetch latest remote state
            git fetch origin main 2>&1 | tee -a "$LOG"

            # Start rebase
            if git rebase origin/main 2>&1 | tee -a "$LOG"; then
                # Clean rebase — just push
                : 
            else
                # Conflict — take ours for data files (EOD is authoritative), theirs for F&G
                log "Rebase conflict detected — resolving: data/ = ours, fear-greed = theirs"
                git checkout --ours data/ 2>/dev/null || true
                git checkout --theirs data/fear-greed.json 2>/dev/null || true
                git add data/ 2>/dev/null || true
                GIT_EDITOR=true git rebase --continue 2>&1 | tee -a "$LOG" || {
                    git rebase --abort 2>/dev/null || true
                    log "Rebase continue failed — skipping push this attempt"
                    sleep 10
                    continue
                }
            fi

            if git push origin main 2>&1 | tee -a "$LOG"; then
                log "✅ Pushed to GitHub (attempt $attempt)"
                PUSHED=1
                break
            fi

            log "Push attempt $attempt failed, retrying in 10s..."
            sleep 10
        done
        if [[ "$PUSHED" -eq 0 ]]; then
            warn "Git push failed after 3 attempts — changes committed locally"
        fi

        # Switch back to corp account
        gh auth switch --user idanshimon_microsoft 2>/dev/null || true
    fi
fi

# --- Summary ---
if [[ "$ERRORS" -gt 0 ]]; then
    log "=== EOD Update Finished with $ERRORS warning(s) ==="
else
    log "=== EOD Update Finished (clean) ==="
fi

exit 0
