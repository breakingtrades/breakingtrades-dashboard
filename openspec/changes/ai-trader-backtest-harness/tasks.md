# AI-Trader Backtest Harness — Tasks

## 1. Spec Authoring

- [x] 1.1 Author proposal.md (capabilities + constraints + open questions)
- [x] 1.2 Author design.md (architecture + replay loop + look-ahead checklist)
- [x] 1.3 Author 4 capability spec.md files
- [x] 1.4 `openspec validate ai-trader-backtest-harness --strict` passes
- [ ] 1.5 Subagent review of spec (opus-4.7, fresh context, 5min budget)
  - Focus: math correctness, look-ahead bias, fixture realism
- [ ] 1.6 Address review feedback if any

## 2. Historical Data Layer

- [ ] 2.1 `scripts/ai-trader/backtest_lib/data_fetcher.py`:
  - OHLC cache for 88-ticker universe via yfinance
  - Disk-backed parquet cache to avoid re-fetching across runs
  - Auto-adjust=True (handles splits + dividends)
  - Trims to date range; exposes `cache.bars(ticker, date)` API
- [ ] 2.2 `scripts/ai-trader/backtest_lib/em_proxy.py`:
  - `compute_em_proxy(close, atr20, group)` returning the schema-compatible
    expected-moves entry per ticker
  - ATR(20) calculation using True Range (max of (H-L, |H-PC|, |L-PC|))
- [ ] 2.3 `scripts/ai-trader/backtest_lib/regime_replay.py`:
  - Replay regime classifier with backfilled VIX/F&G/breadth
  - Output schema-identical to live `data/regime.json`
- [ ] 2.4 `scripts/ai-trader/backtest_lib/breadth_replay.py`:
  - Compute % of S&P sector ETFs above SMA(50) and SMA(200) for date D
  - Schema match: `data/breadth.json`
- [ ] 2.5 Fear & Greed historical fetcher:
  - Pull CNN historical archive (try local cache first, then public mirror)
  - Fall back to neutral 50 for missing dates with warning
- [ ] 2.6 VIX/MOVE backfill via yfinance ^VIX / ^MOVE
- [ ] 2.7 `scripts/ai-trader/backtest_lib/sector_rotation_replay.py`:
  - 21-day sector ETF performance ranking
- [ ] 2.8 `scripts/ai-trader/backtest_lib/signals_replay.py`:
  - Replay signal scanner state for date D from price position vs ATR-band
- [ ] 2.9 Tests: `test_em_proxy.py`, `test_atr_calc.py`, `test_no_lookahead.py`

## 3. Fixture Builder

- [ ] 3.1 `scripts/ai-trader/backtest_lib/fixture_builder.py`:
  - `build_day_fixture(D, cache, output_dir)` → writes 8 JSON files
  - Each file matches the live pipeline's expected schema exactly
  - All content trimmed to ≤ D-1 except `prices.json` (D close)
- [ ] 3.2 Static fixtures (built once at run start, copied to each day):
  - `watchlist.json` — current 88-ticker list
  - `empirical-priors.json` — current 2 studies (Phase 5 frozen; Phase 6
    regenerates per-date)
- [ ] 3.3 Test: build fixture for 2024-06-15, validate schema match against
  a same-day production snapshot

## 4. Backtest Orchestrator

- [ ] 4.1 `scripts/ai-trader/backtest.py` CLI:
  - Args: `--start`, `--end`, `--run-id`, `--benchmark`, `--no-cache`,
    `--resume`, `--verbose`
  - Trading-day enumeration via `pandas_market_calendars`
- [ ] 4.2 State carry-forward:
  - Copy holdings.json + risk-state.json from D-1 state to D state dir
  - On day 1: initialize fresh state ($100K equity)
- [ ] 4.3 Pipeline invocation in-process:
  - Use `Paths.set_data_root()` + `Paths.set_dashboard_data_root()`
  - Import scout/analyst/risk/executor/manager modules; call `.run()`
  - Catch and log per-day exceptions; fail fast on critical errors
- [ ] 4.4 Per-day ledger append:
  - After day D, append fills.jsonl + closes.jsonl from state/D/ to
    run-level fills.jsonl + closes.jsonl
- [ ] 4.5 Final track-record run:
  - After all days complete, run `track_record.run()` over the run-level
    ledger to produce `track-record.json`
- [ ] 4.6 Resume support:
  - `--resume run-NNN` re-uses cache + fixtures, picks up at last completed day
- [ ] 4.7 Test: 30-day smoke run completes in < 60s

## 5. Benchmarks

- [ ] 5.1 `scripts/ai-trader/backtest_lib/benchmark.py`:
  - `spy_buy_and_hold(start, end, equity)` — reinvested-dividends
  - `sixty_forty(start, end, equity, rebal="quarterly")` — 60% SPY / 40% IEF
- [ ] 5.2 Tests cover correctness against known-good values

## 6. Reporting

- [ ] 6.1 `scripts/ai-trader/backtest_lib/reporter.py`:
  - Compute Sharpe, Sortino, Calmar, max DD + recovery time
  - Emit `report.json` schema (see design.md)
  - Emit `dashboard-summary.json` for the `/#backtest` page
- [ ] 6.2 Per-rule attribution rollup:
  - Same logic as Phase 3 `track_record._by_rule` but over backtest closes
  - Add by_year breakdown
  - Add `first_fired` / `last_fired` dates
- [ ] 6.3 Regime-bucketed performance:
  - Group closes by regime at entry (BULL/BEAR/RANGE)
  - Per-bucket: trades, win_rate, total_pnl
- [ ] 6.4 Sector breakdown:
  - Per-sector: trades, win_rate, total_pnl, max position
- [ ] 6.5 Tests: `test_reporter_metrics.py` w/ known-good fixture

## 7. Dashboard Page

- [ ] 7.1 `breakingtrades-dashboard/js/pages/backtest.js`:
  - Fetch `data/ai-trader/backtest-latest.json`
  - Tabbed UI: Overview / Equity / Rules / Regimes / Trades
- [ ] 7.2 Equity curve chart:
  - Backtest curve + SPY + 60/40 overlay
  - Y-axis tabular-nums, HTML overlay (Phase 3 lessons learned)
- [ ] 7.3 Rule attribution table:
  - 296 rules sortable by total_pnl
  - Click rule_id → modal with rule text + per-year breakdown
- [ ] 7.4 Regime/sector breakdown panels
- [ ] 7.5 Disclaimer chrome:
  - "Backtest uses ATR×√5 EM proxy (not real options chain). Survivorship
    bias possible (current watchlist). Pre-tax. No borrow costs on shorts."
- [ ] 7.6 Router entry: `'backtest': { css: ..., js: ..., title: 'Backtest' }`
- [ ] 7.7 Sidebar: add Backtest entry under "Performance" section
- [ ] 7.8 EOD pipeline: copy backtest/latest-run-summary.json into the
  dashboard's data/ai-trader/

## 8. Smoke Test (3 months)

- [ ] 8.1 Run `python scripts/ai-trader/backtest.py --start 2024-01-01
  --end 2024-03-31 --run-id smoke-q1-2024`
- [ ] 8.2 Verify completes in < 90s
- [ ] 8.3 Verify report.json contains all metrics + benchmark comparisons
- [ ] 8.4 Verify equity curve has > 0 changes
- [ ] 8.5 Verify rule attribution has ≥ 10 rules with > 0 trades
- [ ] 8.6 Run twice, diff outputs, confirm byte-identical

## 9. Full 5-Year Run

- [ ] 9.1 `python scripts/ai-trader/backtest.py --start 2021-06-01
  --end 2026-06-13 --run-id main-2026-06-13`
- [ ] 9.2 Verify completes in < 15 min
- [ ] 9.3 Hand-eyeball results against Phase 5 acceptance criteria:
  - Sharpe > 0.4? (or document why not)
  - Max DD < 25%? (or document why not)
  - ≥ 50 of 296 rules net-positive?
- [ ] 9.4 Generate published-quality report:
  - `backtest/run-main-2026-06-13/report.html` with embedded charts
  - Hand-write a 1-paragraph summary on dashboard's About panel
- [ ] 9.5 If any criterion fails: write Phase 6 follow-on with proposed
  fixes (rule weighting, conviction floor tuning, etc.)

## 10. Subagent Review

- [ ] 10.1 Delegate fresh-context review (opus-4.7, 5min):
  - Files: backtest.py + fixture_builder.py + reporter.py + em_proxy.py
  - Focus: look-ahead bias, math correctness, schema compliance
- [ ] 10.2 Address review feedback
- [ ] 10.3 Verify 47/47 + new tests still pass

## 11. Commit + Ship

- [ ] 11.1 Commit OpenSpec change to dashboard repo
- [ ] 11.2 Commit backtest_lib + scripts to parent repo
- [ ] 11.3 Commit dashboard page (js/pages/backtest.js + css/backtest.css)
- [ ] 11.4 Push both repos
- [ ] 11.5 SWA deploy verification
- [ ] 11.6 Mark this OpenSpec change as deployed in `openspec list`

## Acceptance

When all of:
- 47/47 + new backtest tests pass
- 5-year backtest runs in < 15 min on a laptop
- Dashboard `/#backtest` page renders the report
- `openspec validate --all --strict` passes for this change
- Subagent review caught issues are addressed
- 3-month smoke run is byte-identical across two invocations

Then Phase 5 is shipped and ready for archive.
