# Tasks: Watchlist Engine

## Task 1: Project Scaffolding
- [ ] Create `data/pipeline/` directory structure
- [ ] Create `data/config/watchlist-override.json` with sample symbols
- [ ] Create `data/output/.gitkeep`
- [ ] Create `data/pipeline/requirements.txt` (yfinance, pandas, numpy, requests, beautifulsoup4)
- **Estimate:** 15 min

## Task 2: Watchlist Scraper (`scrape_watchlist.py`)
- [ ] Implement TradingView shared watchlist URL parsing
- [ ] Extract symbols with exchange prefix and section grouping
- [ ] Implement fallback to `watchlist-override.json`
- [ ] Add retry logic with exponential backoff (3 attempts)
- [ ] Add logging
- **Estimate:** 1-2 hours

## Task 3: Signal Computation (`compute_signals.py`)
- [ ] Implement batch yfinance download for all symbols
- [ ] Implement `compute_ema(series, period)` using pandas ewm
- [ ] Implement `compute_rsi(series, period=14)` using Wilder's method
- [ ] Implement `determine_bias(price, ema8, ema21, ema50)`
- [ ] Implement `find_levels(df)` for 6-month high/low extraction
- [ ] Compute `pct_from_high` for 52-week high distance
- [ ] Add error handling for insufficient data
- **Estimate:** 2-3 hours

## Task 4: Setup Generator (`generate_setups.py`)
- [ ] Filter symbols for actionable setups (bias != Mixed, RSI < 75)
- [ ] Calculate entry zone, stop loss, target levels
- [ ] Compute risk:reward ratio
- [ ] Generate confidence score based on alignment strength
- [ ] Generate one-line thesis placeholder (AI-generated in Phase 3)
- **Estimate:** 1-2 hours

## Task 5: Pipeline Orchestrator (`run_pipeline.py`)
- [ ] Wire scrape → compute → generate pipeline
- [ ] Write `watchlist.json` and `setups.json` to `data/output/`
- [ ] Add summary logging
- [ ] Add CLI argument support (--url, --config, --output-dir)
- [ ] Test end-to-end with sample watchlist
- **Estimate:** 1 hour

## Task 6: GitHub Actions Workflow
- [ ] Create `.github/workflows/refresh-data.yml`
- [ ] Configure cron schedule: `35 13 * * 1-5` (9:35 AM ET, weekdays)
- [ ] Add `workflow_dispatch` for manual triggers
- [ ] Set up Python, install dependencies, run pipeline
- [ ] Auto-commit and push updated JSON files
- **Estimate:** 30 min

## Task 7: Testing & Validation
- [ ] Spot-check EMA values against TradingView for 5 symbols
- [ ] Validate JSON schema matches frontend expectations
- [ ] Test with empty watchlist, single symbol, full watchlist
- [ ] Verify GitHub Actions workflow runs successfully
- **Estimate:** 1 hour

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 (sequential, each depends on prior)

## Total Estimate: 7-10 hours
