# Spec: Shared Navigation

## ADDED Requirements

### Requirement: Top Navigation Bar
All dashboard pages shall share a consistent top navigation bar.

#### Scenario: Navigation display
WHEN any dashboard page loads
THEN a nav bar renders at the top with links: Signals, Watchlist, Market
AND the current page link is highlighted with cyan underline (`#00d4aa`)
AND the BREAKINGTRADES logo/text is on the left
AND the timezone selector is on the right

#### Scenario: Navigation links
WHEN the user clicks "Signals"
THEN the browser navigates to `index.html`
AND WHEN the user clicks "Watchlist"
THEN the browser navigates to `watchlist.html`
AND WHEN the user clicks "Market"
THEN the browser navigates to `market.html`

#### Scenario: Macro strip persistence
WHEN any page loads
THEN the macro strip (VIX, DXY, US10Y, Oil, BTC, etc.) renders below the nav bar
AND the strip data is consistent across all pages (same JSON source)

### Requirement: Mobile Navigation
#### Scenario: Small screen nav
WHEN the viewport is < 768px
THEN the nav items are evenly spaced across the full width
AND font size reduces to fit without wrapping
AND the macro strip scrolls horizontally if needed
