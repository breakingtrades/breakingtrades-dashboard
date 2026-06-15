# Backtest Engine Spec

## ADDED Requirements

### Requirement: Backtest replays the live pipeline byte-for-byte
The backtest engine MUST run the exact same Python modules as the live
pipeline (scout.py, analyst.py, risk.py, executor.py, manager.py, track_record.py)
without modification. Path resolution swaps via `Paths.set_data_root()` and
`Paths.set_dashboard_data_root()` are the only allowed point of variance.
No parallel implementation of pipeline logic is permitted.

#### Scenario: Backtest pipeline modules are unmodified
- **WHEN** running `python scripts/ai-trader/backtest.py --start 2024-01-01 --end 2024-01-31`
- **THEN** scout.py, analyst.py, risk.py, executor.py, manager.py, track_record.py source
  files MUST be byte-identical to their state at the time of last live deployment
- **AND** verifying via `git diff` MUST show zero changes to those files

#### Scenario: Backtest invokes pipeline in-process via Paths singleton
- **WHEN** the backtest orchestrator runs day D
- **THEN** it MUST call `Paths.set_dashboard_data_root(fixture_dir)` and
  `Paths.set_data_root(state_dir)` BEFORE importing or calling pipeline modules
- **AND** pipeline modules MUST read from the configured paths without any
  CLI flag or env var hint that backtest is running

### Requirement: Backtest is deterministic and reproducible
The backtest engine MUST produce byte-identical output across multiple invocations
with the same inputs. Sources of non-determinism (network jitter, vendor data
revisions, hash randomization) MUST be controlled.

#### Scenario: Two runs of identical backtest produce identical output
- **WHEN** running the same backtest command twice with the same `--start`, `--end`,
  and a frozen OHLC cache
- **THEN** the resulting `report.json`, `track-record.json`, `fills.jsonl`, and
  `closes.jsonl` MUST be byte-identical
- **AND** a CI test MUST verify this on at least a 30-day window

#### Scenario: OHLC cache is frozen at backtest start
- **WHEN** the backtest starts
- **THEN** it MUST persist the yfinance OHLC cache to a parquet file in the run
  directory
- **AND** subsequent days MUST read from the cache, not re-fetch from yfinance
- **AND** a `--no-cache` flag MUST force a refetch and overwrite the cache

### Requirement: Backtest virtualizes wall-clock time
The backtest engine MUST replace wall-clock time references in the pipeline
with a simulated `as_of_date` for each replayed day. The pipeline modules
contain `datetime.now()` calls (in manager._days_held, risk.cooldown checks,
risk.drawdown breaker, executor.fill_date stamping, manager._add_cooldown,
track_record snapshot timestamps) that would silently produce wrong results
if left unmodified.

#### Scenario: Manager days_held uses simulated, not wall-clock, today
- **WHEN** backtest replays day 2024-06-15 with a position entered 2024-06-10
- **THEN** `_days_held()` MUST return 5 (calendar days between simulated dates)
- **AND** MUST NOT return `(2026-06-13 - 2024-06-10).days = 729` (wall-clock)
- **AND** test `test_manager_days_held_uses_virtual_now` MUST verify this

#### Scenario: Cooldown resume date uses simulated time
- **WHEN** a STOP_OUT fires on simulated day 2024-06-15
- **THEN** `risk-state.json.cooldown_tickers[T]` MUST equal 2024-06-20 (simulated +5d)
- **AND** MUST NOT equal `wall_clock_now + 5d`

#### Scenario: Live behavior preserved when as_of is None
- **WHEN** any pipeline stage runs with `as_of=None` (default, live behavior)
- **THEN** the stage MUST use wall-clock `datetime.now(timezone.utc)`
- **AND** existing live-mode unit tests MUST continue to pass unchanged

### Requirement: Pipeline modules have no top-level path or time bindings
Pipeline modules (scout, analyst, risk, executor, manager, track_record)
MUST NOT cache `Paths.*` results, file paths, or time values at module-import
time. All path and time resolution MUST happen inside function bodies so the
backtest's in-process `Paths.set_data_root()` and `set_as_of()` swaps take
effect on the next call.

#### Scenario: No top-level Paths binding in any pipeline module
- **WHEN** running `grep -n "^[A-Z_]* = Paths\." scripts/ai-trader/{scout,analyst,risk,executor,manager,track_record}.py`
- **THEN** the output MUST be empty
- **AND** test `test_no_top_level_path_bindings` MUST verify this via AST inspection
- **AND** any new top-level bindings in PRs MUST be flagged in code review

### Requirement: Backtest carries state forward day-by-day
The backtest engine MUST snapshot `holdings.json` and `risk-state.json` after
each day's pipeline run and copy them to the next day's state directory before
the next pipeline run begins. This mirrors live behavior where state files persist
between cron invocations.

#### Scenario: Day 2's pipeline sees end-of-day-1 state
- **WHEN** day 1's pipeline completes with 1 open position
- **THEN** day 2's pipeline MUST start with `holdings.json` containing that
  same open position (modulo any manager-driven exit)
- **AND** `risk-state.json` MUST carry forward portfolio_heat, sector_exposure,
  drawdown_pct, equity_peak, and cooldown_tickers

### Requirement: Backtest handles trading calendar correctly
The backtest engine MUST use NYSE-aware trading days, skipping weekends, exchange
holidays, and the day after Thanksgiving / Christmas Eve when applicable.
Half-days (early close) MUST be processed as full pipeline days; the executor
fills at whatever close yfinance reports.

#### Scenario: Backtest skips holidays
- **WHEN** the backtest window includes 2025-12-25
- **THEN** no pipeline run MUST occur for that date
- **AND** the day's fixture MUST NOT be built
- **AND** the equity curve MUST NOT have an entry for 2025-12-25

#### Scenario: Backtest processes early-close days
- **WHEN** the backtest window includes 2024-12-24 (Christmas Eve, 1pm close)
- **THEN** the pipeline MUST run normally for that date
- **AND** the executor MUST fill at the 1pm close price
- **AND** the next day (2024-12-25 holiday) MUST be skipped

### Requirement: Backtest fails fast on critical errors
The backtest engine MUST abort the run with a clear error message when the
pipeline cannot continue. Per-day non-critical failures (single ticker missing
data) MUST be logged and skipped without aborting the whole run.

#### Scenario: Universe-wide data unavailability aborts run
- **WHEN** yfinance returns NaN for ALL universe tickers on date D
- **THEN** the backtest MUST abort with exit code 2 and a message naming
  the affected dates
- **AND** the partial state up to D-1 MUST be preserved in the run directory
- **AND** no `report.json` MUST be emitted (run is incomplete)

#### Scenario: Single ticker missing data does not abort
- **WHEN** yfinance returns NaN for AAPL on date D but other tickers are fine
- **THEN** AAPL MUST be excluded from D's universe
- **AND** a warning MUST be logged with ticker + date
- **AND** the pipeline MUST continue normally
