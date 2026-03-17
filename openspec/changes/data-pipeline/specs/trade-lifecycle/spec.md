## ADDED Requirements

### Requirement: Implement 9-state trade status classification
The system SHALL classify each ticker into exactly one of 9 states as defined in `docs/TRADE_LIFECYCLE.md`: WATCHING, APPROACHING, RETEST, TRIGGERED, ACTIVE, TRAILING, TARGET_HIT, EXIT_SIGNAL (with subtypes: EXIT_SMA20, EXIT_SMA50, EXIT_W20, EXIT_STOP), STOPPED, DORMANT.

#### Scenario: WATCHING state
- **WHEN** a ticker is on the watchlist but not within 5% of any key MA level and has no active position signals
- **THEN** status is `WATCHING`

#### Scenario: APPROACHING state
- **WHEN** price is within 5% of SMA20 or SMA50 from below (moving toward the level)
- **THEN** status is `APPROACHING` with `approaching_level` and `distance_pct` fields

### Requirement: Detect retest setups with confidence scoring
The system SHALL detect RETEST status when: (1) price was above a key level (SMA20/SMA50/Weekly SMA20) 3-10 sessions ago by more than 2%, (2) price is now within -1.5% to +2.0% of that level, (3) the approach is from above (pullback, not breakout).

#### Scenario: High confidence retest
- **WHEN** price broke above SMA50 5 sessions ago by 3%, pulled back to within 0.5% of SMA50, and pullback volume < 80% of breakout volume
- **THEN** status is `RETEST` with `confidence: HIGH`, `retest_level: SMA50`, `volume_health: HEALTHY`

#### Scenario: Medium confidence retest
- **WHEN** price broke above SMA20 8 sessions ago by 2.5%, pulled back to within 1.5% of SMA20, but pullback volume >= 80% of breakout volume
- **THEN** status is `RETEST` with `confidence: MEDIUM`, `volume_health: ELEVATED`

#### Scenario: Not a retest (breakout from below)
- **WHEN** price is approaching SMA50 from below (was below 3-10 sessions ago)
- **THEN** status is NOT `RETEST` (may be `APPROACHING`)

### Requirement: Detect confluence zones
The system SHALL identify confluence zones where multiple MA levels (SMA20 + SMA50 + Weekly SMA20) converge within 3% of each other at a similar price zone.

#### Scenario: Triple confluence
- **WHEN** SMA20 is $184.80, SMA50 is $185.33, and Weekly SMA20 is $184.00 (all within 0.7% of each other)
- **THEN** the ticker is flagged with `confluence: true`, `confluence_levels: ["SMA20", "SMA50", "W20"]`, `confluence_range: [184.00, 185.33]`

#### Scenario: No confluence
- **WHEN** SMA20 is $200, SMA50 is $190, Weekly SMA20 is $185 (>3% spread)
- **THEN** `confluence: false`

### Requirement: Detect exit signals based on daily close
The system SHALL flag EXIT_SIGNAL status when the daily close falls below a key moving average. Exit subtypes: EXIT_SMA20 (daily close < SMA20), EXIT_SMA50 (daily close < SMA50), EXIT_W20 (weekly close < Weekly SMA20).

#### Scenario: Exit SMA20 signal
- **WHEN** yesterday's daily close was above SMA20 and today's daily close is below SMA20
- **THEN** status is `EXIT_SMA20` with `exit_level` set to the SMA20 value

#### Scenario: Multiple exit signals
- **WHEN** daily close is below both SMA20 and SMA50
- **THEN** status uses the most severe exit (`EXIT_SMA50` takes priority over `EXIT_SMA20`)

### Requirement: Assign sort priority by status
The system SHALL assign a numeric sort priority to each status for dashboard ordering: RETEST (HIGH) = 1, RETEST (MEDIUM) = 2, APPROACHING (<2%) = 3, EXIT_SIGNAL = 4, ACTIVE/TRAILING = 5, TRIGGERED = 6, APPROACHING (2-5%) = 7, TARGET_HIT = 8, WATCHING = 9, STOPPED = 10, DORMANT = 11.

#### Scenario: Priority sorting
- **WHEN** setups are sorted by priority ascending
- **THEN** high-confidence retests appear first, followed by approaching setups, then exit warnings, then active positions
