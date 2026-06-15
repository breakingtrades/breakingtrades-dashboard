# Theme Rotation Spec

## ADDED Requirements

### Requirement: Theme catalog MUST be data-driven
The list of investable themes MUST be defined in `agents/theme_catalog.py`
as a structured constant, NOT hardcoded into the LLM prompt. This allows
themes to evolve over time without prompt changes.

#### Scenario: Theme catalog includes 12+ themes
- **WHEN** `from theme_catalog import THEMES` is loaded
- **THEN** THEMES MUST include at minimum: AI Infrastructure,
  Steepening Yield Curve, Energy Capex Cycle, Defensive Rotation,
  Small-Cap Breakout, Megacap Tech Strength, Reflation Trade,
  Recession Hedge, Healthcare Innovation, Consumer Stress,
  Geopolitical Premium, Crypto Bid

### Requirement: Each theme MUST map to candidate tickers/ETFs
Every theme entry MUST include the underlying ticker mapping so the
LLM can suggest "AI Infrastructure" and the analyst can resolve it
to specific candidates.

```python
THEMES = {
    "AI Infrastructure": {
        "primary_etfs": ["SMH", "WCLD"],
        "underlying_tickers": ["NVDA", "AMD", "AVGO", "MU"],
        "rationale_template": "Active when {breadth_strong} AND {tech_outperforming}",
    },
    ...
}
```

#### Scenario: LLM names theme not in catalog
- **WHEN** LLM returns active_themes=["Quantum Computing"]
- **AND** "Quantum Computing" is not in THEMES dict
- **THEN** the agent MUST log a warning and drop the unknown theme

### Requirement: Theme rotation MUST preserve auditable lineage
Each Recommendation produced through the LLM agent MUST cite its
parent theme(s) in `rule_citations` field, prefixed with `theme:`.

#### Scenario: LLM allocates to AI Infrastructure
- **WHEN** approved_ticker has primary_theme="AI Infrastructure"
- **THEN** the resulting Recommendation MUST include
  `rule_citations=["theme:AI Infrastructure", ...]` so the dashboard
  /#backtest rule attribution table shows theme contribution
