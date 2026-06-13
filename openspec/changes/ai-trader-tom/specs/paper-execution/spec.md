# Paper Execution Spec

## ADDED Requirements

### Requirement: Fills are simulated against prices.json with deterministic slippage
The paper executor MUST fill market orders at the official close from `data/prices.json` plus 5 bps slippage (long buys), with deterministic per-ticker overrides keyed off watchlist group (Quality 5 bps, Speculative 15 bps, Mega Cap 3 bps).

#### Scenario: NVDA approved buy at $150 close
- **WHEN** the executor processes an approved buy order for 100 NVDA at $150 close (Quality group, 5 bps)
- **THEN** the fill price is exactly `$150 × 1.0005 = $150.075` and a fill record is appended to `data/ai-trader/fills.jsonl` with that price

#### Scenario: Speculative ticker takes higher slippage
- **WHEN** the executor processes a buy on RKLB (Speculative group, 15 bps) at $100 close
- **THEN** the fill price is exactly `$100 × 1.0015 = $100.15`

### Requirement: Stop fills use gap-down logic
The paper executor MUST fill stop orders triggered by intraday lows at the stop price minus 5 bps (long stops), using `daily_low` from the next session's bar.

#### Scenario: Long stop triggered by gap-down
- **WHEN** an open NVDA position has stop at $142.50 and the next session's daily low is $140.00
- **THEN** the fill executes at `min(stop_price, daily_low) − 5 bps = $140.00 × 0.9995 = $139.93` (gap-down assumption: filled at the worse of stop or low)

#### Scenario: Stop intraday with no gap
- **WHEN** an open NVDA position has stop at $142.50 and the next session opens above and intraday low touches exactly $142.30
- **THEN** the fill executes at `$142.30 × 0.9995 = $142.23` (5 bps below the touch price)

### Requirement: Target fills are at the target price exactly
The paper executor MUST fill target orders at the target price exactly (no slippage), using limit-order semantics — fills only when daily high reaches or exceeds the target.

#### Scenario: Target hit on intraday rally
- **WHEN** an open AAPL position has target_2 at $300 and the daily high is $302
- **THEN** the fill executes at exactly $300 (target limit, no slippage)

#### Scenario: Target NOT hit
- **WHEN** the daily high reaches $299.95 (just below the $300 target)
- **THEN** no fill occurs and the position remains open

### Requirement: Fills are append-only and never modified
The fills ledger `data/ai-trader/fills.jsonl` MUST be append-only. Once written, a fill record is never edited or deleted.

#### Scenario: Mistaken fill correction
- **WHEN** an operator discovers a fill record was generated incorrectly
- **THEN** the correction is recorded as a new fill record with `correction: true` and a `corrects: <fill_id>` field; the original fill row is preserved verbatim

#### Scenario: Daily ledger snapshot
- **WHEN** the pipeline completes a trading-day run
- **THEN** the day's fills are also written to `data/ai-trader/ledger/YYYY-MM-DD.jsonl` as a snapshot, and that file is never modified after the day closes

### Requirement: Holdings are reconcilable from fills
The current holdings state at `data/ai-trader/holdings.json` MUST be reproducible by replaying `fills.jsonl` from start, applying each fill in chronological order to the starting $100K cash.

#### Scenario: Reconciliation passes
- **WHEN** the reconciliation script `scripts/ai-trader/reconcile.py` runs
- **THEN** the recomputed equity from fills replay differs from `track-record.json.current_equity` by at most $1.00 (rounding tolerance)

#### Scenario: Reconciliation fails due to drift
- **WHEN** reconciliation drift exceeds $1.00
- **THEN** the script exits non-zero, the AI-Trader page banner shows "Reconciliation error — investigating", and entries are paused until resolved
