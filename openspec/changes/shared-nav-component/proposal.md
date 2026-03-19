## Why

The nav bar is duplicated across 3 HTML files (index.html, watchlist.html, market.html) with inconsistent features — search only works on index.html, logo/icon changes require editing all files, and the ticker marquee/market status may drift between pages. Every nav change means 3 edits.

## What Changes

- Extract the shared nav bar into a single `js/nav.js` module that renders the full nav (logo, page links, search, marquee, timezone, market status) into any page
- Remove inline nav HTML from index.html, watchlist.html, market.html — replace with a `<div id="nav"></div>` mount point
- Ticker search (`ticker-search.js` + StockAnalysis API autocomplete) works on all pages
- Shared nav CSS extracted or kept inline within nav.js injection
- Active page link highlighted based on current URL

## Capabilities

### New Capabilities
- `shared-nav`: Reusable nav bar component rendered via JS, injected into all pages from a single source. Includes logo (icon-only on mobile), page links with active state, ticker search with autocomplete, market status, ticker marquee, and timezone selector.

### Modified Capabilities

## Impact

- `index.html` — nav HTML removed, replaced with mount div + nav.js include
- `watchlist.html` — same, gains search functionality it didn't have
- `market.html` — same, gains search functionality
- `js/nav.js` — new file, single source of truth for nav
- `js/ticker-search.js` — may need minor adjustment to init after nav renders
- `js/market-status.js` — may need to init after nav mount
- Nav-related CSS consolidated (currently split across 3 files with slight differences)
