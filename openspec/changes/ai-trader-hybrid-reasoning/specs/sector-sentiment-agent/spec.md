# Sector Sentiment Agent Spec

## ADDED Requirements

### Requirement: Reasoning agent MUST be a pure function
Calling `allocate(market_state) -> AllocationDecision` MUST return identical AllocationDecision bytes for identical input when in deterministic (cache-hit) mode.
The agent's purity guarantee enables byte-identical backtest replay.

#### Scenario: Same input twice yields same output
- **WHEN** `allocate(state_X)` is called once and cached
- **AND** `allocate(state_X)` is called again
- **THEN** the second call MUST return identical AllocationDecision
  without invoking the LLM

### Requirement: LLM output MUST be schema-validated
The `AllocationDecision` returned by the agent MUST pass Pydantic
schema validation. Invalid output triggers retry-once-then-fallback.

#### Scenario: Malformed JSON from LLM
- **WHEN** the LLM returns `{"approved_tickers": "AAPL"}` (string, not list)
- **THEN** the agent MUST retry once; if still invalid, return defensive
  allocation (entries_paused=true, pause_reason="llm_parse_failed")

### Requirement: All approved tickers MUST be in candidate set
The LLM MUST NOT invent tickers outside the input `candidates` list.
Any ticker in `approved_tickers` not present in `candidates` MUST be
filtered out before the result is returned to the analyst layer.

#### Scenario: LLM hallucinates ticker
- **WHEN** input candidates are [AAPL, MSFT, GOOGL]
- **AND** LLM returns approved_tickers including TSLA
- **THEN** TSLA MUST be filtered out; AAPL/MSFT/GOOGL pass through if approved

### Requirement: Backtest mode MUST read from cache
When `BACKTEST_MODE=1`, the agent MUST NOT call the LLM. It MUST read
from `backtest/llm-cache/<as_of_date>.json` or fail loud.

#### Scenario: Backtest cache hit
- **WHEN** backtest replays 2024-06-03
- **AND** `backtest/llm-cache/2024-06-03.json` exists
- **THEN** the agent MUST return the cached AllocationDecision without
  any network call

#### Scenario: Backtest cache miss
- **WHEN** backtest replays 2024-06-03
- **AND** `backtest/llm-cache/2024-06-03.json` does NOT exist
- **THEN** the agent MUST raise BacktestCacheMissError, NOT fall back
  to live LLM call (would break determinism)

### Requirement: Live mode MUST cache responses
When not in backtest mode, every successful LLM call MUST persist to
the cache file before returning the AllocationDecision.

#### Scenario: Live call writes cache
- **WHEN** live cron calls allocate() on 2026-06-15
- **AND** the LLM returns valid AllocationDecision
- **THEN** `backtest/llm-cache/2026-06-15.json` MUST be written with
  the input hash, prompt, response, model, tokens, and latency
