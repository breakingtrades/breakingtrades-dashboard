# Hybrid Reasoning Agent — Design

## Architecture diagram

```
┌─ Deterministic ─────────────────────────────┐
│                                             │
│  yfinance OHLC                              │
│       │                                     │
│       ▼                                     │
│  fixture_builder → 9 JSON fixtures           │
│       │                                     │
│       ▼                                     │
│  scout.py → candidates.json (top 20)         │
│       │                                     │
│       ▼                                     │
│  risk_scorer.py → per-ticker risk_score 0-100│
│       │                                     │
│       ▼                                     │
│  sector_state.py → per-sector momentum vector│
│       │                                     │
└───────┼─────────────────────────────────────┘
        │
        ▼ (one structured call per trading day)
┌─ LLM Reasoning ───────────────────────────────┐
│                                                │
│  reasoning_agent.allocate(market_state)        │
│       │                                        │
│       ▼                                        │
│  llm_client.complete(prompt, schema)          │
│       │                                        │
│       ▼                                        │
│  Pydantic validation                           │
│       │                                        │
│       ▼                                        │
│  AllocationDecision (preferred sectors,        │
│   themes, approved tickers w/ conviction)      │
│                                                │
└──────────┼─────────────────────────────────────┘
           │
           ▼
┌─ Deterministic ──────────────────────────────────┐
│                                                  │
│  analyst_v2 builds Recommendation per approved   │
│  ticker with conviction from LLM, citations =    │
│  themes/sectors, regime_context = LLM rationale  │
│       │                                          │
│       ▼                                          │
│  risk.py 11-gate cascade (UNCHANGED)             │
│       │                                          │
│       ▼                                          │
│  executor → manager → track_record (UNCHANGED)   │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Why this structure works

1. **LLM operates on aggregate state, not stock picks.** The LLM sees
   sector momentum, breadth, regime, top candidates as a structured
   input. It outputs an *allocation policy*, not specific entry/stop/
   target levels (which the deterministic layer is better at).

2. **Risk caps are mechanical and unbypassable.** Even if the LLM says
   "buy 100% TQQQ," the risk engine still enforces 5% Kelly/trade,
   12% portfolio heat, 35% sector cap. The LLM can only allocate
   *within* the cap structure.

3. **Determinism via caching.** Backtests need byte-identical replay
   for spec compliance. LLM output is cached per simulated date.
   Live first-call writes cache; backtest reads cache. Tests pass
   without needing live LLM access.

4. **Cost-bounded.** One LLM call per trading day = ~252 calls/year.
   At 1000 input + 500 output tokens × $5/M = $0.0075/call = $1.89/yr.
   5y backtest = $9.45 worst case. Copilot CLI (free with sub) brings
   it to $0.

## LLM input schema (input prompt)

```json
{
  "as_of_date": "2024-06-03",
  "regime": "BULL",
  "regime_score": 100,
  "vix": 13.11,
  "fear_greed": 50,
  "breadth": {
    "above_50_pct": 72.7,
    "above_200_pct": 100.0
  },
  "sector_momentum": [
    {"sector": "Technology", "above_200": 100, "above_50": 75, "1m_return": 4.2},
    {"sector": "Financials", "above_200": 100, "above_50": 80, "1m_return": 6.8},
    {"sector": "Energy", "above_200": 95, "above_50": 60, "1m_return": -1.2},
    ...
  ],
  "candidates": [
    {"ticker": "AAPL", "sector": "Technology", "em_position": 25,
     "risk_score": 72, "trend": "above_sma200", "atr_percentile": 45},
    {"ticker": "OIH", "sector": "Energy", "em_position": 18,
     "risk_score": 80, "trend": "above_sma200", "atr_percentile": 60},
    ...20 candidates...
  ],
  "current_portfolio": {
    "cash": 75000,
    "open_positions": [{"ticker": "AAPL", "sector": "Technology", "value": 25000}],
    "sector_exposure": {"Technology": 0.25}
  },
  "themes_active": [
    {"name": "AI Infrastructure", "etfs": ["SMH", "WCLD"]},
    {"name": "Steepening Yield Curve", "etfs": ["XLF", "KRE"]},
    ...
  ]
}
```

## LLM output schema (Pydantic-validated)

```python
class AllocationDecision(BaseModel):
    regime_assessment: str  # 1-2 sentence
    risk_appetite: float    # 0.0 - 1.0
    preferred_sectors: list[str]   # 0-5 sectors to overweight
    avoid_sectors: list[str]       # 0-5 sectors to underweight
    active_themes: list[str]       # 0-3 themes from catalog
    approved_tickers: list[ApprovedTicker]
    entries_paused: bool
    pause_reason: str | None
    confidence_in_assessment: float  # 0.0 - 1.0

class ApprovedTicker(BaseModel):
    ticker: str
    conviction: float  # 0.0 - 1.0
    rationale: str
    primary_theme: str | None
```

## LLM prompt template

```
You are a sector-allocation strategist. Given this EOD market state,
produce a JSON allocation decision.

YOUR ROLE
- DO NOT pick individual stocks for technical reasons.
- DO assess risk regime, sector rotation, theme activation.
- DO allocate within the candidate set provided (don't invent tickers).
- DO scale risk_appetite based on VIX, breadth, drawdown.

CONTEXT: {context_json}

OUTPUT REQUIRED FORMAT:
{schema}

REASONING GUIDELINES
1. If VIX > 25 OR breadth_above_200 < 30 OR fear_greed > 80 → reduce
   risk_appetite to <= 0.3
2. If regime is BEAR or RANGE → prefer defensive sectors, reduce position
   count to <= 3
3. If sector breadth diverges (1m_return < -3% with above_200 < 50%)
   → exclude sector
4. Tie-break candidates by risk_score then sector preference
5. Maximum 5 approved_tickers per call (let risk engine pick from set)
6. Each approved_ticker MUST be from the candidates list

Return ONLY the JSON, no commentary.
```

## Caching strategy

```
backtest/llm-cache/
├── 2021-06-01.json   # {input_hash, prompt, response, model, tokens, latency_ms}
├── 2021-06-02.json
├── ...
└── 2026-06-12.json
```

- **Backtest mode**: read cache; if missing, fail-loud (don't silently
  fall back to mechanical layer — that breaks attribution).
- **Live mode**: call LLM, write cache on success, fall back to a
  conservative defensive allocation on failure.
- **Cache invalidation**: mtime-based; if input_hash changes (new fields
  added to market_state), force re-call.

## LLM provider abstraction

```python
class LLMClient(Protocol):
    def complete(self, prompt: str, *, schema: type[T]) -> T: ...

class CopilotCLIClient:
    """Default. Uses `copilot -p` with --allow-all-tools.
    Cost: $0 with subscription. Latency: ~5-15s per call.
    Limitation: no native JSON schema enforcement."""

class OpenAIClient:
    """openai>=2.0 with structured outputs. Cost: $0.005/call.
    Latency: 1-3s. Native JSON schema enforcement."""

class AnthropicClient:
    """anthropic>=0.30. Cost: $0.005/call. Latency: 2-5s.
    Tool-use schema enforcement."""

class OllamaClient:
    """Local llama 3.2 70B. Cost: $0. Latency: 30-60s on M-series.
    Schema via prompt + retry."""
```

## Backtest determinism

The 2-stage approach makes backtest replay byte-identical:

1. **First run** (cache cold): records every LLM call to `backtest/llm-cache/`.
2. **Subsequent runs** (cache warm): replays from cache, never calls LLM.

Both produce identical fills, closes, equity curve. Tests verify by
running 2024-06 backtest twice and checking SHA-256 of `closes.jsonl`.

## Failure modes

- **LLM returns invalid JSON**: retry once, then fall back to "no entries
  today" (`entries_paused=true`, `pause_reason="llm_parse_failed"`).
- **LLM returns 0 approved_tickers**: legitimate decision, day is no-trade.
- **Cache file missing in backtest mode**: hard error. Forces explicit
  cache regeneration, prevents accidental "looks like it worked" runs.
- **Cache file present but input_hash mismatched**: hard error. Same.
- **Rate limited / network error**: 1 retry with backoff, then fall back
  to defensive allocation (reduce risk_appetite=0.0, no entries).

## Migration strategy

Phase 1: Build agent in parallel with existing analyst.py
Phase 2: A/B test on 2024-Q1 (small window, fast)
Phase 3: Run full 5y backtest with reasoning agent
Phase 4: Compare results; if reasoning agent ≥ SPY benchmark → ship
Phase 5: Live cron switches to analyst_v2.py
Phase 6: Document attribution in dashboard /#backtest
