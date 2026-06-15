# Backtest Reporting Spec

## ADDED Requirements

### Requirement: Report.json contains all standard performance metrics
Every backtest run MUST emit a `report.json` containing total return, CAGR,
volatility, Sharpe, Sortino, Calmar, max drawdown, max DD recovery time, win
rate, expectancy, and profit factor. All metrics MUST be computed from daily
returns (mark-to-market equity changes).

#### Scenario: Report metrics match standard definitions
- **WHEN** a backtest produces a final equity curve over N trading days
- **THEN** Sharpe MUST equal `(mean(daily_returns) - rf/252) / std(daily_returns) × √252`
  with rf default = 0.045 annualized
- **AND** Sortino MUST replace std with downside-only std (only negative returns)
- **AND** Calmar MUST equal `cagr / abs(max_drawdown_pct)`
- **AND** all formulas MUST match the implementations in `reporter.py` covered
  by unit tests with known-good fixture values

#### Scenario: Max drawdown is computed with recovery time
- **WHEN** the equity curve has a peak followed by a trough followed by recovery
- **THEN** `max_drawdown_pct` MUST equal `(peak - min_after_peak) / peak`
- **AND** `max_drawdown_days` MUST equal the number of trading days from peak
  to recovery (return to or above the prior peak)
- **AND** when recovery has not occurred by run end, `max_drawdown_days_open`
  MUST be set instead

### Requirement: Per-rule attribution rolled up across the full run
The report MUST contain per-rule P&L attribution computed across all closed
trades in the run. The attribution algorithm MUST match the existing
`track_record._by_rule` logic (each closed trade splits its P&L equally
across cited rules) so backtest and live use the same accounting. The
backtest report MAY include additional fields (by_year breakdown,
first_fired/last_fired dates, best/worst trade per rule) that are NOT
present in live track_record output — these are reporting-layer extensions,
not changes to the attribution algorithm itself.

#### Scenario: Per-rule rollup includes all 296 rules with at least 1 firing
- **WHEN** the backtest produces 487 closed trades over 5 years
- **THEN** `report.json.by_rule[]` MUST contain every rule_id that appears in
  any closed trade's `rule_citations[]` field
- **AND** each entry MUST have: trades, wins, losses, win_rate, total_pnl,
  avg_pnl, best_trade, worst_trade, first_fired (date), last_fired (date)
- **AND** entries MUST be sorted by total_pnl descending

#### Scenario: Per-rule by-year breakdown
- **WHEN** the backtest spans multiple calendar years
- **THEN** each `by_rule[]` entry MUST include a `by_year` map keyed by year
  string (e.g., "2024") with the same metrics scoped to that year
- **AND** years with zero firings of that rule MUST be omitted from the map

### Requirement: Regime-bucketed performance breakdown
The report MUST contain performance metrics segmented by the regime AT TIME
OF ENTRY for each closed trade. The regime at entry is read from the
existing `Position.regime_context` field already present in the live
data model — this is purely a reporting-layer aggregation, not a write-side
change to executor or fills.jsonl.

#### Scenario: Regime breakdown segments closes by entry regime
- **WHEN** a closed trade entered during a BULL regime
- **THEN** that trade's P&L MUST contribute to `report.by_regime["BULL"]`
- **AND** the breakdown MUST include trades, win_rate, total_pnl, expectancy
  per regime (BULL, BEAR, RANGE)

### Requirement: SPY and 60/40 benchmarks alongside the system curve
The report MUST include equity curves and key metrics for both SPY buy-and-hold
and 60/40 (60% SPY + 40% IEF, quarterly rebalance) over the same window with
the same starting equity. This is the only fair comparison.

#### Scenario: SPY benchmark uses dividend-reinvested adjusted close
- **WHEN** computing the SPY benchmark for the run window
- **THEN** the calculation MUST use yfinance auto_adjust=True (dividend reinvestment)
- **AND** initial shares MUST equal `100_000 / spy_close_at_start`
- **AND** the equity curve at each date D MUST equal `shares × spy_close_at_D`

#### Scenario: 60/40 benchmark rebalances quarterly
- **WHEN** computing the 60/40 benchmark
- **THEN** at each quarter boundary, holdings MUST be rebalanced back to 60% SPY
  / 40% IEF
- **AND** between rebalances, the curves MUST drift with their respective ETFs
- **AND** the rebalance dates MUST be reproducible (calendar-based, not
  performance-triggered)

### Requirement: Dashboard summary is a thin slice of the full report
A `dashboard-summary.json` MUST be emitted alongside `report.json` containing
only the fields the dashboard page renders. Its size MUST be < 200 KB to keep
page load fast.

#### Scenario: Dashboard summary excludes per-day equity curve detail
- **WHEN** the full report has 1,250 daily equity points
- **THEN** the dashboard summary MUST downsample to weekly (52 × 5 = ~260 points)
  for the chart, retaining the full per-day curve in the run directory only
- **AND** the dashboard summary MUST include: top 30 rules by total_pnl, top
  10 worst rules, regime breakdown, sector breakdown, summary metrics, and
  the downsampled curve with SPY + 60/40 overlays
