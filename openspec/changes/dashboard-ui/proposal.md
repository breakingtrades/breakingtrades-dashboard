## Why

The current `index.html` is a working prototype with hardcoded data for 13 tickers. It needs to become a data-driven, filterable dashboard that renders the full 70-symbol watchlist from pipeline-generated JSON. The UX has been fully specified in `docs/UX_DESIGN_SPEC.md` (706 lines — design tokens, component specs, 7 card variants, wireframes) and `docs/FILTER_SYSTEM.md` (filter bar, status groups, URL hash sync, keyboard shortcuts).

## What Changes

- Rewrite `index.html` to load data from static JSON (`data/setups.json`, `data/macro.json`, `data/pairs.json`) instead of hardcoded arrays
- Implement data-driven card rendering with 7 card layout variants by trade status (from `docs/UX_DESIGN_SPEC.md` §8)
- Implement filter bar with 6 dimensions: status group tabs, bias chips, sector chips, search, sort dropdown, and ticker-level watchlist toggle
- Implement URL hash sync (`#status=hot&bias=BULL&sector=Tech`) for shareable filtered views
- Implement responsive layout: desktop 2-column grid (cards + right panel), mobile stacked with bottom nav
- Extract CSS into design token system (`--bg-base`, `--cyan`, `--red`, etc. from `docs/UX_DESIGN_SPEC.md` §1)
- Implement detail modal with staggered TradingView chart loading (daily SMA20 3px + SMA50 1px, weekly 4-MA stack)
- Add macro context strip, 12 pair ratio grid, sector strength bars, market regime badge to right panel
- Add keyboard shortcuts (1-5 for status tabs, / for search, Esc to close modal)
- Mobile: swipe between status tabs, bottom tab bar, full-screen modal

## Capabilities

### New Capabilities
- `data-driven-rendering`: Replace hardcoded `SETUPS[]`/`MACRO`/`PAIRS` with `fetch()` from `data/*.json` at page load; loading states, error handling, staleness detection (>4h = stale badge)
- `filter-system`: 6-dimension filter bar implementing `docs/FILTER_SYSTEM.md` — status group tabs (All/Hot/Active/Alerts/Watching/Inactive), bias chips, sector chips, search, sort, URL hash sync, badge counts per tab, empty states, keyboard shortcuts
- `card-variants`: 7 card layouts by status (RETEST=expanded+pulse, APPROACHING=expanded+range, ACTIVE/TRAILING=range+warning, EXIT=warning-prominent, WATCHING=compact, STOPPED=dimmed, DORMANT=ultra-compact) per `docs/UX_DESIGN_SPEC.md` §8
- `responsive-layout`: Desktop 2-column (cards + right panel), tablet 1-column, mobile full-width with bottom nav bar; breakpoints at 1440/1200/768/480px
- `detail-modal`: Ticker detail overlay with daily+weekly TradingView charts (staggered 1.5s load), level strip, Tom's Take block, setup stats, timezone-aware timestamps

### Modified Capabilities

_(none — no existing specs)_

## Impact

- **Modified files:** `index.html` (complete rewrite from ~1300 lines to ~2000+ lines structured)
- **New files:** Potentially `css/tokens.css`, `js/data.js`, `js/filters.js`, `js/cards.js` if we modularize (or keep single-file for simplicity)
- **Dependencies:** None new — vanilla HTML/CSS/JS, TradingView embed widgets (free)
- **Prereq:** `data-pipeline` change must produce the JSON files this consumes
- **Design specs:** `docs/UX_DESIGN_SPEC.md`, `docs/FILTER_SYSTEM.md`, `docs/TRADE_LIFECYCLE.md`
