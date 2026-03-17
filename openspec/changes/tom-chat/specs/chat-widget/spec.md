## ADDED Requirements

### Requirement: Floating action button (FAB) for Tom chat
The system SHALL display a circular FAB (56×56px desktop, 48×48px mobile) in the bottom-right corner (bottom: 24px, right: 24px) at z-index 300. The FAB shows a target emoji (🎯) and "Tom" label.

#### Scenario: FAB rendering
- **WHEN** the page loads
- **THEN** the FAB is visible in the bottom-right corner above all other content including modals

#### Scenario: FAB click opens chat panel
- **WHEN** user clicks the FAB
- **THEN** a chat panel expands (380px wide desktop, full-screen mobile) with header, message area, and input field

#### Scenario: Chat panel close
- **WHEN** user clicks the close button in the chat header or presses Esc
- **THEN** the chat panel closes and the FAB returns to collapsed state

### Requirement: Chat panel header shows current context
The system SHALL display the current context in the chat header: "🎯 Tom · Dashboard" when no ticker is selected, "🎯 Tom · AAPL" when a card is clicked, "🎯 Tom · AAPL (detail)" when the detail modal is open.

#### Scenario: Context update on card click
- **WHEN** user clicks a card for NVDA
- **THEN** the chat header updates to "🎯 Tom · NVDA"

#### Scenario: Context update on modal open
- **WHEN** user opens the detail modal for NVDA
- **THEN** the chat header updates to "🎯 Tom · NVDA (detail)"

#### Scenario: Context clear on modal close
- **WHEN** user closes the detail modal with no card selected
- **THEN** the chat header reverts to "🎯 Tom · Dashboard"

### Requirement: Message display with Tom/user styling
The system SHALL display Tom's messages with left-aligned cyan border and subtle cyan background, and user messages with right-aligned gray border. Messages support basic formatting (bold, line breaks, bullet lists).

#### Scenario: Tom message rendering
- **WHEN** Tom's response is displayed
- **THEN** it appears left-aligned with `border-left: 2px solid var(--cyan)`, `background: rgba(0, 212, 170, 0.06)`, font-size 12px, line-height 1.6

#### Scenario: User message rendering
- **WHEN** user's message is displayed
- **THEN** it appears right-aligned with `border-right: 2px solid var(--text-dim)`, standard card background

### Requirement: Text input with submit
The system SHALL provide a text input at the bottom of the chat panel with placeholder "Ask Tom..." and a submit button. Submit is triggered by Enter key or clicking the submit arrow.

#### Scenario: Submit message
- **WHEN** user types "What's the thesis?" and presses Enter
- **THEN** the message appears in the chat, input is cleared, and the intent router processes the message

#### Scenario: Empty submit
- **WHEN** user presses Enter with empty input
- **THEN** nothing happens (no empty message sent)

### Requirement: Mobile full-screen chat
The system SHALL render the chat panel as full-screen on mobile (<768px) with a back arrow to close.

#### Scenario: Mobile chat open
- **WHEN** user taps the FAB on mobile
- **THEN** the chat panel fills the entire viewport (100vw × 100vh) with a back arrow in the header
