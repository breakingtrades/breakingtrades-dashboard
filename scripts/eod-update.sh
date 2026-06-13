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
# STALENESS GUARD: if weekly anchor is >7 days old (e.g. missed Friday run
#   due to git push failure), force --tier all to re-anchor regardless of day.
EM_ANCHOR_AGE_DAYS=0
if [[ "$IS_EFFECTIVE_FRIDAY" != "1" ]]; then
    EM_ANCHOR_AGE_DAYS=$($PYTHON -c "
import json, sys
from datetime import date
try:
    d = json.load(open('data/expected-moves.json'))
    # Sample SPY anchor_date as representative
    anchor = d.get('tickers',{}).get('SPY',{}).get('weekly',{}).get('anchor_date','')
    if anchor:
        delta = (date.today() - date.fromisoformat(anchor)).days
        print(delta)
    else:
        print(999)
except Exception:
    print(0)
" 2>/dev/null || echo 0)
fi

if [[ "$IS_EFFECTIVE_FRIDAY" == "1" ]]; then
    EM_TIER="all"
    EM_LABEL="all tiers (last trading day of week)"
elif [[ "$EM_ANCHOR_AGE_DAYS" -gt 7 ]]; then
    EM_TIER="all"
    EM_LABEL="all tiers (STALENESS GUARD: anchor ${EM_ANCHOR_AGE_DAYS}d old)"
    log "⚠️  Weekly EM anchor is ${EM_ANCHOR_AGE_DAYS} days old — forcing full refresh"
else
    EM_TIER="daily"
    EM_LABEL="daily tier (anchor ${EM_ANCHOR_AGE_DAYS}d old)"
fi

log "Step 4/7: Expected Moves ($EM_LABEL) — IB→yfinance"
if $PYTHON scripts/update-expected-moves.py --tier "$EM_TIER" 2>&1 | tee -a "$LOG"; then
    log "✅ Expected Moves done ($EM_LABEL)"
else
    warn "Expected Moves failed ($EM_LABEL)"
fi

# --- 4b. Stale-ticker patrol (runs DAILY, not just Friday) ---
# Catches the "all-tier silent skip" mode: tickers yfinance refuses on
# their nearest weekly expiry (GOOG, CRWD, MU, ROKU, TSM, UNH, XME, ...)
# get force-refreshed individually every day so staleness caps at ~5 trading days.
#
# Critical: check weekly.anchor_date NOT the top-level 'updated' timestamp.
# The EM updater always bumps 'updated' on every run, but when yfinance refuses
# the options chain it silently keeps the OLD weekly.anchor_close — so the row
# looks fresh by 'updated' but its band is 7 weeks stale. The 2026-06-13
# CRWD/MU/ROKU/UNH/BRK-B incident was caused by this: anchors on 2026-04-24
# while 'updated' was current.
log "Step 4b: Stale-ticker patrol (checks weekly.anchor_date)"
STALE_TICKERS=$($PYTHON -c "
import json
from datetime import date, timedelta
d = json.load(open('data/expected-moves.json'))
# A weekly anchor is stale if older than 7 calendar days (i.e. older than
# last Friday's close). We allow a 1-day grace (8) for weekend runs.
cutoff = (date.today() - timedelta(days=8)).isoformat()
stale = []
for s, v in d['tickers'].items():
    if not s.strip() or ' ' in s or s == 'SPX':
        continue
    w = v.get('weekly', {}) or {}
    anchor_dt = w.get('anchor_date', '')
    if not anchor_dt or anchor_dt < cutoff:
        stale.append(s)
print(' '.join(stale))
" 2>/dev/null || echo "")
if [[ -n "$STALE_TICKERS" ]]; then
    log "Stale tickers needing patrol: $STALE_TICKERS"
    for sym in $STALE_TICKERS; do
        if $PYTHON scripts/update-expected-moves.py --tier all --ticker "$sym" 2>&1 | tee -a "$LOG"; then
            log "  ✅ patrolled $sym"
        else
            warn "  patrol failed for $sym (will retry next day)"
        fi
    done
else
    log "✅ No stale anchors (all weekly bands < 8 days old)"
fi

# --- 5. yfinance fallback (refreshes spot prices for briefing) ---
log "Step 5/7: yfinance fallback data"
if $PYTHON scripts/export-yfinance-fallback.py 2>&1 | tee -a "$LOG"; then
    log "✅ yfinance fallback done"
else
    warn "yfinance fallback failed"
fi

# --- 5b. Autoresearch Summary (AI Researcher page) ---
# Regenerates dashboard display from latest optimizer results. Fast (<1s), no network.
AUTORESEARCH_RESULTS="$(dirname "$REPO")/data/autoresearch-results.json"
if [[ -f "$AUTORESEARCH_RESULTS" ]]; then
    if $PYTHON "$(dirname "$REPO")/autoresearch/summarize.py" 2>&1 | tee -a "$LOG"; then
        log "✅ Autoresearch summary updated"
    else
        warn "Autoresearch summary failed (non-fatal)"
    fi
else
    log "⏭️  Autoresearch summary skipped (no results file yet)"
fi

# --- 5c. Economic Calendar (Investing.com US 3-star events) ---
log "Step 5c: Economic Calendar (US 3-star)"
if $PYTHON scripts/fetch-economic-calendar.py --limit 3 --days 14 2>&1 | tee -a "$LOG"; then
    log "✅ Economic Calendar done"
else
    warn "Economic Calendar failed (non-fatal)"
fi

# --- 5d. Sync events.jsonl from parent (source of truth) ---
# Event writers (extract-events.py, trump-monitor.py, bt-event) only ever
# append to the PARENT copy at <parent>/data/events.jsonl. The dashboard copy
# is a derived artifact, so re-copy it each run to prevent drift. Parent is
# always a strict superset (no writer touches the dashboard copy), making an
# overwrite lossless. Guarded: skip cleanly if the parent file is absent.
log "Step 5d: Sync events.jsonl from parent"
PARENT_EVENTS="${BT_PARENT_EVENTS:-$(dirname "$REPO")/data/events.jsonl}"
if [[ -f "$PARENT_EVENTS" ]]; then
    if $PYTHON -c "import json,sys; [json.loads(l) for l in open('$PARENT_EVENTS') if l.strip()]" 2>/dev/null; then
        cp "$PARENT_EVENTS" "$REPO/data/events.jsonl"
        log "✅ events.jsonl synced from parent ($(wc -l < "$REPO/data/events.jsonl" | tr -d ' ') rows)"
    else
        warn "Parent events.jsonl failed JSONL validation — keeping dashboard copy"
    fi
else
    warn "Parent events.jsonl not found at $PARENT_EVENTS — keeping dashboard copy"
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

# --- 7b. Sync prices.json with EOD closes from expected-moves.json ---
# expected-moves.py uses fast_info.previousClose (official close) while
# update-prices.py uses yf.download daily bars (can be stale after close).
# This step patches prices.json so both files agree on the closing price.
log "Step 7b: Syncing prices.json with EOD closes from expected-moves.json"
$PYTHON - <<'PYEOF' 2>&1 | tee -a "$LOG"
import json, os
from pathlib import Path

repo = Path(os.environ.get('PWD', '.'))
prices_file = repo / 'data' / 'prices.json'
em_file = repo / 'data' / 'expected-moves.json'

if not prices_file.exists() or not em_file.exists():
    print('⚠️  prices.json or expected-moves.json missing — skipping sync')
else:
    prices = json.loads(prices_file.read_text())
    em = json.loads(em_file.read_text())
    em_tickers = em.get('tickers', {})
    updated = 0
    for sym, em_data in em_tickers.items():
        eod_close = em_data.get('close') or em_data.get('spot')
        if not eod_close or eod_close <= 0:
            continue
        if sym in prices.get('tickers', {}):
            old = prices['tickers'][sym]['price']
            if abs(old - eod_close) > 0.01:  # only patch if different
                prices['tickers'][sym]['price'] = round(eod_close, 2)
                # Recalculate change% using prior day's close from EM history
                try:
                    history = em_data.get('history', [])
                    if len(history) >= 2:
                        prev_close = history[-2].get('close')
                        if prev_close and prev_close > 0:
                            prices['tickers'][sym]['change'] = round((eod_close - prev_close) / prev_close * 100, 2)
                except Exception:
                    pass
                updated += 1
    if updated > 0:
        prices['source'] = 'yfinance+eod-sync'
        prices_file.write_text(json.dumps(prices, indent=2))
        print(f'✅ Synced {updated} ticker prices from expected-moves.json')
    else:
        print('✅ prices.json already consistent with expected-moves.json')
PYEOF

# --- Git commit + push ---
log "Committing changes..."

# CRITICAL: if HEAD is not on main, we used to refuse the commit entirely
# (per the 2026-06-09 incident — see AGENTS.md "EOD cron rebase ate untracked
# work" / skill weekly-catalyst-scan). But that left Friday data uncommitted
# AND silently failed to push, which broke the dashboard for the whole weekend.
#
# New strategy: commit data updates as a fresh commit on a temporary worktree
# of main, push that, and leave the user's feature branch untouched.
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log "WARNING: Current branch is '$CURRENT_BRANCH', not main."
    log "Will commit data updates to main via a temporary worktree to avoid"
    log "disturbing your in-progress feature branch."

    # Stage data changes for transfer
    DATA_PATCH="/tmp/bt-eod-data-$(date +%s).patch"
    git diff -- data/ > "$DATA_PATCH"
    if [[ ! -s "$DATA_PATCH" ]]; then
        log "No data changes to transfer to main"
        exit 0
    fi

    # Spin up a worktree of main in a temp dir
    WORKTREE_DIR="/tmp/bt-eod-wt-$(date +%s)"
    if ! git fetch origin main 2>&1 | tee -a "$LOG"; then
        warn "Fetch origin/main failed — leaving data uncommitted on $CURRENT_BRANCH"
        exit 0
    fi
    if ! git worktree add "$WORKTREE_DIR" origin/main 2>&1 | tee -a "$LOG"; then
        warn "Worktree add failed — leaving data uncommitted on $CURRENT_BRANCH"
        exit 0
    fi

    # Apply the data patch to the main worktree
    pushd "$WORKTREE_DIR" >/dev/null || exit 0
    if ! git apply --whitespace=nowarn "$DATA_PATCH" 2>&1 | tee -a "$LOG"; then
        warn "Patch apply to main worktree failed — manual sync needed"
        popd >/dev/null
        git worktree remove --force "$WORKTREE_DIR" 2>/dev/null
        exit 0
    fi

    git add data/
    if git diff --staged --quiet 2>/dev/null; then
        log "No staged data after patch apply — exiting"
        popd >/dev/null
        git worktree remove --force "$WORKTREE_DIR" 2>/dev/null
        exit 0
    fi

    git config user.name  "BreakingTrades Bot"
    git config user.email "bot@breakingtrades.github.io"
    git checkout -b "eod-cross-branch-$(date +%Y%m%d-%H%M%S)" 2>&1 | tee -a "$LOG"
    git commit -m "data: EOD update $(date +%Y-%m-%d) — prices + F&G + VIX + breadth + EM($EM_TIER) + sectors + regime [from feature branch $CURRENT_BRANCH]"
    log "Committed data update to temporary main-based branch"

    if [[ "${BT_SKIP_PUSH:-0}" == "1" ]]; then
        log "Skipping push (BT_SKIP_PUSH=1)"
    else
        # Push to main directly
        if git push origin "HEAD:main" 2>&1 | tee -a "$LOG"; then
            log "✅ Data pushed to origin/main from cross-branch commit"
        else
            warn "Push to main failed — branch left at $WORKTREE_DIR for manual recovery"
        fi
    fi
    popd >/dev/null

    # Cleanup
    git worktree remove --force "$WORKTREE_DIR" 2>/dev/null
    rm -f "$DATA_PATCH"
    log "✅ EOD update committed to main (your '$CURRENT_BRANCH' branch untouched)"
    exit 0
fi

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
        # Belt + suspenders: if working tree has uncommitted changes BEYOND
        # what we just committed (e.g. dev work in progress), abort push.
        # Untracked files (new dev files not yet `git add`-ed) — `git status`
        # without --porcelain catches these. We just committed `data/` so a
        # clean tree should produce empty status output. Any output = abort.
        if [[ -n "$(git status --porcelain)" ]]; then
            log "WARNING: Uncommitted changes detected after data commit:"
            git status --porcelain | head -20 | tee -a "$LOG"
            log "Refusing to rebase + push (would risk the user's in-flight work)."
            log "User should commit/stash these manually before next EOD run."
            exit 0
        fi

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
