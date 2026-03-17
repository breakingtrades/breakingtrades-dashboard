## ADDED Requirements

### Requirement: Client-side intent classification
The system SHALL classify user messages into 3 tiers using regex pattern matching: Tier 1 (cached response), Tier 2 (dashboard action), Tier 3 (live LLM fallback). Classification happens entirely client-side with no server call.

#### Scenario: Tier 1 — cached thesis query
- **WHEN** user types "What's the thesis on AAPL?" or "analysis for NVDA" or "what's your take on SPY"
- **THEN** intent is classified as `cached_take` with extracted ticker symbol

#### Scenario: Tier 1 — cached macro query
- **WHEN** user types "macro regime" or "what's the market outlook" or "regime status"
- **THEN** intent is classified as `cached_briefing`

#### Scenario: Tier 2 — dashboard filter action
- **WHEN** user types "show me retests" or "show breakout setups" or "show approaching"
- **THEN** intent is classified as `action_filter` with params `{ status: 'hot' }`

#### Scenario: Tier 2 — sector filter action
- **WHEN** user types "healthcare setups" or "show me tech" or "energy stocks"
- **THEN** intent is classified as `action_sector` with extracted sector name

#### Scenario: Tier 2 — RSI filter action
- **WHEN** user types "what's oversold" or "show overbought"
- **THEN** intent is classified as `action_rsi_filter`

#### Scenario: Tier 3 — live LLM fallback
- **WHEN** user types "Compare AAPL to its 2022 selloff" (no pattern match)
- **THEN** intent is classified as `live_llm`

### Requirement: Tier 1 handler loads cached JSON
The system SHALL handle Tier 1 intents by loading the appropriate JSON file and formatting it as a Tom-style response.

#### Scenario: Cached take response
- **WHEN** intent is `cached_take` for ticker AAPL and `data/tom/takes/AAPL.json` exists
- **THEN** Tom's response is composed from the `take` field, formatted with the `action` and `confidence` badges, followed by `suggested_questions` as clickable chips

#### Scenario: Cached take not found
- **WHEN** intent is `cached_take` for ticker XYZ but no JSON file exists
- **THEN** Tom responds: "I don't have analysis for XYZ yet. It'll be available after the next data refresh."

### Requirement: Tier 2 handler executes dashboard actions
The system SHALL handle Tier 2 intents by calling dashboard filter/navigation functions and displaying a confirmation message.

#### Scenario: Filter to Hot tab
- **WHEN** intent is `action_filter` with params `{ status: 'hot' }`
- **THEN** the dashboard's status tab switches to "Hot" AND Tom responds with a summary of matching setups

#### Scenario: Open ticker detail
- **WHEN** intent is `action_open_detail` with ticker NVDA
- **THEN** the detail modal opens for NVDA AND Tom shows context for that ticker

### Requirement: Tier 3 shows unavailable message (Phase 1)
The system SHALL handle Tier 3 intents in Phase 1 by displaying: "That's a great question, but I need my live brain for that one. Live chat coming soon — for now, I can help with thesis, levels, and filtering. Try asking about a specific ticker."

#### Scenario: Live LLM not yet available
- **WHEN** a Tier 3 intent is detected and no live LLM endpoint is configured
- **THEN** Tom displays the fallback message with suggestion chips for Tier 1/2 queries
