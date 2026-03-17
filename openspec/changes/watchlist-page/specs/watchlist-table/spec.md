# Spec: Watchlist Table

## ADDED Requirements

### Requirement: Sortable Data Table
The watchlist page shall provide a custom HTML table showing all tracked symbols with computed metrics from the data pipeline.

#### Scenario: Default table display
WHEN the user switches to Table view
THEN a table renders with columns: Ticker, Sector, Price, % Chg (1d), SMA20, SMA50, Bias, Status
AND all ~70 symbols from `watchlist.json` are displayed
AND rows are color-coded: green for BULL bias, red for BEAR, gray for MIXED

#### Scenario: Sort by column
WHEN the user clicks a column header
THEN the table sorts by that column (ascending)
AND clicking the same header again reverses to descending
AND a sort indicator arrow appears on the active column

#### Scenario: Click row to open detail
WHEN the user clicks a table row
THEN the detail modal opens for that ticker (same modal as Signals page)
AND daily + weekly TradingView charts load sequentially

#### Scenario: Search/filter
WHEN the user types in the search box above the table
THEN rows are filtered by ticker symbol match (case-insensitive)
AND the count updates to show "Showing X of Y symbols"

### Requirement: View Toggle
The watchlist page shall support switching between Widget view and Table view.

#### Scenario: Toggle between views
WHEN the user clicks the Widget/Table toggle button
THEN the page switches between TradingView Market Overview widget and custom data table
AND the user's preference is persisted in localStorage key `bt_watchlist_view`
AND the toggle button shows the currently active view state

### Requirement: Responsive Layout
#### Scenario: Mobile display
WHEN the viewport is < 768px
THEN the table view shows a condensed set of columns: Ticker, Price, % Chg, Bias
AND horizontal scrolling is disabled (columns fit viewport)
AND the Widget view scales to full width
