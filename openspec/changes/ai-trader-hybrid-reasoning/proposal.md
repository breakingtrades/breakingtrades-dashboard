# AI-Trader Hybrid Reasoning Agent

## Why

The 5-year backtest delivered an unambiguous verdict on the deterministic
Tom rule walker:

```
ALL trades:    -38.38% (5y), Sharpe -0.97, 174 trades 33% win
WITH R549:     +0.6% (15 trades, 53% win, +$37/trade)  ← only signal
WITHOUT R549:  -39.0% (159 trades, 31% win, -$245/trade) ← random noise
SPY benchmark: +89.24% same window
```

Mechanical translation of Tom's discretionary rules to deterministic
matchers is barren. Tom's edge is in *contextual judgment* — knowing
when bond canary matters vs is just noise, when breadth strength is
genuine vs trapped, when to pivot from tech to financials based on
catalysts. The matchers can't capture this. We have two choices:

1. Spend months tuning rules per attribution — likely diminishing returns
2. Replace the rule walker with an LLM reasoning agent that consumes the
   same market state and reasons about *risk-adjusted opportunity* and
   *sector/theme rotation* like a human strategist would

This proposal pursues option 2. Critically, this is NOT an "ask the LLM
which stocks to buy" approach. The LLM has no edge there. It IS a "use
the LLM's structured reasoning over multi-factor market state to allocate
RISK BUDGET across sectors/themes/setups" approach.

## What Changes

### Preserved (mechanical, deterministic)

- Scout: same 88-ticker universe, EM-position scoring, signal-state weights
- Risk engine: same 11-gate cascade, quarter-Kelly, 12% portfolio heat,
  sector/short caps, drawdown breaker (Phase 7c serialization fix)
- Executor: same paper-fill simulator, slippage by group
- Manager: same 5-trigger lifecycle (STOP_OUT, TARGET, EM_EXIT, TIME_STOP,
  REGIME_EXIT), trail-stops, real OHLC stop-checks
- Backtest harness: same time virtualization, fixture replay, reporter
- Time-series outputs: regime, breadth, F&G, VIX, EM-bands, prices

### Replaced (deterministic rule walker → LLM reasoning agent)

The analyst.py module is split into two layers:

**Layer 1 (deterministic): Risk Score**
Pure mechanical computation of per-ticker setup quality:
- EM-position percentile (where in band)
- Trend alignment (above SMA20/50/200)
- Volatility regime (ATR percentile vs 6-month history)
- Sector breadth (% sector tickers above 200d)
- Recent drawdown (5-day return)

Output: numeric risk_score 0-100 per candidate, NO recommendation.

**Layer 2 (reasoning): Sector Allocator + Theme Picker**
LLM agent receives:
- Today's full market state snapshot
- Per-sector breadth + momentum
- VIX/MOVE/F&G regime signals
- Top 20 candidates with their risk_scores
- Recent macro headlines (optional, future)
- Current portfolio composition

LLM returns a structured JSON allocation:
```json
{
  "regime_assessment": "BULL leadership rotating from mega-cap tech to small-caps",
  "preferred_sectors": ["Financials", "Energy", "Small Caps"],
  "avoid_sectors": ["Tech", "Defensives"],
  "preferred_themes": ["AI Infrastructure", "Steepening Yield Curve"],
  "risk_appetite": 0.7,
  "approved_tickers": [
    {"ticker": "XLF", "conviction": 0.7, "rationale": "Yield curve steepening + bank earnings strength"},
    {"ticker": "IWM", "conviction": 0.6, "rationale": "Small-cap breakout + breadth confirmation"},
    {"ticker": "OIH", "conviction": 0.5, "rationale": "Oil services breakout + capex cycle"}
  ],
  "entries_paused": false,
  "drawdown_caveat": null
}
```

Risk engine consumes `approved_tickers` and applies normal sizing/heat/sector caps.

### New components

1. **scripts/ai-trader/agents/reasoning_agent.py** — LLM call wrapper
2. **scripts/ai-trader/agents/risk_scorer.py** — deterministic per-ticker scoring
3. **scripts/ai-trader/agents/llm_client.py** — provider abstraction (copilot/openai/anthropic/local)
4. **scripts/ai-trader/agents/sector_state.py** — builds per-sector breadth/momentum snapshot
5. **scripts/ai-trader/agents/theme_catalog.py** — defines investable themes (AI infra, yield-curve, etc.)

## Capabilities

### Capability: sector-sentiment-agent
Reads market-state snapshot, calls LLM, returns sector preference vector.

### Capability: theme-rotation
Maintains a catalog of 12-20 named investable themes with their underlying
sector/ticker mappings. LLM selects active themes per day.

### Capability: risk-overlay
The LLM cannot bypass risk caps. It can only:
- Reduce overall risk budget (drop conviction, fewer entries)
- Reject candidates the deterministic layer flagged
- Suggest sector concentration within allowed caps
The risk engine has FINAL veto on sizing and position count.

## Non-Goals

- LLM picks individual stock entries with technical-analysis precision
  (it has no edge here vs scout's deterministic EM-position scoring)
- LLM bypasses risk caps (sector/heat/drawdown gates remain mechanical)
- LLM trades intraday (decisions are EOD only, same cron schedule)
- Real-time market data feeds (still EOD yfinance)
- Replacing the manager (lifecycle stays deterministic — stops, targets,
  trailing, time/regime exits)

## Acceptance Criteria

1. **Backtest harness MUST work with LLM agent.** The harness uses the same
   replay loop. LLM calls happen against a *cached* response file in
   backtest mode (deterministic replay) but live in production. The cache
   stores LLM input + output verbatim so any backtest is reproducible.

2. **5y backtest MUST produce comparable Sharpe to SPY (≥ 0.4).** If the
   LLM agent's 5y backtest returns < SPY -25% (i.e. -64% absolute over
   the same window), the experiment is declared failed and we fall back
   to mechanical layer + buy-and-hold SPY base.

3. **LLM cost MUST stay < $5 per 5y backtest run.** Use Copilot CLI
   (free with subscription), or fall back to a small local model
   (llama 3.2 70B via Ollama, 0 cost). One LLM call per trading day.

4. **LLM output MUST be structured JSON validated against a Pydantic
   schema.** Free-form recommendations are rejected; the LLM must
   produce parseable allocation specs.

5. **Reasoning agent MUST be REPLACEABLE.** The interface between layers
   is a single function `allocate(market_state) → AllocationDecision`.
   We can swap copilot for openai for anthropic for local llama with a
   single config change.

6. **Backtest comparison test MUST show clear improvement.** A side-by-side
   2024-Q1 backtest with/without the LLM agent must show:
   - Either materially better return AND Sharpe with the agent
   - OR clearly document why the agent is no better (and we revert)

## Structure

```
breakingtrades/
├── scripts/ai-trader/
│   ├── analyst.py               (legacy — kept for fallback)
│   ├── analyst_v2.py            (new — calls reasoning agent)
│   └── agents/
│       ├── reasoning_agent.py   (new)
│       ├── risk_scorer.py       (new)
│       ├── llm_client.py        (new)
│       ├── sector_state.py      (new)
│       ├── theme_catalog.py     (new)
│       ├── llm_cache.py         (new — fixtures for backtest replay)
│       ├── tom_rules.py         (kept for reference)
│       └── empirical_priors.py  (kept for reference)
└── backtest/
    └── llm-cache/               (new — date-keyed LLM I/O for replay)
        └── 2024-06-03.json
```

The backtest harness, when running in cached mode, reads from
`backtest/llm-cache/<date>.json` instead of calling the LLM. Production
runs cache on first call, replay subsequent runs against the cache for
deterministic comparison.
