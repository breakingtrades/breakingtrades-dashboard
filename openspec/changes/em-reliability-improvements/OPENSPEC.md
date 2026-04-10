# EM Reliability Improvements — OpenSpec

> Created: 2026-04-09
> Status: **In Progress**
> Priority: **High**
> Triggered by: Apr 9 tariff-pause rally — EM page showed stale $659 anchor while SPY was $680 (+9%)

## Problem

On Apr 9, 2026, SPY rallied 9% on tariff pause news. The EM page showed SPY at $659.22 / "50% MODERATE" — misleading. The intraday prices pipeline (3×/day GH Actions) was working fine, but EM bounds only recalculated at EOD (4:20 PM). On a big gap day, yesterday's straddle values produce meaningless bounds.

## Root Cause

1. **EM only recalculates at EOD** — not in the intraday pipeline
2. **Morning price run at 9:35 AM** — yfinance has 15-min delay, so pre-9:45 fetches return yesterday's close

## Improvements

### 1. Add EM Daily Tier to Intraday Pipeline ✅
Added `update-expected-moves.py --tier daily` to `.github/workflows/update-prices.yml`. EM now refreshes 3×/day alongside prices.

### 2. Fix Morning Run Timing ✅
Shifted 9:35 AM → 9:50 AM ET to account for yfinance 15-min delay.

### 3. EM Staleness Display Enhancement
**Priority: Medium** — When EM bounds are >8h old during market hours, dim risk column + show age per row.

### 4. EM Breach Alerts (Telegram)
**Priority: Medium** — Alert when SPY/QQQ cross above/below weekly EM. New `scripts/check-em-breach.py`, runs in intraday pipeline.

### 5. Portfolio EM Risk Score
**Priority: Low** — Aggregate position-weighted risk stat card.

## Schedule After Fix
```
 9:50 AM ET  → update-prices.py + update-expected-moves.py --tier daily
12:00 PM ET  → update-prices.py + update-expected-moves.py --tier daily
 3:00 PM ET  → update-prices.py + update-expected-moves.py --tier daily
 4:20 PM ET  → eod-update.sh (full pipeline, Fri = all EM tiers)
```
