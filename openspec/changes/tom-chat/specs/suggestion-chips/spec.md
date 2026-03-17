## ADDED Requirements

### Requirement: Display 3 contextual suggestion chips below input
The system SHALL show 3 quick-action chips below the chat input that change dynamically based on the current context (viewed ticker, conversation state, dashboard state).

#### Scenario: Dashboard context (no ticker)
- **WHEN** no ticker is selected and chat opens
- **THEN** chips show: "Show me retests", "Macro regime?", "Best setups today"

#### Scenario: Ticker context (card selected or modal open)
- **WHEN** user is viewing AAPL (card or modal)
- **THEN** chips show: "What's the thesis?", "Entry levels?", "Compare to sector"

#### Scenario: After Tom mentions a level
- **WHEN** Tom's last response references a specific price level (e.g., "$170 neckline")
- **THEN** chips update to: "Show on chart", "What if it breaks?", "Historical analog?"

### Requirement: Chip click sends as message
The system SHALL treat chip clicks as if the user typed and submitted the chip's text.

#### Scenario: Chip click
- **WHEN** user clicks "What's the thesis?" chip
- **THEN** "What's the thesis?" appears as a user message in the chat and is processed by the intent router

### Requirement: Chips update after each response
The system SHALL regenerate chip suggestions after each Tom response based on the current context + last message content.

#### Scenario: Post-response chip update
- **WHEN** Tom responds with analysis about PFE showing a RETEST
- **THEN** chips update to context-relevant options like: "Show PFE on chart", "Is the volume healthy?", "Other retests?"
