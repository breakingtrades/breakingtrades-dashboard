## ADDED Requirements

### Requirement: Generate per-ticker Tom's Take via LLM
The system SHALL generate a concise trading analysis for each ticker by calling an LLM (Azure OpenAI or Anthropic) with Tom's system prompt, the ticker's computed data (SMA levels, RSI, bias, status, sector), and current macro context.

#### Scenario: Standard analysis generation
- **WHEN** the pipeline runs for ticker AAPL with computed data showing BEAR bias, RSI 23.9, EXIT_SMA20 status
- **THEN** the system calls the LLM with Tom's persona + ticker context and writes output to `data/tom/takes/AAPL.json`

#### Scenario: Output schema
- **WHEN** Tom's Take is generated for any ticker
- **THEN** the JSON includes: `{ symbol, take (string, <200 words), action (WATCH_FOR_PULLBACK|BUY_THE_DIP|TRAIL_STOP|EXIT|HOLD|WAIT_FOR_RECLAIM), key_level (number), key_level_name (string), confidence (HIGH|MEDIUM|LOW), bias (BULL|BEAR|MIXED), signals (string[]), suggested_questions (string[3]), updated (ISO-8601) }`

#### Scenario: LLM API failure
- **WHEN** the LLM API returns an error or times out
- **THEN** the system logs the error and uses a fallback template: `"[symbol]: Data as of [date]. SMA20 at [value], SMA50 at [value]. Bias: [bias]. Status: [status]. Detailed analysis unavailable."`

### Requirement: Generate daily briefing via LLM
The system SHALL generate a daily market briefing covering macro regime, sector rotation, and top 5 actionable setups by calling the LLM with Tom's system prompt + all macro data + all setup data.

#### Scenario: Standard briefing
- **WHEN** the pipeline runs with full macro and setup data
- **THEN** the system generates and writes `data/tom/briefing.json` with: `{ date (ISO), regime (LATE_CYCLE|MID_CYCLE|EARLY_CYCLE|RECESSION), risk_level (LOW|ELEVATED|HIGH|CRITICAL), briefing (string, <500 words), top_setups ([{symbol, status, confidence}], max 5), action_items (string[], max 5), key_levels ({symbol: {support, resistance}}), updated (ISO-8601) }`

### Requirement: No external source attribution in output
The system SHALL ensure Tom's generated text never mentions FXEvolution, Market Masters Club, Tom (the person), or any external source. All analysis MUST be branded as BreakingTrades original content.

#### Scenario: Source filtering
- **WHEN** the LLM generates text containing "FXEvolution" or "Tom says"
- **THEN** the system strips or replaces those references before writing JSON

### Requirement: Batch generation with rate limiting
The system SHALL process all tickers in sequence with configurable delay between LLM calls (default 1 second) to avoid API rate limits. Total generation for 70 tickers MUST complete in under 5 minutes.

#### Scenario: Rate-limited generation
- **WHEN** 70 tickers are processed with 1-second delay
- **THEN** total LLM call time is ~70 seconds plus response generation time, finishing within 5 minutes
