# Tasks — Hybrid Reasoning Agent

## 1. Spec authoring

- [x] 1.1 Author proposal.md
- [x] 1.2 Author design.md
- [x] 1.3 Author tasks.md
- [x] 1.4 Author specs/sector-sentiment-agent/spec.md
- [x] 1.5 Author specs/theme-rotation/spec.md
- [x] 1.6 Author specs/risk-overlay/spec.md
- [ ] 1.7 `openspec validate ai-trader-hybrid-reasoning --strict` passes
- [ ] 1.8 Subagent review of spec for hidden bugs / scope drift / look-ahead bias

## 2. Build LLM client abstraction

- [ ] 2.1 `agents/llm_client.py` — Protocol + CopilotCLIClient (default)
- [ ] 2.2 `agents/llm_client.py` — OpenAIClient, AnthropicClient, OllamaClient stubs
- [ ] 2.3 Schema-driven JSON repair (1-retry on parse failure)
- [ ] 2.4 Unit test: mock LLM, verify schema validation

## 3. Build deterministic risk-scorer layer

- [ ] 3.1 `agents/risk_scorer.py` — compute per-ticker risk_score from:
       em_position, trend, atr_percentile, sector_breadth, recent_drawdown
- [ ] 3.2 Validate against 2024-Q1 fixture data
- [ ] 3.3 Unit test: known inputs → expected scores

## 4. Build sector state aggregator

- [ ] 4.1 `agents/sector_state.py` — group candidates by sector, compute
       per-sector momentum + breadth from existing fixture data
- [ ] 4.2 Add 1m_return calculation from cached OHLC
- [ ] 4.3 Unit test: synthetic state → known sector vector

## 5. Build theme catalog

- [ ] 5.1 `agents/theme_catalog.py` — define 12+ themes with ticker mappings
- [ ] 5.2 Theme name validation utility
- [ ] 5.3 Test: every catalog entry's tickers exist in watchlist

## 6. Build reasoning agent

- [ ] 6.1 `agents/reasoning_agent.py` — `allocate()` function
- [ ] 6.2 Build prompt from market state + candidates
- [ ] 6.3 Pydantic AllocationDecision schema
- [ ] 6.4 Cache reader/writer (`backtest/llm-cache/<date>.json`)
- [ ] 6.5 Backtest mode flag detection
- [ ] 6.6 Defensive fallback when LLM fails

## 7. Build analyst_v2

- [ ] 7.1 `analyst_v2.py` — orchestrate scout → risk_scorer → sector_state →
       reasoning_agent → recommendations
- [ ] 7.2 Convert AllocationDecision → list[Recommendation] with theme citations
- [ ] 7.3 Side-by-side runnable: AI_TRADER_USE_LLM=1 swaps in v2

## 8. Backtest harness integration

- [ ] 8.1 backtest.py — set BACKTEST_MODE=1 before pipeline import
- [ ] 8.2 Pre-warm LLM cache on first run
- [ ] 8.3 Determinism test: 2 backtests, identical SHA-256 of closes.jsonl

## 9. Smoke + validation

- [ ] 9.1 Smoke: 2024-Q1 backtest with LLM agent, verify trades fire
- [ ] 9.2 Verify themes appear in rule_citations
- [ ] 9.3 Verify risk caps still hold (no oversized fills)
- [ ] 9.4 LLM cost calculation across smoke window

## 10. Full 5y validation

- [ ] 10.1 Run full 5y backtest with LLM agent (cache cold, then warm)
- [ ] 10.2 Compare to Phase 7d baseline (-50.42%) and SPY (+89.24%)
- [ ] 10.3 Document Sharpe, drawdown, sector exposure over time
- [ ] 10.4 Per-theme attribution in dashboard

## 11. Subagent review of implementation

- [ ] 11.1 Brutal review of agents/* and analyst_v2.py
- [ ] 11.2 Fix critical/high findings
- [ ] 11.3 Re-run 5y if findings affected logic

## 12. Ship to production

- [ ] 12.1 Update dashboard /#backtest with reasoning-agent results
- [ ] 12.2 Update SOUL.md / readme with new architecture
- [ ] 12.3 If LLM agent beats SPY benchmark → switch live cron to analyst_v2
- [ ] 12.4 If LLM agent fails → revert to mechanical Phase 7c, document why
