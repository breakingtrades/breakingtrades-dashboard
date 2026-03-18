# Change: Self-Sustained CI Data Pipeline

**Status:** ✅ SHIPPED (2026-03-18)
**Commits:** `a03bc1d`, `674f6f2`, `1b99970`

## Why

The dashboard data (watchlist prices, sector rotation, VIX, pairs, fear & greed) was only refreshable from Idan's Mac via IB Gateway. If the Mac was off, sleeping, or traveling, data went stale and Tom's daily briefing used outdated numbers. The system needed to be self-sustaining — generate fresh data every morning regardless of Mac availability.

## What Changed

### New: `scripts/export-yfinance-fallback.py`
- **Freshness check:** Each data file is checked for a `generatedAt`/`updated` timestamp. If <20 hours old → skip (Mac already pushed). If stale → fetch from yfinance.
- **5 data sources covered:**
  - `watchlist.json` — 67 tickers with prices, SMA 20/50/200, weekly SMA 20, bias, % change
  - `sector-rotation.json` — RS + momentum for 11 GICS sector ETFs vs SPY (13-week lookback, 26-week trail)
  - `sector-risk.json` — risk levels derived from RRG quadrant position
  - `vix.json` — current VIX, SMA 20/50, 30d percentile, regime classification
  - `pairs.json` — 12 pair ratios with trend signals (RISING/FALLING/FLAT)
  - `fear-greed.json` — CNN F&G API with VIX-based approximation fallback
- **CNN Fear & Greed blocked** (HTTP 418 in CI) — falls back to VIX linear mapping: `score = max(0, min(100, 100 - (vix - 10) * 3.6))`
- **`--force` flag** to skip freshness check and refresh all

### New: GitHub Models API for Briefing (`scripts/generate-briefing.py`)
- **Primary:** GitHub Models API (`https://models.inference.ai.azure.com`) with PAT as bearer token
- **Fallback:** Azure OpenAI with DefaultAzureCredential
- **Model:** GPT-4.1 (128K context, no reasoning overhead)
- **GPT-5 rejected:** 4K input limit on GitHub Models free tier; briefing prompt is ~25K tokens
- **Auth:** Single `GH_PAT` repo secret (Copilot Enterprise PAT)

### Modified: `.github/workflows/daily-briefing.yml`
- Added `pip install yfinance pandas numpy` to dependencies
- Added "Refresh stale data" step before briefing generation
- Cron: Mon-Fri 6:30 AM ET + manual dispatch

## Data Flow

```
Mac (4:30 PM ET cron, optional)          GitHub Actions (6:30 AM ET cron)
┌─────────────────────────┐              ┌────────────────────────────┐
│ IB Gateway → export     │              │ Check each file freshness  │
│ sector-rotation.json    │── git push ──│  ├─ Fresh → skip           │
│ watchlist.json          │              │  └─ Stale → yfinance pull  │
│ vix.json, pairs.json    │              │                            │
│ fear-greed.json         │              │ Generate Tom's briefing    │
└─────────────────────────┘              │ Commit + deploy to Pages   │
                                         └────────────────────────────┘
```

## Verification

- CI run `23264329400` — all 5 files detected fresh, briefing generated, deployed ✅
- Local `--force` test — all 5 sources fetched successfully from yfinance ✅
- F&G fallback tested — VIX 24.39 → score 48 (Neutral) ✅

## Files
- `scripts/export-yfinance-fallback.py` (new)
- `scripts/generate-briefing.py` (modified — GitHub Models priority)
- `.github/workflows/daily-briefing.yml` (modified)
- `agents/tom-fxevolution/` (new — CI copy of Tom's persona files)
