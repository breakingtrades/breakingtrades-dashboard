# Backtest Dashboard Spec

## ADDED Requirements

### Requirement: Dashboard renders the latest backtest run dossier
The dashboard MUST expose a `/#backtest` route that fetches `data/ai-trader/
backtest-summary.json` and renders the latest run's full performance dossier
in a tabbed UI.

#### Scenario: /#backtest renders without errors when summary is present
- **WHEN** a user navigates to `/#backtest` and `backtest-summary.json` exists
- **THEN** the page MUST render header tiles (CAGR, Sharpe, max DD, win rate,
  trades), the equity curve chart, and tabs for Overview / Rules / Regimes / Trades
- **AND** the disclaimer chrome MUST appear at the top

#### Scenario: /#backtest renders empty state when no summary
- **WHEN** a user navigates to `/#backtest` but `backtest-summary.json` is missing
- **THEN** the page MUST render an empty state explaining that no backtest has
  been run yet, with a snippet showing how to invoke the CLI

### Requirement: Equity curve chart includes SPY + 60/40 benchmarks
The equity curve panel MUST render the system curve, SPY buy-and-hold, and
60/40 benchmark on the same chart with distinguishable colors and a legend.

#### Scenario: Equity curve has 3 series
- **WHEN** the equity curve panel renders
- **THEN** it MUST contain 3 polyline series: system (cyan), SPY (gray), 60/40 (gold)
- **AND** the legend MUST be visible
- **AND** y-axis labels MUST use HTML overlay (not SVG text) per the Phase 3
  fix to avoid stretching distortion

### Requirement: Rule attribution table is sortable and searchable
The Rules tab MUST display all rules that fired in the backtest, sortable by
total_pnl, win_rate, trades, and avg_pnl. Each row MUST be clickable to open
a detail modal showing the rule text and per-year breakdown.

#### Scenario: Rule row click opens detail modal
- **WHEN** a user clicks rule row R006 in the Rules table
- **THEN** a modal MUST open showing the rule text, priority, total trades,
  win rate, total P&L, and a per-year breakdown table
- **AND** Esc, X, and backdrop click MUST close the modal

### Requirement: Disclaimer chrome documents Phase 5 limitations
The backtest page MUST display a disclaimer banner clearly listing the
Phase 5 limitations: ATR proxy EM (not options-chain accurate), survivorship
bias (current watchlist), in-sample rule evaluation (rules curated through
2026), no borrow costs on shorts, pre-tax P&L.

#### Scenario: Disclaimer is visible on the page
- **WHEN** the `/#backtest` page renders
- **THEN** a styled disclaimer banner MUST appear at the top stating:
  - "Backtest uses ATR×√5 EM proxy (not real options chain)"
  - "Survivorship bias possible (current watchlist)"
  - "In-sample rule evaluation: Tom rules curated through 2026; out-of-sample evaluation deferred to Phase 9"
  - "Pre-tax P&L. No borrow costs on shorts."
  - "For educational use only. Not investment advice."

### Requirement: Pipeline integration syncs backtest summary to dashboard
The EOD update pipeline MUST copy the most recent `backtest/run-NNN/dashboard-
summary.json` to `breakingtrades-dashboard/data/ai-trader/backtest-summary.json`
when a backtest run is detected (via `backtest/index.json` mtime check).

#### Scenario: Cron sync moves backtest summary to dashboard
- **WHEN** the EOD pipeline detects a new backtest run
- **THEN** it MUST copy the latest `dashboard-summary.json` to the dashboard
  data dir
- **AND** the file MUST be committed and pushed atomically with the day's
  data updates
- **AND** the SWA build MUST automatically pick up the new file
