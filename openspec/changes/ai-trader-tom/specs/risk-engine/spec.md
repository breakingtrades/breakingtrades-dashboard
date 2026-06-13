# Risk Engine Spec

## ADDED Requirements

### Requirement: Position size is computed via quarter-Kelly with hard cap
The risk engine MUST compute position size using quarter-Kelly fraction of full Kelly bet size, hard-capped at 5% of account equity per trade, with stop distance derived from 1.5× ATR(20).

#### Scenario: Quarter-Kelly with high conviction
- **WHEN** an analyst recommendation has `p_win=0.6`, reward-risk `b=1.5`, and the resulting full Kelly fraction = 0.4
- **THEN** the risk engine sizes the trade at `min(0.4 × 0.25, 0.05) = 0.05` (5% account risk hard cap)

#### Scenario: Low-conviction setup is sized smaller
- **WHEN** an analyst recommendation has `p_win=0.52`, `b=1.2` yielding Kelly = 0.12
- **THEN** the risk engine sizes the trade at `0.12 × 0.25 = 0.03` (3% account risk)

#### Scenario: Negative Kelly is rejected
- **WHEN** Kelly fraction computes to a negative value (i.e. expected value is negative)
- **THEN** the risk engine rejects the entry with reason `"negative-kelly"` and the trade does not appear in approved-orders.json

### Requirement: Portfolio heat is capped at 12% of account equity
The risk engine MUST track total open-position risk (sum across positions of `(entry_price − stop_price) × shares`) and reject any new entry that would push portfolio heat above 12% of account equity.

#### Scenario: New entry that exceeds heat cap is rejected
- **WHEN** open positions already aggregate to 11.5% portfolio heat AND a new recommendation would add 1.5% heat
- **THEN** the risk engine rejects the entry with reason `"portfolio-heat-cap"` and emits no approved order

#### Scenario: Entry sized down to fit cap
- **WHEN** open heat is 10% and a new recommendation's quarter-Kelly size would add 3% heat (exceeding the 12% cap)
- **THEN** the risk engine sizes the entry to add exactly 2% heat (fitting under the cap), and only emits the entry if 2% risk corresponds to position-size risk ≥ 0.5% (otherwise rejects with reason `"size-too-small"`)

### Requirement: Sector concentration is capped at 35% of equity
The risk engine MUST track per-sector exposure via `data/sector-rotation.json` sector membership and reject new entries that would push any single sector above 35% of account equity.

#### Scenario: New tech entry that breaches sector cap is rejected
- **WHEN** open positions in technology sector aggregate to 33% of equity AND a new NVDA entry would add 4% to that sector
- **THEN** the risk engine rejects the entry with reason `"sector-cap"`

### Requirement: Stops are sized to current ATR not fixed-percent
The risk engine MUST set stop distance for every entry to `1.5 × ATR(20)` from the entry price, using the latest ATR value from `data/expected-moves.json` (which carries ATR per ticker).

#### Scenario: Stop distance reflects volatility
- **WHEN** NVDA enters at $150 with ATR(20) = $5
- **THEN** the stop is placed at `$150 − (1.5 × $5) = $142.50` (long) or `$150 + (1.5 × $5) = $157.50` (short)

#### Scenario: ATR is missing for the ticker
- **WHEN** an analyst recommendation references a ticker with no ATR data in `data/expected-moves.json`
- **THEN** the risk engine rejects the entry with reason `"missing-atr"` (no fallback to fixed percent)

### Requirement: Cooldown blocks re-entry after stop-out
The risk engine MUST block new entries on a ticker for 5 trading days after that ticker triggered a stop-out close.

#### Scenario: Stop-out triggers cooldown
- **WHEN** NVDA hits its stop on 2026-06-15 and the manager closes the position
- **THEN** new entries on NVDA are rejected with reason `"cooldown"` for the next 5 trading days (until 2026-06-22 inclusive of weekends)

#### Scenario: Target hit does NOT trigger cooldown
- **WHEN** AAPL hits target_2 and the position closes for a profit
- **THEN** the next pipeline run can re-enter AAPL if a fresh signal warrants it (no cooldown applied to wins)

### Requirement: Risk engine is the sole gatekeeper
Every code path that produces a `data/ai-trader/approved-orders.json` row MUST first call `risk.check_entry_eligible(rec)` and only proceed if it returns `{"approved": true}`. No bypass paths exist.

#### Scenario: Static analysis confirms no bypass
- **WHEN** `grep -rn "approved-orders.json" scripts/ai-trader/` is run
- **THEN** the only writer is `scripts/ai-trader/risk.py` itself; no other script writes that file directly
