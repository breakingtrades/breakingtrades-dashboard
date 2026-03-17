# Proposal: Watchlist Export Engine

## What
A bridge script that reads existing BreakingTrades data (CSVs, watchlist snapshots, Tom agent output) and exports dashboard-ready JSON files to this repo.

## Why
- Market data pipeline already exists in `~/projects/breakingtrades/` (958 CSVs, screener.py, update_data.py)
- Watchlist scraping already exists (`scrape_tv_watchlist.sh`)
- Tom's agent brain already exists (`agents/tom-fxevolution/`)
- **Duplicating any of this is waste.** The dashboard is a presentation layer.

## What it does NOT do
- Download market data (existing scripts do this)
- Scrape watchlists (existing script does this)
- Store CSVs (they live in the parent project)

## What it DOES
1. Read latest watchlist snapshot → extract symbols + sections
2. Read CSV data → compute current SMA 20/50/100/150/200, Weekly SMA 20, RSI, bias
3. Determine setup status for each ticker (WATCHING → APPROACHING → TRIGGERED → ACTIVE)
4. Run Tom agent analysis → cache daily briefing + per-ticker takes
5. Write JSON → `data/watchlist.json`, `data/setups.json`, `data/macro.json`, `data/tom/`
6. Commit + push to this repo → GitHub Pages auto-deploys

## Entry point
`scripts/export-dashboard-data.py` — single script, runs from parent project context
