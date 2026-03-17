# Proposal: Watchlist Page

## Why

The current Signals page shows ~13 active trade setups — great for "what to trade today." But there's no way to track the full ~70-symbol watchlist at a glance. Users have to open individual cards or go to TradingView separately. A dedicated watchlist page lets you monitor everything in one place.

## What Changes

### New Page: `watchlist.html`

A full watchlist view with two modes:

1. **Widget View** — TradingView Market Overview embed widget with tabbed groups (Quality Stocks, Sector ETFs, Macro, Community Ideas). Live prices, sparkline charts, % change — all powered by TradingView's free widget.

2. **Table View** — Custom sortable HTML table with columns: Ticker, Price, % Change, SMA20 Dist, SMA50 Dist, Bias, Status, Sector. Data from `watchlist.json`. Click any row to open the detail modal (same modal as Signals page).

Toggle between views with a button. Table view is data-dense (traders who want numbers), widget view is visual (quick scan).

### Shared Navigation

Adds a top nav bar shared across all pages: `Signals | Watchlist | Market`. Active page highlighted. Macro strip and timezone selector persist across pages.

## Capabilities

### New
- **watchlist-widget** — TradingView Market Overview embed with tabbed symbol groups
- **watchlist-table** — Sortable custom table with computed signals from pipeline JSON

### Modified
- Navigation bar added to `index.html` (Signals page)
- Detail modal shared across pages (click-through from watchlist)

## Impact
- New file: `watchlist.html`
- New file: `js/watchlist.js` (or inline for MVP)
- Modified: `index.html` (add nav bar)
- Data dependency: `data/watchlist.json` (from pipeline)
- No backend changes — static page consuming existing JSON
