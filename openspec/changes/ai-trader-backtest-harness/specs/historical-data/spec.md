# Historical Data Spec

## ADDED Requirements

### Requirement: Fixture files are schema-identical to live pipeline files
Each per-day fixture file MUST be readable by the unmodified live pipeline
without schema errors. Backtest-generated `prices.json`, `expected-moves.json`,
`regime.json`, `breadth.json`, `fear-greed.json`, `vix.json`, `signals.json`,
`sector-rotation.json`, and `watchlist.json` MUST conform to the same schemas
the live data pipeline emits.

#### Scenario: Live pipeline reads backtest fixture without modification
- **WHEN** a backtest fixture is built for date D
- **THEN** running scout.py, analyst.py, risk.py, executor.py, manager.py
  with `Paths.dashboard_data_root` pointing at the fixture MUST succeed without
  schema errors or KeyError exceptions
- **AND** all required keys per file (e.g., `tickers.AAPL.weekly.upper` in
  `expected-moves.json`) MUST be populated

### Requirement: No look-ahead bias in fixture content
Fixture content for date D MUST use only data observable at D's market
close. The fixture MUST NOT contain D+1 or later data. ATR(20) MUST be
computed from D-19 through D close (20 bars including D). Manager's
intraday high/low checks against stops/targets MUST use D's actual OHLC
from yfinance (read by manager via the `daily.upper`/`daily.lower` band
fields, which encode D's high/low ± slippage in the live convention).

#### Scenario: Fixture for 2024-06-15 contains no data after that date
- **WHEN** building the fixture for 2024-06-15
- **THEN** `regime.json` MUST be computed from VIX/F&G/breadth values
  observable at 2024-06-15 close (not 2024-06-16)
- **AND** `breadth.json` MUST aggregate sector ETF closes through 2024-06-15
- **AND** `signals.json` MUST reflect signal scanner state at 2024-06-15 close
- **AND** `prices.json` MUST contain 2024-06-15 close prices
- **AND** `expected-moves.json` ATR(20) MUST be computed from 2024-05-17
  through 2024-06-15 inclusive (20 bars)
- **AND** a test (`test_no_lookahead.py`) MUST verify this for at least 5
  sample dates

#### Scenario: ATR(20) window is D-19 through D close
- **WHEN** computing ATR(20) for the EM proxy on date D
- **THEN** the calculation MUST use the 20 most-recent trading-day bars
  through and including D
- **AND** the True Range formula MUST be `max(H-L, abs(H-PC), abs(L-PC))`
  where PC is the prior close
- **AND** test `test_atr_window_includes_d` MUST verify D's bar IS in
  the calculation (not excluded)

### Requirement: Daily EM band uses 1.5×ATR (matches live convention)
The daily EM band in fixtures MUST be `close ± 1.5 × ATR(20)` to match
the LIVE production `expected-moves.json` convention. This is verifiable
by inspecting `manager.py:_atr20()` which extracts ATR via
`(daily.upper - daily.lower) / 2 / 1.5`. A 1.0×ATR backtest fixture would
produce stop-outs ~33% too aggressively.

#### Scenario: Daily band uses 1.5×ATR
- **WHEN** computing the daily EM band for ticker T on date D with
  ATR(20) = 5.00 and close = 100.00
- **THEN** daily.upper MUST equal 107.50 (close + 1.5×ATR)
- **AND** daily.lower MUST equal 92.50 (close - 1.5×ATR)
- **AND** test `test_em_proxy_daily_matches_live_convention` MUST verify this
- **AND** the inverse formula `(upper - lower) / 2 / 1.5` MUST recover ATR

#### Scenario: Weekly EM uses ATR(20) × √5
- **WHEN** computing the weekly EM band for ticker T on date D
- **THEN** weekly_1σ = ATR(20)_at_D × √5
- **AND** weekly.upper = close + weekly_1σ
- **AND** weekly.lower = close - weekly_1σ
- **AND** the file MUST include `iv_proxy: "atr_x_sqrt_5"` to mark it as
  proxy-derived rather than options-chain-derived

#### Scenario: Monthly + quarterly bands also generated
- **WHEN** building expected-moves.json for date D
- **THEN** monthly.upper/lower MUST equal close ± ATR×√21
- **AND** quarterly.upper/lower MUST equal close ± ATR×√63
- **AND** schema parity with live `expected-moves.json` MUST be verified
  by golden-file diff against a real production snapshot

### Requirement: yfinance OHLC is auto-adjusted for splits and dividends
The OHLC cache MUST use `auto_adjust=True` so historical prices are split- and
dividend-adjusted to current shares. This prevents synthetic stop-outs from
ex-dividend gaps.

#### Scenario: Split-adjusted price for NVDA pre-2021 split
- **WHEN** fetching NVDA bars for 2021-04-01 (pre-split)
- **THEN** the close price MUST be adjusted for the 4:1 split that occurred
  2021-07-19
- **AND** the resulting prices MUST match yfinance's auto_adjust output

### Requirement: Macro state backfilled with named sources
Historical VIX, MOVE, F&G, and breadth values used in `regime.json` MUST be
backfilled from named sources documented in the run config.

#### Scenario: Run config records all data sources
- **WHEN** a backtest run completes
- **THEN** `backtest/run-NNN/config.json` MUST list each data source by name
  (e.g., "vix": "yfinance ^VIX", "fear_greed": "cnn-historical-mirror")
- **AND** the version/commit of any custom-fetched data MUST be recorded

#### Scenario: Missing F&G value falls back to neutral
- **WHEN** the F&G archive has no entry for date D
- **THEN** `fear-greed.json` MUST set value=50 (neutral) and label="Unknown"
- **AND** a warning MUST be logged with the date
- **AND** the run config MUST track the count of fallback dates

### Requirement: Static fixtures use the current production state
Static fixtures MUST be snapshotted ONCE at backtest start from production
and reused across all days. Files that don't change per-date (`watchlist.json`,
`empirical-priors.json`) are in this category. This is acknowledged as a
Phase 5 limitation; Phase 6 fixes survivorship bias and walk-forward priors.

#### Scenario: Watchlist snapshot is timeless
- **WHEN** a backtest runs over 2021-06-01 to 2026-06-13
- **THEN** `watchlist.json` for every day MUST contain the universe AS OF the
  backtest start (current 76+12 tickers)
- **AND** the run config MUST record the watchlist snapshot date and a warning
  about survivorship bias

#### Scenario: Empirical priors snapshot is timeless
- **WHEN** a backtest runs over 2021-06-01 to 2026-06-13
- **THEN** `empirical-priors.json` for every day MUST contain the studies AS OF
  the backtest start
- **AND** the run config MUST record this as a Phase 5 limitation requiring
  Phase 6 walk-forward regeneration
