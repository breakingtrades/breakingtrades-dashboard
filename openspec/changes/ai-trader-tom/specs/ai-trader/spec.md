# AI-Trader — Pipeline Spec

## ADDED Requirements

### Requirement: End-to-end nightly pipeline produces auditable paper trades
The AI-Trader pipeline MUST run as Step 8 of `scripts/eod-update.sh` Mon-Fri after market close and produce a deterministic, reproducible set of paper-trade decisions with full provenance written to `data/ai-trader/`.

#### Scenario: Pipeline runs after EOD data refresh
- **WHEN** `scripts/eod-update.sh` completes Steps 0-7 successfully
- **THEN** Step 8 invokes `scripts/ai-trader/run.sh` which runs scout → analyst → risk → executor → manager → track-record-rollup in sequence

#### Scenario: Pipeline failure does not abort EOD
- **WHEN** any AI-Trader stage exits non-zero
- **THEN** Step 8 logs the failure to `/tmp/bt-eod-update.log` with `warn`, sets `data/ai-trader/last-run.json` to `{"status": "failed", "stage": "<name>"}`, and EOD continues to the commit step with regular data still committed

### Requirement: Every entry decision carries full provenance
Every paper trade entered by the executor MUST be traceable through `data/ai-trader/decisions.jsonl` to the analyst recommendation that produced it, and through that recommendation to the specific Tom rule citations and empirical prior that justified it.

#### Scenario: Trace from open position back to rules
- **WHEN** an operator queries `data/ai-trader/holdings.json` for an open NVDA position
- **THEN** the position record contains a `decision_id` field that joins to `data/ai-trader/decisions.jsonl` and yields the full chain: candidate → recommendation → approval → fill, with rule citations (e.g. `["R001", "R013", "R244"]`) embedded in the recommendation

#### Scenario: Public audit endpoint
- **WHEN** the AI-Trader page renders an open position
- **THEN** clicking the position opens a detail modal showing: Tom's rule citations with rule text, the empirical prior study used (if any), the regime context at entry time, and the timestamp of every pipeline stage

### Requirement: Single shared paper portfolio with no per-user state
The AI-Trader system MUST maintain exactly one global portfolio state at `data/ai-trader/holdings.json` with no user accounts, no login, and no broker connection.

#### Scenario: No live broker connection in v1
- **WHEN** any code path in `scripts/ai-trader/` is grep'd for `ib_insync`, `ibapi`, `alpaca`, `tradier`, `tdameritrade`, or any other broker library import
- **THEN** zero matches are found

#### Scenario: Public site has no auth gate for AI-Trader page
- **WHEN** an unauthenticated visitor navigates to `https://brave-glacier-…/#ai-trader`
- **THEN** the page renders with the full track record, open positions, and disclaimer chrome, with no login prompt

### Requirement: Disclaimer chrome is unambiguous on every AI-Trader screen
Every dashboard screen that renders AI-Trader data MUST display a permanent disclaimer banner stating "Paper trades · educational use only · not investment advice · not real money".

#### Scenario: Disclaimer visible on AI-Trader page
- **WHEN** the AI-Trader page renders
- **THEN** the disclaimer banner appears at the top of the main content area, persistent across scroll, with text matching exactly: "Paper trades · educational use only · not investment advice · not real money"

#### Scenario: Disclaimer visible on Holdings alias
- **WHEN** the Holdings page renders (which aliases to the AI-Trader renderer)
- **THEN** the same disclaimer banner is present

### Requirement: Drawdown circuit-breaker pauses entries
The risk engine MUST pause new entries for 7 trading days when account equity drops below 85% of its all-time peak, displaying a banner on the public page during the pause.

#### Scenario: Drawdown breach pauses entries
- **WHEN** the equity curve drops to $84,500 from a peak of $100,000 at end-of-day
- **THEN** the next pipeline run sets `risk-state.json.entries_paused_until` to `today + 7 trading days`, emits no approved orders for new positions, and the manager continues to manage existing positions normally

#### Scenario: Public banner during drawdown pause
- **WHEN** `risk-state.json.entries_paused_until` is in the future
- **THEN** the AI-Trader page displays a yellow-amber banner: "Pipeline recovering — new entries paused until <date>. Open positions still managed normally."

### Requirement: Pipeline output is reproducible
Re-running the pipeline against the same input data files MUST produce byte-identical output for `data/ai-trader/candidates.json`, `recommendations.json`, `approved-orders.json`, and `fills.jsonl`.

#### Scenario: Same input yields same output
- **WHEN** the pipeline is invoked twice in succession against a frozen fixture of `data/prices.json`, `data/expected-moves.json`, `data/regime.json`, `data/empirical-priors.json`, and `agents/tom-fxevolution/RULES.json`
- **THEN** the two output sets are byte-identical (verified via `diff`)
