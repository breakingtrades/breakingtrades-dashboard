# Futures & Macro Pre-Market Strip

> Status: ✅ Shipped  
> Date: 2026-03-19  
> Author: Kash (AI)

## Summary

Added a real-time futures and macro data strip to the top of the dashboard, below the nav bar and above the existing macro context strip. Shows 14 instruments across 5 groups with live pre-market/regular session data from Yahoo Finance.

## Instruments (14 total)

| Group | Tickers |
|-------|---------|
| **Indices** | ES (S&P 500), NQ (Nasdaq), RTY (Russell), YM (Dow) |
| **Commodities** | CL (Crude), NG (Nat Gas), GC (Gold), SI (Silver), HG (Copper) |
| **Rates** | US10Y (^TNX), DXY (DX-Y.NYB) |
| **Volatility** | VIX (^VIX) |
| **Crypto** | BTC (BTC-USD), ETH (ETH-USD) |

## Architecture

- **Data source:** Yahoo Finance v8 Chart API (no auth required)
- **Script:** `scripts/update_futures.py` — fetches all 14 quotes, writes `data/futures.json`
- **Renderer:** `js/futures-strip.js` — reads JSON, renders grouped strip with color-coded % changes
- **Refresh:** Run script on cron every 2-5 min during market hours

### Suggested cron
```
*/2 4-20 * * 1-5 cd ~/projects/breakingtrades/breakingtrades-dashboard && python3 scripts/update_futures.py
```

## Files

| File | Action |
|------|--------|
| `scripts/update_futures.py` | **Created** — Yahoo v8 data fetcher |
| `js/futures-strip.js` | **Created** — Strip renderer |
| `data/futures.json` | **Created** — Auto-generated data file |
| `index.html` | **Modified** — CSS + HTML + script tag |

## Visual

Strip renders as a horizontal scrollable bar with emoji group separators (📈🛢️🏦⚡₿), ticker labels, prices, and color-coded percentage changes (cyan=up, red=down). Timestamp shows last update time.
