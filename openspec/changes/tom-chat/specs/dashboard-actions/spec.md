## ADDED Requirements

### Requirement: Action cards in Tom's responses
The system SHALL support structured action cards within Tom's responses that contain a title, summary list, and a clickable action button that modifies dashboard state.

#### Scenario: Filter action card
- **WHEN** Tom's response includes an action card of type `FILTER_STATUS`
- **THEN** the card renders as a bordered box with title (e.g., "🎯 3 Retest Setups Found"), a list of matching tickers with status, and a "[Show on Dashboard →]" button

#### Scenario: Action card button click
- **WHEN** user clicks "[Show on Dashboard →]" on a FILTER_STATUS action card
- **THEN** the dashboard's filter system activates the specified status tab (e.g., "Hot")

### Requirement: Support 5 action types
The system SHALL support these dashboard actions from Tom's responses:
- `FILTER_STATUS`: Set the active status tab
- `FILTER_SECTOR`: Set the active sector chip
- `OPEN_DETAIL`: Open the detail modal for a specific ticker
- `HIGHLIGHT_CARD`: Briefly pulse a specific card (2s animation)
- `SCROLL_TO`: Scroll the card grid to bring a specific card into view

#### Scenario: OPEN_DETAIL action
- **WHEN** Tom's response includes `[View NVDA →]` with action type `OPEN_DETAIL`
- **THEN** clicking the link opens the NVDA detail modal

#### Scenario: HIGHLIGHT_CARD action
- **WHEN** Tom's response includes a highlight for AMZN
- **THEN** the AMZN card receives a 2-second pulsing border animation (cyan glow) and the grid scrolls to show it

#### Scenario: Multiple actions in one response
- **WHEN** Tom's response contains both `FILTER_STATUS` and `HIGHLIGHT_CARD` actions
- **THEN** the filter applies first, then the highlight animation triggers on the specified card

### Requirement: Action cards are optional
The system SHALL render Tom's text responses without action cards when no dashboard action is relevant (e.g., answering "what's the stop level?" — pure text response, no UI change needed).

#### Scenario: Text-only response
- **WHEN** Tom answers a question about a specific level or rule
- **THEN** the response is plain text with no action card
