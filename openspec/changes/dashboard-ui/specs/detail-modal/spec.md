## ADDED Requirements

### Requirement: Detail modal with daily and weekly TradingView charts
The system SHALL display a modal overlay when a card is clicked, containing: ticker header with bias badge, daily TradingView chart (SMA20 3px cyan + SMA50 1px orange, RSI, Volume, 6M range), weekly TradingView chart (SMA 20/50/100/200, Volume, 3Y range), setup stats, level strip, and Tom's Take block.

#### Scenario: Modal open
- **WHEN** user clicks any setup card
- **THEN** a modal appears (z-index 200) with the ticker's full detail view; body scroll is locked

#### Scenario: Staggered chart loading
- **WHEN** the modal opens
- **THEN** the daily chart initializes immediately, and the weekly chart initializes 1.5 seconds later via `setTimeout` to avoid TradingView WebSocket race condition. A "Loading weekly chart…" placeholder is shown during the delay.

#### Scenario: Modal close cancels pending chart
- **WHEN** user closes the modal before the weekly chart timer fires
- **THEN** the `_weeklyChartTimer` is cleared via `clearTimeout` to prevent initialization of a chart in a closed modal

### Requirement: Timezone-aware chart configuration
The system SHALL pass the user's selected timezone (from `localStorage` key `bt_timezone`, default auto-detected via `Intl.DateTimeFormat`) to TradingView widget configuration.

#### Scenario: Timezone change while modal open
- **WHEN** user changes timezone in the top-bar dropdown while a detail modal is open
- **THEN** both charts are destroyed and reinitialized with the new timezone

### Requirement: Level strip with MA values
The system SHALL display a horizontal level strip showing SMA20, SMA50, Weekly SMA20 values with colored dots matching the chart MA colors, plus current price highlighted.

#### Scenario: Level strip rendering
- **WHEN** modal opens for a ticker with SMA20=$262.45, SMA50=$262.26, W20=$266.25, Price=$244.87
- **THEN** the level strip shows 4 labeled values in a horizontal bar, price highlighted in white, MAs in their respective colors

### Requirement: Tom's Take block in modal
The system SHALL display Tom's pre-generated analysis for the current ticker, loaded from `data/tom/takes/{TICKER}.json`.

#### Scenario: Tom's Take available
- **WHEN** modal opens and `data/tom/takes/AAPL.json` exists
- **THEN** the analysis text, action badge, confidence badge, and key level are displayed in a styled block with Tom's avatar icon

#### Scenario: Tom's Take unavailable
- **WHEN** `data/tom/takes/{TICKER}.json` returns 404
- **THEN** the Tom's Take section shows "Analysis not yet available for this ticker"

### Requirement: Mobile modal is full-screen
The system SHALL render the detail modal as full-screen on mobile (<768px) with a close button in the top-right corner and vertical scroll for chart + stats content.

#### Scenario: Mobile modal
- **WHEN** a card is tapped on mobile
- **THEN** the modal fills the entire viewport (100vw × 100vh) with charts stacked vertically
