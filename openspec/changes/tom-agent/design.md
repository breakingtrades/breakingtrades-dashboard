# Design: Tom Agent

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  watchlist.json   │     │  Macro indicators │
│  (from pipeline)  │     │  (VIX, DXY, etc) │
└────────┬─────────┘     └────────┬─────────┘
         │                         │
         ▼                         ▼
┌──────────────────────────────────────────────┐
│              generate_briefing.py              │
│                                                │
│  1. Load system prompt + methodology           │
│  2. Assemble context (watchlist + macro data)  │
│  3. Call LLM for daily briefing                │
│  4. Call LLM for per-ticker takes (batched)    │
│  5. Parse and validate responses               │
│  6. Write tom-briefing.json                    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ tom-briefing.json│
              └────────┬────────┘
                       │
            ┌──────────┴───────────┐
            ▼                      ▼
   ┌────────────────┐    ┌──────────────────┐
   │ Dashboard Home  │    │ Ticker Detail     │
   │ "Daily Briefing"│    │ "Tom's Take" card │
   └────────────────┘    └──────────────────┘
```

## Module Design

### `generate_briefing.py`
- **Prompt assembly:**
  1. System prompt from `tom/system-prompt.md`
  2. Methodology from `tom/methodology.md` (injected as context)
  3. Current watchlist data (condensed: ticker, price, bias, EMAs, RSI)
  4. Macro snapshot (VIX, DXY, 10Y yield, 2Y yield, sector ETF prices)
  5. Pair ratio calculations (XLY/XLP, HYG/SPY, etc.)

- **LLM calls (2 total):**
  1. **Daily briefing**: Single call with full context → macro regime + top setups
  2. **Ticker takes**: Batched call — send 10 symbols per request with condensed data → get 10 takes back. Repeat for all symbols.

- **Response parsing:**
  - Expect structured JSON from LLM (via system prompt instruction)
  - Validate required fields present
  - Fallback: if JSON parsing fails, wrap raw text as the "take"

- **Output:** Write `data/output/tom-briefing.json`

### Prompt Templates

**Daily Briefing Prompt:**
```
[System prompt from tom/system-prompt.md]
[Methodology from tom/methodology.md]

Today's market data:
- VIX: {vix} | DXY: {dxy} | 10Y: {us10y} | 2Y: {us02y}
- SPY: {spy} ({spy_bias}) | QQQ: {qqq} ({qqq_bias})
- Pair ratios: XLY/XLP={xly_xlp}, HYG/SPY={hyg_spy}

Generate today's BreakingTrades daily briefing. Include:
1. Macro regime assessment (risk-on / risk-off / transitional)
2. Key pair ratio readings and what they signal
3. Sector rotation: which sectors are leading/lagging
4. Top 3-5 actionable setups from the watchlist with brief thesis

Output as JSON with fields: macro_briefing, regime, pair_ratios, top_setups
```

**Per-Ticker Take Prompt:**
```
[System prompt]

For each ticker below, provide a 2-3 sentence analysis and action recommendation.
Use the 6-layer framework. Be direct and specific.

{batch of 10 tickers with price, EMAs, RSI, bias, levels}

Output as JSON object: { "TICKER": { "take": "...", "action": "watch|enter|avoid|take_profits", "key_level": float } }
```

## Cost Estimation

- Daily briefing: ~2000 tokens input + ~500 output = ~2500 tokens
- Ticker takes: ~500 tokens input + ~300 output per batch of 10 = ~800 × 7 batches = ~5600 tokens
- **Total: ~8000 tokens/day ≈ $0.01-0.05/day** (depending on model)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| LLM API unavailable | Retry 3x, then write placeholder JSON with error message |
| JSON parse failure | Wrap raw response as text, log warning |
| Watchlist data missing | Generate briefing with macro-only context, skip ticker takes |
| Token limit exceeded | Reduce batch size, summarize watchlist data more aggressively |

## File Locations

```
tom/
├── system-prompt.md      ← Tom's persona and instructions
├── methodology.md        ← 6-layer framework + pair ratios + EMA rules
└── context/              ← (future) curated analysis, video transcripts

data/
├── pipeline/
│   └── generate_briefing.py
└── output/
    └── tom-briefing.json
```
