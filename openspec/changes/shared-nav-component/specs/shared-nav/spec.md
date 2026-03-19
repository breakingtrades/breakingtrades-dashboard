## ADDED Requirements

### Requirement: Nav mount point
Each HTML page SHALL contain a `<nav id="nav"></nav>` element as the first child of `<body>`. The `nav.js` script SHALL render the complete nav bar into this element on load.

#### Scenario: Nav renders on page load
- **WHEN** any page (index.html, watchlist.html, market.html) loads
- **THEN** the nav bar is rendered with logo, page links, search, marquee, market status, and timezone selector

### Requirement: Active page highlighting
The nav SHALL highlight the current page link based on `window.location.pathname`. The active link SHALL have a distinct visual style (e.g., brighter color, underline).

#### Scenario: Watchlist page active state
- **WHEN** user is on watchlist.html
- **THEN** the "Watchlist" nav link is visually highlighted as active

### Requirement: Search on all pages
The ticker search input with StockAnalysis API autocomplete SHALL be present in the nav bar on all pages. Selecting a result SHALL open the TradingView detail overlay modal.

#### Scenario: Search from watchlist page
- **WHEN** user types "MSTR" in search on watchlist.html
- **THEN** autocomplete results appear from StockAnalysis API and selecting one opens the TV detail overlay

### Requirement: Mobile responsive logo
On viewports ≤ 480px, the nav SHALL display only the SVG icon logo. The "BREAKINGTRADES" text SHALL be hidden.

#### Scenario: Mobile logo
- **WHEN** viewport width is 480px or less
- **THEN** only the chart icon SVG is visible; text is hidden

### Requirement: Consistent nav across pages
All pages SHALL render an identical nav bar from the same `nav.js` source. No page SHALL have inline nav HTML.

#### Scenario: Nav parity
- **WHEN** comparing the rendered nav on index.html vs watchlist.html vs market.html
- **THEN** all three are identical except for the active page highlight

### Requirement: Script initialization order
`nav.js` SHALL render the nav DOM first, then initialize dependent modules (ticker search, market status, marquee) by calling their exported init functions.

#### Scenario: Search init after nav
- **WHEN** nav.js finishes rendering
- **THEN** `initTickerSearch()` is called and the search input is functional
