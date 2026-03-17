# Tasks: Data Pipeline

## Task 1: Project scaffolding and dependencies
- [ ] Create `scripts/export-dashboard-data.py` with argparse CLI (`--data-dir`, `--output-dir`, `--ticker`, `--skip-tom`, `--push`)
- [ ] Create `scripts/requirements.txt` (pandas, yfinance, numpy, requests, openai)
- [ ] Create `data/` directory structure: `data/tom/takes/`, `data/tom/`
- [ ] Create `.gitkeep` files in output directories
- **Estimate:** 20 min
- **Ref:** `docs/DATA_ARCHITECTURE.md` (architecture diagram)

## Task 2: Watchlist loader
- [ ] Load watchlist from `~/projects/breakingtrades/fxevolution/watchlists/fxevolution-watchlist-2026-03-17.txt` (70 symbols, 5 sections)
- [ ] Parse sections (Core Watchlist, ETFs, Pair Ratio Components, Macro Proxies, Community Ideas)
- [ ] Map each symbol to its sector (Technology, Healthcare, Energy, Utilities, Consumer, Financials, Crypto, Macro, ETF)
- [ ] Support `--ticker AAPL` override for single-ticker mode
- **Estimate:** 30 min

## Task 3: Signal computation engine
- [ ] Load CSV from `{data_dir}/{ticker}_daily.csv` with `on_bad_lines='skip'`
- [ ] Load CSV from `{data_dir}/{ticker}_weekly.csv` with `on_bad_lines='skip'`
- [ ] Compute SMA 20, 50, 100, 200 on daily Close using `pandas.Series.rolling().mean()`
- [ ] Compute SMA 20, 50, 100, 200 on weekly Close
- [ ] Compute RSI-14 using Wilder's smoothing (`pandas.Series.ewm(alpha=1/14)`)
- [ ] Compute % from 6-month high (126 trading days)
- [ ] Classify bias: BULL (price > SMA20 > SMA50 AND price > Weekly SMA20), BEAR (inverse), else MIXED
- [ ] Handle missing CSVs gracefully (skip, log warning, exclude from output)
- [ ] Handle insufficient data (compute available SMAs, null for unavailable)
- **Estimate:** 2 hours
- **Ref:** `openspec/changes/data-pipeline/specs/signal-computation/spec.md`

## Task 4: Trade lifecycle classifier
- [ ] Implement RETEST detection: was above level 3-10 sessions ago by >2%, now within -1.5% to +2.0%, from above
- [ ] Compute volume health: compare pullback volume to breakout volume (< 80% = HEALTHY, >= 80% = ELEVATED)
- [ ] Assign retest confidence: HIGH (volume healthy + close to level), MEDIUM (volume elevated or far from level)
- [ ] Implement confluence zone detection: SMA20 + SMA50 + W20 within 3% of each other
- [ ] Implement APPROACHING detection: within 5% of SMA20 or SMA50 from below
- [ ] Implement EXIT_SIGNAL detection: daily close below SMA20 (EXIT_SMA20), below SMA50 (EXIT_SMA50), weekly close below W20 (EXIT_W20)
- [ ] Implement WATCHING state: on watchlist, not near any level
- [ ] Implement DORMANT state: below all MAs by >10%, no activity
- [ ] Assign sort priority per status (RETEST HIGH=1, MEDIUM=2, APPROACHING <2%=3, EXIT=4, ACTIVE=5, etc.)
- [ ] Map each setup to status group: Hot (RETEST+APPROACHING), Active, Alerts (EXIT_*), Watching, Inactive (STOPPED+DORMANT)
- **Estimate:** 3 hours
- **Ref:** `docs/TRADE_LIFECYCLE.md`, `openspec/changes/data-pipeline/specs/trade-lifecycle/spec.md`

## Task 5: Pair ratio engine
- [ ] Compute 12 pair ratios: XLY/XLP, HYG/SPY, IWF/IWD, RSP/SPY, XLV/SPY, IWM/SPY, IWM/QQQ, XLE/SPY, GLD/SPY, TLT/SPY, SLV/GLD, HYG/TLT
- [ ] Compute SMA20 on each ratio series
- [ ] Classify trend: RISING (SMA20 slope positive over 5 sessions), FALLING (negative), FLAT (within ±0.1%)
- [ ] Compute EMA 13/26 on each ratio, flag crossovers (BULLISH_CROSS, BEARISH_CROSS, ABOVE, BELOW)
- [ ] Include interpretation labels (e.g., XLY/XLP = "Consumer Strength")
- [ ] Output: `{ pair, numerator, denominator, value, change_5d, trend, signal, ema_signal, label }`
- **Estimate:** 1.5 hours
- **Ref:** `docs/PAIR_RATIOS.md`, `openspec/changes/data-pipeline/specs/pair-ratio-engine/spec.md`

## Task 6: Macro aggregation
- [ ] Read macro CSVs: VIX, DXY, CL (oil), HG (copper), BTC-USD, GC (gold), ^TNX (10Y), ^IRX or proxy (2Y)
- [ ] Fall back to yfinance if CSV missing or stale (>3 trading days)
- [ ] Compute 5-day change and direction (UP/DOWN/FLAT)
- [ ] Assign signal emoji (context-dependent: VIX up = 🔴, DXY down = 🟢)
- [ ] Determine market status (OPEN/CLOSED/PRE/POST based on current time + NYSE hours)
- [ ] Output `data/macro.json`: `{ indicators: [...], market_status }`
- **Estimate:** 1 hour
- **Ref:** `openspec/changes/data-pipeline/specs/macro-aggregation/spec.md`

## Task 7: Tom analysis generation
- [ ] Load Tom's system prompt (compress AGENT.md + SOUL.md to ~3,500 tokens)
- [ ] Load Tom's RULES.json (top 10 rules, ~400 tokens)
- [ ] Load MARKET_MEMORY.md (current regime section, ~500 tokens)
- [ ] For each ticker: build context (setup data + sector + macro), call LLM, parse response
- [ ] Validate output matches schema: `{ symbol, take, action, key_level, key_level_name, confidence, bias, signals[], suggested_questions[], updated }`
- [ ] Strip any FXEvolution/external source references from generated text
- [ ] Write `data/tom/takes/{TICKER}.json` for each ticker
- [ ] Generate daily briefing: call LLM with all macro + top setups, write `data/tom/briefing.json`
- [ ] Handle LLM API failures: log error, use fallback template
- [ ] Support `LLM_PROVIDER` env var: `azure` (default) or `anthropic`
- [ ] Rate limit: 1 second delay between LLM calls
- **Estimate:** 2.5 hours
- **Ref:** `docs/TOM_CHAT_SPEC.md` §6, `openspec/changes/data-pipeline/specs/tom-analysis-gen/spec.md`

## Task 8: JSON output and git push
- [ ] Write `data/watchlist.json` (symbol list with sections and sectors)
- [ ] Write `data/setups.json` (all tickers with signals, lifecycle status, sort priority)
- [ ] Write `data/macro.json` (macro indicators)
- [ ] Write `data/pairs.json` (12 pair ratios)
- [ ] Write `data/tom/briefing.json` (daily briefing)
- [ ] Write `data/tom/takes/{TICKER}.json` (per-ticker, ~70 files)
- [ ] If `--push` flag: `git add data/ && git commit -m "data: refresh [timestamp]" && git push`
- [ ] Skip commit if no files changed
- [ ] Log pipeline summary: symbols processed, skipped, retests found, exits found, duration
- **Estimate:** 45 min
- **Ref:** `openspec/changes/data-pipeline/specs/pipeline-orchestrator/spec.md`

## Task 9: Testing and validation
- [ ] Test with `--ticker AAPL` single-symbol mode
- [ ] Test with full watchlist (70 symbols)
- [ ] Spot-check SMA20/50 values against TradingView for 5 tickers
- [ ] Validate all JSON output schemas match frontend expectations
- [ ] Test with missing CSVs (should skip, not crash)
- [ ] Test `--skip-tom` flag (data stages only, no LLM calls)
- [ ] Test `--push` flag with clean git state
- [ ] Verify pipeline completes in < 5 minutes
- **Estimate:** 1 hour

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

## Dependencies
- Tasks 1-2: no dependencies
- Task 3: depends on Task 2 (watchlist loader)
- Task 4: depends on Task 3 (needs computed signals)
- Tasks 5-6: depend on Task 2 (need symbol list), can run parallel to Task 4
- Task 7: depends on Tasks 3-6 (needs all computed data)
- Task 8: depends on all prior tasks
- Task 9: depends on Task 8

## Total Estimate: 12-14 hours
