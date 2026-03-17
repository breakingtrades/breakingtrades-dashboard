## ADDED Requirements

### Requirement: Load dashboard data from static JSON files
The system SHALL fetch `data/setups.json`, `data/macro.json`, `data/pairs.json`, and `data/tom/briefing.json` via `fetch()` on page load and render all UI from this data.

#### Scenario: Successful data load
- **WHEN** the page loads and all JSON files return HTTP 200
- **THEN** the dashboard renders macro strip, pair ratios, setup cards, and daily briefing from the fetched data

#### Scenario: JSON file not found
- **WHEN** any JSON file returns HTTP 404
- **THEN** the affected section shows a "Data unavailable" placeholder (not a crash); other sections render normally

#### Scenario: Stale data detection
- **WHEN** the `updated` timestamp in any JSON file is more than 4 hours old
- **THEN** a "⚠ Data may be stale" badge appears next to the timestamp in the top bar

### Requirement: Loading states during fetch
The system SHALL show skeleton placeholders while JSON files are loading.

#### Scenario: Cards loading
- **WHEN** `setups.json` has not yet loaded
- **THEN** 6 skeleton card placeholders (pulsing dark rectangles) are shown in the grid area

#### Scenario: Macro strip loading
- **WHEN** `macro.json` has not yet loaded
- **THEN** the macro strip shows 8 skeleton pill placeholders

### Requirement: Render all cards from SETUPS array
The system SHALL render one card per entry in `setups.json`, using the `status` field to determine card variant, and SHALL NOT contain any hardcoded ticker data in HTML or JS.

#### Scenario: Full watchlist rendering
- **WHEN** `setups.json` contains 70 entries
- **THEN** 70 cards are rendered (filtered view may show fewer)

#### Scenario: Empty setups
- **WHEN** `setups.json` is an empty array
- **THEN** the grid area shows "No setups available" empty state
