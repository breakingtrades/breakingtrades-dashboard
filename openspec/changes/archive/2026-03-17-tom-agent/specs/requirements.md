# Requirements: Tom Agent

## Functional Requirements

### FR-1: System Prompt & Persona
- FR-1.1: Tom is a seasoned trader mentor — direct, no-nonsense, data-driven
- FR-1.2: All responses are BreakingTrades branded (no external source attribution)
- FR-1.3: Uses structured 6-layer decision framework for all analysis
- FR-1.4: Communicates in concise, actionable language
- FR-1.5: Acknowledges uncertainty — never guarantees outcomes
- FR-1.6: System prompt stored in `tom/system-prompt.md`

### FR-2: Methodology Context
- FR-2.1: 6-layer decision stack documented in `tom/methodology.md`:
  1. Macro regime (risk-on / risk-off / transitional)
  2. Sector rotation (leading/lagging sectors, pair ratios)
  3. Individual stock analysis (EMA alignment, levels, pattern)
  4. Risk assessment (VIX regime, correlation, position sizing)
  5. Entry criteria (pullback to EMA, volume confirmation, catalyst)
  6. Position management (stops, targets, scaling)
- FR-2.2: Pair ratio framework documented:
  - XLY/XLP (consumer discretionary vs staples — risk appetite)
  - HYG/SPY (high yield bonds vs equities — credit stress)
  - XLK/XLU (tech vs utilities — growth vs defense rotation)
  - Copper/Gold (economic expansion vs contraction)
- FR-2.3: EMA rules documented:
  - Bullish: Price > EMA 8 > EMA 21 > EMA 50 (stacked)
  - Bearish: Price < EMA 8 < EMA 21 < EMA 50 (stacked)
  - Entry on pullback to EMA 8 or EMA 21 in aligned trend
  - Stop below next EMA level

### FR-3: Daily Briefing Generation
- FR-3.1: Generate a daily macro briefing covering:
  - Market regime assessment (risk-on/off/transitional)
  - Key macro signals (VIX, DXY, yields, sector rotation)
  - Pair ratio readings with interpretation
  - Top 3-5 actionable setups from watchlist
- FR-3.2: Generate per-ticker "Tom's Take" for each watchlist symbol:
  - 2-3 sentence analysis using 6-layer framework
  - Bias confirmation or warning
  - Key levels to watch
  - Suggested action (watch, enter, avoid, take profits)
- FR-3.3: Output as `data/output/tom-briefing.json`:
  ```json
  {
    "generated_at": "ISO-8601",
    "macro_briefing": "...",
    "regime": "risk-on",
    "pair_ratios": { "XLY_XLP": { "value": 1.85, "signal": "risk-on" }, ... },
    "top_setups": ["AAPL", "NVDA", "D"],
    "ticker_takes": {
      "D": { "take": "...", "action": "watch", "key_level": 54.50 },
      ...
    }
  }
  ```

### FR-4: Context Injection
- FR-4.1: Tom receives current `watchlist.json` as context
- FR-4.2: Tom receives macro indicators (VIX, DXY, yields, sector ETFs)
- FR-4.3: Tom receives `methodology.md` as system-level context
- FR-4.4: Context assembled by a Python script before LLM call

### FR-5: Dashboard Integration
- FR-5.1: "Tom's Daily Briefing" card on dashboard home page
- FR-5.2: "Tom's Take" section on each ticker detail page
- FR-5.3: Cards display cached analysis from `tom-briefing.json`
- FR-5.4: Timestamp showing when analysis was generated

## Non-Functional Requirements

- **NFR-1:** Daily analysis generation completes in < 2 minutes
- **NFR-2:** No live API calls from frontend (all cached JSON)
- **NFR-3:** System prompt + methodology < 4000 tokens (fits in any LLM context)
- **NFR-4:** All content BreakingTrades branded — no external attribution
- **NFR-5:** Graceful degradation — if generation fails, show "Analysis updating..." placeholder

## Dependencies

- `data/output/watchlist.json` from watchlist-engine
- LLM API access (Azure OpenAI or Anthropic) for generation script
- `tom/system-prompt.md` and `tom/methodology.md` authored and maintained
