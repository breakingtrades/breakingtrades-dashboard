# Global Ticker Search

> Status: ✅ Shipped  
> Date: 2026-03-19  
> Author: Kash (AI)

## Summary

Added a global search bar in the nav bar that searches any ticker via Yahoo Finance symbol lookup. Results are split into two categories:

- **TRACKED** (green badge) — tickers in the BT watchlist → opens enriched detail modal with all BT data (levels, patterns, signals, charts, analysis)
- **TV** (orange badge) — external tickers → opens TradingView widget overlay with daily/weekly charts, technical analysis, company profile, and financials

## Features

- Real-time Yahoo Finance symbol search (proxied through local server)
- Instant local matching for tracked tickers (no network delay)
- Keyboard navigation: `/` to focus, ↑↓ arrows, Enter to select, Esc to close
- Debounced remote search (300ms)
- Two detail modes: enriched (tracked) vs TradingView-only (external)

## TradingView External Detail

For untracked tickers, the modal shows:
1. **Daily & Weekly charts** — TradingView Advanced Chart widget with SMA 20/50
2. **Technical Analysis** — Buy/Sell/Neutral signals with interval tabs
3. **Company Profile** — TradingView Symbol Profile widget
4. **Financials** — TradingView Financials widget
5. **Link** — "Open on TradingView ↗" for full analysis

## Architecture

Yahoo's v1 search API has CORS restrictions. Solution: `scripts/serve.py` replaces `python -m http.server` as the dashboard server, serving both static files and a `/api/search?q=` proxy endpoint.

## Files

| File | Action |
|------|--------|
| `js/ticker-search.js` | **Created** — Search logic, dropdown, TV detail overlay |
| `scripts/serve.py` | **Created** — Dashboard server with Yahoo search proxy |
| `index.html` | **Modified** — CSS + HTML for search bar and dropdown |

## Dependencies

- `scripts/serve.py` must be used instead of `python -m http.server` for search to work
- TradingView embed widgets loaded from `s3.tradingview.com` CDN
