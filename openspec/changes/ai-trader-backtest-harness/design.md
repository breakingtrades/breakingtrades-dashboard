# AI-Trader Backtest Harness — Design

## Context

We have:

- A 6-stage deterministic pipeline: `scout.py → analyst.py → risk.py →
  executor.py → manager.py → track_record.py`
- Each stage reads from `dashboard/data/` (live data files) and writes to
  `data/ai-trader/` (state files)
- A `Paths` singleton in `io_helpers.py` that lets us swap roots in-process
- 296 hand-curated Tom rules + 2 empirical-priors studies, both static
  history-derived assets
- 88-ticker universe (76 watchlist + 12 macro proxies)
- Disclaimer chrome and risk-engine-as-sole-gatekeeper invariants verified
  by spec MUST clauses

## What we're building

A wrapper that:

1. For each trading day D in `[start, end]`:
   - Builds a **fixture root** at `backtest/run-NNN/fixture/D/` containing:
     - `prices.json` — yfinance OHLC for D (close prices for executor)
     - `expected-moves.json` — ATR×√5 proxy bands for the 88 universe
     - `regime.json` — replay regime classifier with backfilled VIX/F&G
     - `breadth.json` — % above SMA50/200 from sector ETF closes
     - `fear-greed.json` — CNN historical
     - `vix.json` — yfinance ^VIX close
     - `signals.json` — replay signal scanner (state at D close)
     - `sector-rotation.json` — rolling sector strength
     - `watchlist.json` — current 88-ticker list with sectors
   - Repoints `Paths` at the fixture
   - Runs the pipeline (same code as live)
   - Snapshots the resulting `holdings.json`/`risk-state.json` to carry
     forward to D+1
   - Appends the day's `fills.jsonl` and `closes.jsonl` to a running run-
     level ledger
2. After loop completes: runs `track_record.py` once over the full ledger,
   emits `backtest/run-NNN/track-record.json` + a flat `report.json` with
   all metrics computed
3. Backtest dashboard page reads `backtest/latest-run.json` (a symlink
   or pointer file at fixed path) and renders the dossier

## Architecture

### Module layout

```
scripts/ai-trader/backtest.py                    # CLI entry, orchestrator
scripts/ai-trader/backtest_lib/
  __init__.py
  fixture_builder.py                              # build_day_fixture(D)
  data_fetcher.py                                 # yfinance OHLC + cache
  em_proxy.py                                     # ATR×√5 + dailies
  regime_replay.py                                # historical regime calc
  breadth_replay.py                               # sector-ETF breadth
  benchmark.py                                    # SPY + 60/40 calculators
  reporter.py                                     # equity curve + Sharpe + DD + attribution
  schemas.py                                      # BacktestRun, BacktestReport dataclasses

backtest/                                         # output dir (parent repo)
  index.json                                      # registry of all runs
  run-NNN/
    fixture/                                      # per-day input snapshots
      2021-06-01/{prices,expected-moves,...}.json
      2021-06-02/...
    state/                                        # per-day state snapshots
      2021-06-01/{holdings,risk-state}.json
      ...
    fills.jsonl                                   # all entry fills
    closes.jsonl                                  # all exit fills
    track-record.json                             # final dossier
    report.json                                   # flat report w/ benchmarks
    config.json                                   # what was run + when
    log.txt                                       # per-day log

breakingtrades-dashboard/data/ai-trader/
  backtest-latest.json                            # symlink/copy of latest report.json
  backtest-equity-curve.json                      # for the dashboard chart
  backtest-rule-attribution.json                  # for the rules table
```

### The replay loop

```python
# backtest.py main loop
def run_backtest(start: date, end: date, run_id: str) -> BacktestReport:
    universe = load_universe()  # 88 tickers
    cache = data_fetcher.OHLCCache(tickers=universe, start=start - 60d, end=end)
    cache.warmup()  # pre-fetches all bars, ~10 min

    # Initialize fresh portfolio state
    state = RiskState(account_equity=100_000, ...)
    holdings = {"cash": 100_000, "positions": []}

    for D in trading_days(start, end):
        # 1. Build fixture for day D
        fixture_root = run_dir / "fixture" / D.isoformat()
        fixture_builder.build_day_fixture(D, cache, fixture_root)

        # 2. Point pipeline at fixture root
        Paths.set_dashboard_data_root(fixture_root)
        Paths.set_data_root(run_dir / "state" / D.isoformat())

        # 3. Restore state from D-1 (or starting state on day 1)
        if prev_state_dir.exists():
            shutil.copy(prev_state_dir / "holdings.json", current_state_dir)
            shutil.copy(prev_state_dir / "risk-state.json", current_state_dir)

        # 4. Run the pipeline (SAME CODE as live)
        scout.run()
        analyst.run()
        risk.run()
        executor.run()
        manager.run()

        # 5. Append day's fills/closes to run-level ledger
        append_day_to_ledger(run_dir, current_state_dir, D)

    # After all days: run track_record once over full ledger
    Paths.set_data_root(run_dir / "final")
    track_record.run()

    # Compute benchmarks
    spy_curve = benchmark.spy_buy_and_hold(start, end, 100_000)
    sixty_forty = benchmark.sixty_forty(start, end, 100_000)

    return reporter.build_report(
        run_dir=run_dir,
        spy_curve=spy_curve,
        benchmark_60_40=sixty_forty,
    )
```

### Fixture builder details

For each date D, we build 8 JSON files matching the live pipeline's expected
schemas exactly. Each file uses ONLY data ≤ D unless the file represents
end-of-day state (close prices).

```
prices.json  →  schema: {"tickers": {"AAPL": {"price": 290.45, "change": 0.8}, ...}}
                content: D's official close from yfinance for each universe ticker
                window: D itself (executor reads this for fill price)

expected-moves.json  →  schema: {"tickers": {"AAPL": {"weekly": {...}, "daily": {...}}}}
                       content: ATR(20) computed from D-19 to D close, ×√5 for weekly
                       window: through D close

regime.json  →  content: regime classifier output replayed with VIX(D), F&G(D), breadth(D)
                window: through D-1 (don't see D's close before scout runs)

breadth.json  →  content: aggregate % above SMA50/200 across S&P sectors
                window: through D-1

fear-greed.json  →  content: CNN F&G archive lookup for D-1
                   window: D-1

vix.json  →  content: yfinance ^VIX close for D-1
            window: D-1

signals.json  →  content: replayed signal scanner state for D-1
                window: D-1
                signals are: TRIGGERED / APPROACHING / ACTIVE / EXIT / WATCHING
                derived from price position vs ATR-band geometry

sector-rotation.json  →  content: 21-day sector ETF performance ranking through D-1
                        window: D-1

watchlist.json  →  content: static current watchlist (snapshot at backtest start)
                  window: timeless (Phase 5 limitation — survivorship bias)
```

### EM proxy formula

```python
def compute_em_proxy(close: float, atr20: float, ticker_group: str) -> dict:
    """
    weekly_1σ ≈ ATR × √5 (5 trading days/week)
    monthly_1σ ≈ ATR × √21
    quarterly_1σ ≈ ATR × √63

    NOT options-chain accurate. Documented limitation. Real EM uses
    at-the-money implied vol from weekly options chains.
    """
    weekly_sigma = atr20 * math.sqrt(5)
    daily_sigma = atr20  # 1σ daily ≈ 1×ATR

    return {
        "anchor_close": close,
        "anchor_date": "...",
        "atr20": atr20,
        "weekly": {
            "lower": close - weekly_sigma,
            "upper": close + weekly_sigma,
            "sigma": weekly_sigma,
            "dte": 5,  # synthetic — proxy
            "iv_proxy": "atr_x_sqrt_5",
        },
        "daily": {
            "lower": close - daily_sigma,
            "upper": close + daily_sigma,
        },
        "updated": "...",
    }
```

### Calendar / trading day handling

Use `pandas.tseries.offsets.BDay` for weekday cadence, but exclude NYSE
holidays via the `pandas_market_calendars` library:

```python
import pandas_market_calendars as mcal
nyse = mcal.get_calendar('NYSE')
schedule = nyse.schedule(start_date=start, end_date=end)
trading_days = schedule.index.tolist()  # python date objects
```

Half-days (early close) are real trading days; the executor still fills
at close (whatever that close was, 1pm or 4pm). Holidays are skipped
entirely — no pipeline run.

### State carry-forward

After day D's pipeline completes, copy `holdings.json` + `risk-state.json`
to `state/D+1/` BEFORE D+1's pipeline runs. The pipeline reads these at
the start of D+1 to restore the state from end-of-D.

```
state/2021-06-01/holdings.json    ← end of 6/1 (ready for 6/2)
state/2021-06-02/holdings.json    ← end of 6/2 (ready for 6/3)
...
```

This is what makes the backtest match live behavior exactly — every day
sees the same state restoration logic.

### Determinism enforcement

Two hooks ensure reproducibility:

1. **`PYTHONHASHSEED=0`** set in `backtest.py`'s shell call to subprocesses
   (we don't use subprocess in backtest; pipeline is in-process).
2. **Same OHLC cache file** — yfinance is non-deterministic across calls
   (network jitter, vendor revisions). We freeze a `cache.parquet` once at
   backtest start and reuse it for every day. The cache itself is
   reproducible-by-checksum.

Determinism test:
```
python backtest.py --start 2024-01-01 --end 2024-01-31 --run-id A
python backtest.py --start 2024-01-01 --end 2024-01-31 --run-id B
diff backtest/run-A/{report,track-record,fills,closes}.json \
     backtest/run-B/{report,track-record,fills,closes}.json
# expected: empty diff
```

### Reporting metrics

| Metric | Formula |
|---|---|
| total_return_pct | (final_equity - 100_000) / 100_000 |
| cagr | (final_equity / 100_000) ^ (1/years) - 1 |
| volatility_annual | std(daily_returns) × √252 |
| sharpe | (mean(daily_returns) - rf/252) / std(daily_returns) × √252 |
| sortino | replace std with downside-only std |
| calmar | cagr / max_drawdown_pct |
| max_drawdown_pct | max((peak_so_far - equity) / peak_so_far) |
| max_drawdown_days | longest consecutive drawdown window |
| win_rate | wins / total_closes |
| expectancy | win_rate × avg_win + (1-win_rate) × avg_loss |
| profit_factor | sum(wins) / abs(sum(losses)) |
| avg_holding_days | mean(days_held over closes) |
| spy_total_return | benchmark |
| spy_sharpe | benchmark |
| sixty_forty_total_return | benchmark |
| sixty_forty_sharpe | benchmark |
| alpha_vs_spy | total_return - spy_total_return |

risk-free rate `rf` defaults to 4.5% annualized (current 3-month T-bill).

### Per-rule attribution

For each closed trade, P&L is split equally across cited rules (existing
Phase 3 logic). Run the attribution rollup over the entire backtest's
`closes.jsonl`, aggregate by `rule_id`, sort by total_pnl desc.

Output schema (extends `track-record.by_rule`):
```json
{
  "rule_id": "R006",
  "trades": 47,
  "wins": 28,
  "losses": 19,
  "win_rate": 0.596,
  "total_pnl": 12450.30,
  "avg_pnl": 264.90,
  "best_trade": 1820.55,
  "worst_trade": -485.20,
  "first_fired": "2021-08-12",
  "last_fired": "2026-05-30",
  "by_year": {"2021": ..., "2022": ..., ...},
  "rule_text_preview": "Daily close below 20 MA = exit long positions",
  "priority": "critical"
}
```

This is the single most actionable output of the backtest — it tells us
WHICH of the 296 rules to keep, weight up, weight down, or drop.

### Benchmark comparison

```python
def spy_buy_and_hold(start: date, end: date, equity: float) -> EquityCurve:
    bars = yfinance.download("SPY", start=start, end=end, auto_adjust=True)
    shares = equity / bars.iloc[0]["Close"]
    bars["equity"] = bars["Close"] * shares
    return EquityCurve(...)

def sixty_forty(start: date, end: date, equity: float, rebal="quarterly") -> EquityCurve:
    spy = yfinance.download("SPY", start=start, end=end, auto_adjust=True)
    ief = yfinance.download("IEF", start=start, end=end, auto_adjust=True)  # 7-10y treasuries
    # Quarterly rebalance to 60% SPY / 40% IEF
    ...
```

Both equity curves embedded in `report.json` for the dashboard to plot
alongside our system's curve.

## Look-ahead bias prevention checklist

Mandatory checks in `fixture_builder.py`:

- [ ] All file content uses bars dated ≤ D-1 EXCEPT `prices.json`
  (which represents D's close, used by executor to fill)
- [ ] ATR(20) computed from D-20 through D-1, NOT D
- [ ] Regime/F&G/VIX/breadth/sector-rotation use D-1 close
- [ ] Manager's intraday fill check uses D's HIGH and LOW from yfinance,
  but stop/target prices were SET on D-1 (when scout/analyst/risk ran)
- [ ] Empirical priors layer is FROZEN at backtest start (acknowledged
  look-ahead — Phase 6 fixes via walk-forward priors regeneration)
- [ ] Universe is FROZEN at backtest start (acknowledged survivorship
  bias — Phase 6 fixes via point-in-time universe)

These get a separate test file (`tests/ai-trader/test_backtest_no_lookahead.py`):

```python
def test_fixture_for_day_does_not_leak_future():
    """Build fixture for 2024-06-15. Assert no file contains data > 2024-06-15."""

def test_atr_window_is_d_minus_20_through_d_minus_1():
    """Verify ATR computation skips day D itself."""

def test_pipeline_output_byte_identical_across_two_runs():
    """Determinism check."""
```

## Performance budget

- 1,250 trading days × 0.5s/day pipeline = **~10 minutes per run**
- yfinance warmup: 88 tickers × 6 years = ~5 min one-time cache build
- Disk: ~50MB per run (8 fixture files × 1KB × 1250 days = 10MB; state
  snapshots × 1250 = 30MB; ledger files = ~5MB)

If we exceed 15 min/run, profile and optimize. Likely targets: avoid
re-reading the same yfinance cache on every fixture build (cache the
DataFrames in memory across days).

## Failure modes + handling

| Failure | Response |
|---|---|
| yfinance returns NaN for a ticker on date D | Skip that ticker for D; log warning |
| Holiday day passed to pipeline | Skip cleanly (no pipeline run for that date) |
| Empty universe (e.g., all tickers NaN) | Abort run with error; report which dates affected |
| Stop-out fills below prior day's close (gap-down) | Use D's actual low if it exceeds stop in absolute terms |
| Pipeline crashes on day D | Capture full traceback; abort run with `report.json` showing partial state |
| Stale cache | `--no-cache` flag forces yfinance refetch |
| User Ctrl-Cs mid-run | Save partial state; resume on next invocation if `--resume run-NNN` |

## Open Questions (carried from proposal.md)

1. **5-year window** — confirmed
2. **Manual trigger only** at v1 — confirmed
3. **Artifacts under `backtest/run-NNN/`** — confirmed
4. **Survivorship bias** — Phase 6 fix; Phase 5 documents
5. **Compare runs** — Phase 6
6. **Pass criteria** — Sharpe > 0.4, max DD < 25%, ≥50 of 296 rules
   net-positive

## Acceptance test (the deliverable)

```bash
$ python scripts/ai-trader/backtest.py --start 2021-06-01 --end 2026-06-13 \
    --run-id main-2026-06-13 --benchmark spy,60-40

[backtest] Loading 88-ticker OHLC cache (2021-04-01 → 2026-06-13)...
[backtest] Cache built in 4m 32s.
[backtest] Replaying 1248 trading days...
[backtest] day 100/1248 (2021-10-26) — equity $103,450 — 2 open positions
...
[backtest] day 1248/1248 (2026-06-13) — equity $147,820 — 4 open positions
[backtest] Computing benchmarks...
[backtest] Building report...

=== BACKTEST RESULT ===
Period: 2021-06-01 → 2026-06-13 (5.04 years, 1248 trading days)
Total Return: +47.82% (vs SPY +52.40%, vs 60/40 +28.10%)
CAGR: +8.10%
Sharpe: 0.62
Sortino: 0.94
Max Drawdown: -16.40% (recovered in 84 days)
Win Rate: 54.3%
Trades: 487 closed, 4 open
Top 5 rules by P&L: R006, R042, R091, R213, R165
Bottom 5 rules: R270, R244, R301, R155, R272

Report: backtest/run-main-2026-06-13/report.json
Track record: backtest/run-main-2026-06-13/track-record.json
Dashboard: https://...azurestaticapps.net/#backtest

Done in 9m 14s.
```

When this works, Phase 5 is shipped.
