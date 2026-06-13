# Setup Engine Spec

## ADDED Requirements

### Requirement: Universe is bounded to watchlist plus 12 macro proxies
The scout agent MUST scan a deterministic universe of exactly 88 tickers (76 watchlist + 12 macro proxies SPY/QQQ/IWM/DIA/TLT/HYG/GLD/DXY/VIX/XLE/XLF/XLK) at v1 and never hallucinate tickers outside that set.

#### Scenario: Universe matches expected list
- **WHEN** the scout runs against `data/watchlist.json` (76 tickers) plus the canonical 12-symbol macro list
- **THEN** the candidates output contains entries only from those 88 symbols, never from any other ticker

#### Scenario: New watchlist entry is auto-included
- **WHEN** a ticker is added to `data/watchlist.json`
- **THEN** the next scout run includes it as a candidate without code changes

### Requirement: Candidate score combines EM position, signal state, regime alignment
The scout MUST compute each candidate's rank as a deterministic weighted sum of: EM-band position-in-range (0-100), signal state (TRIGGERED=4, APPROACHING=3, ACTIVE=2, WATCHING=1, EXIT=0), regime alignment (+1 if direction-consistent), and recency penalty (cooldown still active = -100).

#### Scenario: BUY-zone setup ranks higher than mid-range
- **WHEN** AAPL is at 15% of its EM range and TRIGGERED, vs MSFT at 50% range and APPROACHING
- **THEN** AAPL's score > MSFT's score (low EM position + higher signal state both contribute)

#### Scenario: Regime-misaligned candidate is downranked
- **WHEN** the regime is BEAR/late-cycle and a long candidate is otherwise high-scoring
- **THEN** the candidate score is multiplied by 0.3 (regime-misalignment penalty), pushing it below regime-aligned candidates

### Requirement: Top 20 candidates are written to candidates.json
The scout MUST write the top 20 ranked candidates to `data/ai-trader/candidates.json` and the analyst MUST process only those 20 (not the full universe) per pipeline run.

#### Scenario: Candidates output is bounded
- **WHEN** the scout completes
- **THEN** `data/ai-trader/candidates.json.candidates.length <= 20` and entries are sorted by score descending

#### Scenario: Score floor filters weak candidates
- **WHEN** fewer than 20 candidates have score >= 1.0
- **THEN** only those above the floor are written (output may be empty if no candidate clears the floor)

### Requirement: Scout reads from existing data files only
The scout MUST source all input data from existing `data/*.json` files (watchlist, expected-moves, regime, signals, sector-rotation) and MUST NOT make any external API calls or compute new technical indicators.

#### Scenario: No external HTTP calls
- **WHEN** `scripts/ai-trader/scout.py` runs in an offline environment with all `data/*.json` files present
- **THEN** the scout completes successfully with no network errors

#### Scenario: Missing input file is reported, not silenced
- **WHEN** any required input file is missing
- **THEN** the scout exits non-zero with a clear error naming the missing file (e.g. `"data/regime.json: not found"`)
