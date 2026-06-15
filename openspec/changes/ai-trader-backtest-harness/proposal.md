# AI-Trader Backtest Harness

## Why

AI-Trader Tom v1 is paper-trading live but has zero historical record. We
have no data on:

- Whether the 12% portfolio heat cap, 5% Kelly cap, 35% sector cap, and
  1.5×ATR stops produce sane positioning across regimes
- Which of Tom's 296 rules actually pay off vs which are noise
- How the system behaves in a real bear market (we shipped during a bull)
- Whether conviction floor of 0.30 is too tight (no trades) or too loose
  (every weak signal fires)
- The Sharpe profile, max drawdown, regime-conditional behavior

Paper trading from this Monday will produce 1 data point per day. After 5
years we'd have 1,250 trading days of evidence. We need that data NOW to
catch architectural bugs before they cost real (paper) money, and to know
whether to keep running this thing or scrap it.

The pipeline is fully deterministic (spec MUST: same input → byte-identical
output). That's exactly what makes backtest possible — we can replay any
historical day by reconstructing the input fixture and running the same
code path. No reimplementation. No drift between backtest and live.

## What Changes

This proposal adds a fifth capability to AI-Trader: **backtest harness**.

It replays the live pipeline (scout → analyst → risk → executor → manager →
track_record) over a historical window, day by day, against synthesized
fixtures built from yfinance OHLC + FRED macro data + computed ATR-proxy
expected-move bands. The output is a full dossier of equity curve, win
rate, drawdown, per-rule attribution, and SPY/60-40 benchmark comparisons.

**Critically: backtest uses the EXACT SAME pipeline code as live.** No
parallel implementation. The only thing that changes is where the input
files come from (synthesized fixture vs live data) and where the output
goes (`backtest/run-NNN/` vs `data/ai-trader/`). The pipeline modules
(scout.py, analyst.py, risk.py, executor.py, manager.py) are unmodified.

Capabilities introduced:

1. **`backtest-engine`** — orchestrator that walks dates, builds fixtures,
   runs the pipeline, captures output. Deterministic, reproducible.
2. **`historical-data`** — yfinance OHLC fetcher, ATR×√5 EM proxy
   computation, FRED macro backfill (VIX, MOVE, F&G, breadth from sector
   ETF closes), regime classification replay.
3. **`backtest-reporting`** — equity curve, Sharpe/Sortino/Calmar, max
   drawdown with recovery time, per-rule P&L attribution, regime-bucketed
   performance, SPY + 60/40 benchmarks, exposure stats.
4. **`backtest-dashboard`** — `/#backtest` page on the production dashboard
   showing the latest run with tabbed UI (overview / rules / regimes /
   trades) and a stub for run-comparison.

## Approach

### 1. Same code path, different fixture root

The existing `io_helpers.Paths` singleton (added Phase 1) lets us swap the
data root in-process. Backtest uses this:

```python
from io_helpers import Paths
Paths.set_data_root(backtest_run_dir / "ai-trader")
Paths.set_dashboard_data_root(backtest_run_dir / "fixture")

# Run the exact same pipeline
import scout; scout.run()
import analyst; analyst.run()
import risk; risk.run()
import executor; executor.run()
import manager; manager.run()
import track_record; track_record.run()
```

Per-day snapshot of `holdings.json` + `risk-state.json` carries forward to
the next day. `fills.jsonl` and `closes.jsonl` accumulate. Final state
written to `backtest/run-001/track-record.json`.

### 2. Approximate EM bands via ATR×√5

True weekly Expected Move is derived from at-the-money options chain
implied volatility. yfinance does NOT provide historical options chains.
ORATS / OptionsDX / CBOE charge $200-2000+/mo for that data.

For this Phase 5 harness, we use the historical-volatility proxy:

```
weekly_1σ_proxy = ATR(20) × √5
weekly_upper = close + weekly_1σ_proxy
weekly_lower = close - weekly_1σ_proxy
daily_upper  = close + ATR(20)
daily_lower  = close - ATR(20)
```

This is documented as approximate. Real EM tracks IV (forward-looking),
ATR tracks HV (backward-looking). They diverge most around earnings/Fed
events — exactly when the system is MOST active. So the backtest will
systematically *under-estimate* stress periods. We label results clearly:
"EM proxy via ATR×√5; not options-chain accurate; v2 (Path B) requires
historical options data."

### 3. Look-ahead bias prevention

Every fixture file built for date D MUST use only data through close of
day D-1 unless explicitly representing day-D close (for the executor's
fill price). This is enforced by:

- `historical-data` fetches OHLC bars up to and including D, then trims
  to D-1 for state files (regime, breadth, F&G), and uses D-close only
  for `prices.json` (which the executor reads for fill price)
- ATR(20) computed from D-19 through D close
- Manager's intraday high/low check uses D's actual high/low (real OHLC)
- The pipeline doesn't see D+1 anything

This is verified by an integration test: run backtest over a known historical
window twice with mocked time, assert byte-identical output.

### 4. Macro state backfill

Historical regime/breadth/F&G/VIX values:

| Field | Source |
|---|---|
| VIX | yfinance ^VIX daily close |
| MOVE | yfinance ^MOVE daily close (when available; backfill 0 for pre-2014) |
| Fear & Greed | CNN historical archive (CSV from public mirror) |
| Breadth | computed: % of S&P sector ETFs above SMA(50) and SMA(200) |
| Regime | replay regime classifier with backfilled VIX/F&G/breadth |

Sector rotation is computed from sector-ETF returns over rolling windows.
Empirical priors are static (already historical).

### 5. Walk-forward, not look-ahead

The pipeline NEVER sees future data. This means:
- The empirical-priors layer can use `data/empirical-priors.json` AS IT
  EXISTS TODAY because those studies were computed from historical data
  (the priors themselves don't change with time)
- BUT for academically pure walk-forward, Phase 6 should regenerate priors
  using only data ≤ D-1 at each step. Phase 5 accepts the look-ahead in
  priors as a documented limitation (priors are 2-of-296 inputs, low impact).

### 6. Slippage + fills against real OHLC

The manager already checks daily high/low against stops/targets. In
backtest mode, those values come from yfinance's actual historical OHLC
(adjusted for splits/dividends) — same logic, different source. Slippage
table (5/15/3 bps by group) is unchanged. Limit fills at TARGET are
exact (per Phase 3 review fix).

### 7. Reporting against SPY + 60/40 benchmarks

For every backtest run we also compute:

- **SPY buy-and-hold** with same starting equity over same window
- **60/40 (60% SPY + 40% IEF)** rebalanced quarterly

Backtest equity curve plotted alongside both. Sharpe, max DD, and total
return tabulated for all three. This is the only way to know if Tom's
rules actually add value vs simple alternatives.

## Non-Goals

- **Historical options-chain data.** Out of scope for Phase 5; explicit
  Phase 6 (`ai-trader-backtest-real-em`) deliverable.
- **Tick-level intraday simulation.** Backtest fills at close + slippage,
  same as live. No 1-minute replay.
- **Parameter optimization / overfitting.** No grid search, no rule weight
  tuning. Phase 5 measures the system AS-IS. Phase 7 (`ai-trader-rule-
  weighting`) handles attribution-driven rule tuning with proper
  out-of-sample / walk-forward discipline.
- **Real-time / streaming backtest.** Batch only. Run, get report.
- **Tax-aware accounting.** Pre-tax P&L. Phase 8 handles short-term/long-
  term gains tracking + wash-sale rules.
- **Borrow costs on shorts.** Phase 5 simplification — assume 0 bps borrow.
  Real borrow ranges 25-500 bps/yr depending on hard-to-borrow status.
  Phase 6 adds a borrow-rate table.
- **Survivorship bias correction.** The 88-ticker universe is the *current*
  watchlist. Tickers that delisted (e.g. SVB) aren't in our universe at
  all. Phase 6 handles point-in-time universe with proper delisted bars.

## Phasing

This change ships Phase 5 in three stages, all in one OpenSpec change for
review purposes (vs splitting across 3 changes):

- **5a (this change body)**: backtest-engine + historical-data + reporting
  capabilities. Implement, smoke-test 3 months, then scale to 5 years.
- **5b**: dashboard page (separate commit, same OpenSpec change).
- **5c**: documentation, run published reports, calibrate the conviction
  floor based on what the backtest reveals.

A future `ai-trader-backtest-real-em` change (Phase 6) replaces the ATR
proxy with real historical options data. A future `ai-trader-rule-
weighting` change (Phase 7) uses Phase 5's per-rule attribution to tune
rule weights with proper walk-forward discipline.

## Open Questions

1. **Historical window?** Recommendation: **5 years (2021-06 to 2026-06)**
   covering COVID recovery, 2022 bear, 2023 rally, 2024 sideways, current
   bull. About 1,250 trading days. ~10 min per run. Defendable.
2. **Run cadence?** Manual trigger only at v1 (CLI: `python scripts/ai-
   trader/backtest.py --start ... --end ...`). Phase 6 may add a "rerun on
   spec change" cron.
3. **Where do backtest artifacts live?** Recommendation: under
   `backtest/run-NNN/` in the parent repo with a top-level
   `backtest/index.json` registering all runs. Don't ship raw runs to
   dashboard repo — only the latest summary's JSON.
4. **Survivorship/delisted handling?** Phase 5 ignores; Phase 6 fixes.
   Document in dashboard "this run uses current watchlist; survivorship
   bias possible".
5. **Compare two backtest runs side-by-side on dashboard?** Phase 5b ships
   single-run view. Compare-mode is a Phase 6 add-on.
6. **What does "passing" look like?** A useful baseline: backtest must
   show Sharpe > 0.4 and max drawdown < 25% over the 5-year window AND
   show *positive* per-rule attribution for at least 50 of the 296 rules.
   Failure to meet ANY of those = system needs work before going live for
   real money. (Reminder: nothing in the live pipeline trades real money.)

## Acceptance criteria

When this change is "done":

- `python scripts/ai-trader/backtest.py --start 2021-06-01 --end 2026-06-13`
  runs end-to-end without errors, in under 15 minutes, on a laptop
- Outputs `backtest/run-001/{track-record.json,trades.csv,report.json}`
  + a regenerated `closes.jsonl` and `fills.jsonl`
- The same command run twice produces byte-identical output (determinism
  test in CI)
- A 3-month smoke test (2024-01-01 to 2024-03-31) completes in under 90
  seconds and emits a non-empty equity curve
- The dashboard `/#backtest` page renders the latest run's track-record,
  equity curve, rule attribution, regime breakdown, and benchmark
  comparison panels
- Spec validates clean: `openspec validate ai-trader-backtest-harness
  --strict` passes
- Subagent review (opus-4.7, fresh context) catches no critical issues
  unaddressed
