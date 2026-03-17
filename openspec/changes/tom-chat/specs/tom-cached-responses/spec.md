## ADDED Requirements

### Requirement: Load Tom's Take from static JSON
The system SHALL fetch per-ticker analysis from `data/tom/takes/{TICKER}.json` and daily briefing from `data/tom/briefing.json` for use by the intent router's Tier 1 handler.

#### Scenario: Successful load
- **WHEN** the intent router handles a `cached_take` intent for AAPL and the JSON file exists
- **THEN** the system fetches `data/tom/takes/AAPL.json` and parses the response for display

#### Scenario: Cache miss
- **WHEN** the JSON file does not exist (404)
- **THEN** the system falls back to a generated summary from the setup data: "AAPL is currently [status] with [bias] bias. SMA20: $[value], SMA50: $[value]."

### Requirement: Format cached response as conversational Tom message
The system SHALL format the `take` field from the JSON into a styled Tom message, prepending the action badge and appending the confidence level and update timestamp.

#### Scenario: Full cached response
- **WHEN** cached JSON contains `{ take: "Below all MAs...", action: "WAIT_FOR_RECLAIM", confidence: "LOW", updated: "2026-03-17T13:35:00Z" }`
- **THEN** Tom's message shows: the take text, an action badge (`WAIT_FOR_RECLAIM` in orange), confidence indicator (`LOW` in red), and "Updated: 9:35 AM ET" timestamp

### Requirement: Suggested questions from cached JSON
The system SHALL use the `suggested_questions` array from the cached JSON to populate the suggestion chips after displaying a cached response.

#### Scenario: Suggested questions available
- **WHEN** cached JSON includes `suggested_questions: ["What's the closest support?", "When would you re-enter?", "How does this compare to 2022?"]`
- **THEN** those 3 questions replace the default suggestion chips

#### Scenario: No suggested questions
- **WHEN** `suggested_questions` is missing or empty
- **THEN** default ticker-context chips are shown ("What's the thesis?", "Entry levels?", "Compare to sector")

### Requirement: Briefing response for macro queries
The system SHALL format the daily briefing JSON into a structured Tom message with regime badge, risk level, bullet-point action items, and top setups list.

#### Scenario: Macro briefing display
- **WHEN** intent is `cached_briefing` and `data/tom/briefing.json` exists
- **THEN** Tom responds with: regime badge (e.g., "🔴 LATE_CYCLE"), risk level, briefing text, top 5 setups as clickable items, and action items as a bullet list
