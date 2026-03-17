# Proposal: Market Page

## Why

The Signals page answers "what to trade" but doesn't answer "what's the market doing?" Traders need macro context before placing any trade. A dedicated Market page gives a top-down view: sector performance via heatmap, market sentiment via Fear & Greed, and intermarket relationships via pair ratios — all in one place.

Currently the macro strip and pair ratios are on the Signals page but they're secondary to the setup cards. The Market page makes them primary.

## What Changes

### New Page: `market.html`

A market health dashboard with three core components:

1. **Sector Heatmap** — TradingView Stock Heatmap widget showing S&P 500 grouped by sector, colored by daily % change. Interactive — click to zoom into sectors, tooltip shows details.

2. **Fear & Greed Index** — CNN Fear & Greed Index rendered as a custom semicircle gauge. Data sourced via Python pipeline (no client-side API call). Shows current value, classification, and comparison to previous close / 1 week / 1 month ago.

3. **Market Health Panel** — Pair ratios (XLY/XLP, RSP/SPY, HYG/SPY, etc.), VIX regime, sector strength rankings. Mostly moved/duplicated from the Signals page right panel.

### Shared Navigation

Top nav bar across all pages: `Signals | Watchlist | Market`.

### Pipeline Addition

`export-dashboard-data.py` gains a Fear & Greed scraper that writes `data/fear-greed.json` on each run.

## Capabilities

### New
- **sector-heatmap** — TradingView Stock Heatmap embed (S&P 500, sector grouped, dark theme)
- **fear-greed-gauge** — Custom CSS/SVG gauge rendering CNN F&G data from pipeline JSON
- **shared-navigation** — Top nav bar component shared across all 3 pages

### Modified
- Pipeline (`scripts/export-dashboard-data.py`) — adds Fear & Greed data generation
- Pair ratios potentially duplicated on Market page (or linked)

## Impact
- New file: `market.html`
- New file: `js/market.js` (or inline for MVP)
- New data: `data/fear-greed.json`
- Modified: `scripts/export-dashboard-data.py` (add F&G scraper)
- Modified: `index.html` (add nav bar)
- New pip dependency: `fear-greed-index`
