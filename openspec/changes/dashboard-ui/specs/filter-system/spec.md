## ADDED Requirements

### Requirement: Status group tabs with badge counts
The system SHALL display a tab bar with 6 status groups: All, Hot (RETEST+APPROACHING), Active (ACTIVE+TRAILING+TARGET_HIT), Alerts (EXIT_*), Watching, Inactive (STOPPED+DORMANT). Each tab SHALL show a count badge of matching setups.

#### Scenario: Tab filtering
- **WHEN** user clicks "Hot" tab
- **THEN** only cards with status RETEST or APPROACHING are visible; badge shows count (e.g., "Hot 7")

#### Scenario: All tab
- **WHEN** user clicks "All" tab
- **THEN** all cards are visible regardless of status

### Requirement: Bias chip filters
The system SHALL display 3 clickable chips (BULL, BEAR, MIXED) that filter cards by bias classification. Multiple chips can be active simultaneously (OR logic).

#### Scenario: Single bias filter
- **WHEN** user clicks BULL chip
- **THEN** only cards with `bias: "BULL"` are visible

#### Scenario: Combined bias filter
- **WHEN** user clicks both BULL and MIXED chips
- **THEN** cards with either BULL or MIXED bias are visible

### Requirement: Sector chip filters
The system SHALL display clickable sector chips (Technology, Healthcare, Energy, Utilities, Consumer, Financials, Crypto, Macro, etc.) derived from the sectors present in `setups.json`.

#### Scenario: Sector filter
- **WHEN** user clicks "Healthcare" chip
- **THEN** only cards in the Healthcare sector are visible

### Requirement: Search by ticker symbol
The system SHALL provide a search input that filters cards by ticker symbol substring match (case-insensitive).

#### Scenario: Symbol search
- **WHEN** user types "NVD" in the search box
- **THEN** only NVDA card is visible (substring match)

#### Scenario: Clear search
- **WHEN** user clears the search input
- **THEN** all cards matching other active filters are restored

### Requirement: Sort dropdown
The system SHALL provide a sort dropdown with options: Priority (default, by status sort order from TRADE_LIFECYCLE), Ticker A-Z, RSI Low→High, RSI High→Low, % from High.

#### Scenario: Sort by RSI ascending
- **WHEN** user selects "RSI Low→High"
- **THEN** cards are ordered by RSI value ascending (most oversold first)

### Requirement: URL hash sync for shareable views
The system SHALL sync all active filters to the URL hash fragment. Format: `#status=hot&bias=BULL&sector=Tech&sort=rsi_asc&q=NVD`.

#### Scenario: Load from URL hash
- **WHEN** page loads with `#status=hot&bias=BULL` in the URL
- **THEN** the Hot tab is active AND the BULL chip is selected

#### Scenario: Update hash on filter change
- **WHEN** user changes any filter
- **THEN** the URL hash updates without page reload (using `history.replaceState`)

### Requirement: Keyboard shortcuts
The system SHALL support keyboard shortcuts: `1-5` for status tabs (1=All, 2=Hot, 3=Active, 4=Alerts, 5=Watching), `/` to focus search, `Esc` to close modal and clear search.

#### Scenario: Tab shortcut
- **WHEN** user presses `2` with no input focused
- **THEN** the "Hot" tab is activated

#### Scenario: Search shortcut
- **WHEN** user presses `/` with no input focused
- **THEN** the search input is focused

### Requirement: Empty states per filter combination
The system SHALL show contextual empty state messages when filters produce zero results.

#### Scenario: No results
- **WHEN** "Hot" tab + "BULL" bias yields zero cards
- **THEN** the grid shows "No bullish retest or approaching setups right now. Check back after the next data refresh."
