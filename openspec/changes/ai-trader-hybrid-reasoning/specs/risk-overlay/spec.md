# Risk Overlay Spec

## ADDED Requirements

### Requirement: LLM CANNOT bypass risk gates
LLM-approved tickers MUST flow through the full 11-gate risk cascade in
risk.py (Phase 7c serialized version) before any fill can occur. The
LLM populates `Recommendation.conviction` and `rule_citations`, but all
sizing math (quarter-Kelly, heat cap, sector cap, drawdown breaker,
cash gate) MUST remain mechanical and unbypassable.

#### Scenario: LLM tries to size oversized position via high conviction
- **WHEN** LLM returns conviction=1.0 on a candidate
- **AND** the risk engine computes Kelly fraction = 0.10 (above 5% cap)
- **THEN** sizing MUST be capped at 5%, not 10%

### Requirement: LLM-driven risk reduction MUST be honored
The analyst layer MUST emit zero ENTER recommendations when the LLM
sets `entries_paused=true` or `risk_appetite < 0.2`. No mechanical
override of the LLM's defensive posture is allowed.

#### Scenario: LLM pauses entries due to risk regime
- **WHEN** LLM returns entries_paused=true with reason "vix_spike"
- **THEN** the analyst MUST emit zero ENTER_LONG/ENTER_SHORT recs that day

### Requirement: Drawdown breaker MUST override LLM
The risk engine MUST reject all LLM-approved tickers when
`state.drawdown_pct >= 0.15`, regardless of LLM conviction or
risk_appetite. Drawdown safety overrides reasoning.

#### Scenario: 15% drawdown engaged
- **WHEN** equity is below 85% of peak
- **AND** LLM approves 5 tickers
- **THEN** all 5 MUST be rejected with reason "drawdown-circuit-breaker"
