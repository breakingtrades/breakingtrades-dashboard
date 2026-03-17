## Why

The dashboard needs computed trading data (SMA levels, RSI, bias classification, trade lifecycle status, retest detection, pair ratios, macro indicators) to render setup cards and context panels. Currently all data in `index.html` is hardcoded. A Python pipeline running on local Mac via cron will compute analysis from 958 CSVs (IB/yfinance data) and export static JSON files that GitHub Pages serves.

## What Changes

- New Python export script (`scripts/export-dashboard-data.py`) computes all signals from CSV price data
- Implements the full 9-state trade lifecycle from `docs/TRADE_LIFECYCLE.md` (WATCHING → APPROACHING → RETEST → TRIGGERED → ACTIVE → EXIT_SIGNAL → STOPPED → DORMANT)
- Computes retest detection algorithm with confidence scoring and volume health checks
- Computes confluence zone detection (multiple MAs converging within 2-3%)
- Computes 12 pair ratios with trend classification (RISING/FALLING/FLAT)
- Computes macro strip data (VIX, Oil, DXY, Copper, BTC, Gold)
- Generates pre-computed Tom's Take analysis per ticker via LLM calls
- Generates daily briefing JSON (regime, risk level, top setups, action items)
- Outputs static JSON to `data/` directory, committed and pushed to trigger GitHub Pages deploy
- Cron schedule: 9:35 AM ET (market open) + 4:00 PM ET (market close), weekdays only

## Capabilities

### New Capabilities
- `signal-computation`: SMA 20/50/100/200 calculation, RSI-14 (Wilder's), bias classification (BULL/BEAR/MIXED), % from 6mo high, for all 70 watchlist symbols across daily + weekly timeframes
- `trade-lifecycle`: Full 9-state status engine implementing `docs/TRADE_LIFECYCLE.md` — retest detection (was above 3-10 sessions ago, now within -1.5% to +2.0%, healthy volume), approaching detection, exit signal detection (daily close below SMA20/50/W20), confluence zone identification
- `pair-ratio-engine`: 12 ratio pairs computed with SMA20 trend direction, EMA 13/26 signals, current value + % change
- `macro-aggregation`: VIX, Oil (CL), DXY, Copper (HG), BTC, Gold, US10Y, US02Y — pulled from existing CSVs or yfinance
- `tom-analysis-gen`: LLM-powered pre-generation of per-ticker Tom's Take and daily briefing, using Tom's agent context (`~/projects/breakingtrades/agents/tom-fxevolution/`)
- `pipeline-orchestrator`: CLI entry point that runs all stages, writes JSON, optionally commits+pushes to git

### Modified Capabilities

_(none — no existing specs)_

## Impact

- **New files:** `scripts/export-dashboard-data.py`, `scripts/requirements.txt`, `data/*.json` (6-8 output files)
- **Data directory:** `data/watchlist.json`, `data/setups.json`, `data/macro.json`, `data/pairs.json`, `data/tom/briefing.json`, `data/tom/takes/*.json`
- **Dependencies:** Python 3.11+, pandas, yfinance, numpy; Azure OpenAI or Anthropic API for Tom analysis gen
- **Input data:** 958 CSVs at `~/projects/breakingtrades/data/{ticker}_{timeframe}.csv`
- **Cron:** Two macOS launchd/crontab entries for weekday runs
- **Git:** Auto-commit + push from pipeline triggers GitHub Pages rebuild (~2 min latency)
