## Context

BreakingTrades dashboard is a static GitHub Pages site with 3 pages (index.html, watchlist.html, market.html). Each has its own inline nav HTML and CSS. The nav includes: logo, page links, ticker marquee strip, market status, timezone selector, and a search bar. Search (StockAnalysis API autocomplete → TradingView detail overlay) currently only exists on index.html.

## Goals / Non-Goals

**Goals:**
- Single source of truth for nav bar across all pages
- Search available on every page
- Active page link highlighting
- Consistent nav CSS (currently slightly different per page)
- Zero additional dependencies (vanilla JS)

**Non-Goals:**
- Converting to SPA (keep multi-page architecture)
- Server-side rendering or build step
- Changing nav visual design (just extraction, not redesign)

## Decisions

### 1. Injection via `nav.js` DOM creation (not template literals)
Build nav DOM elements in JS, append to a `<nav id="nav"></nav>` mount point. This avoids large HTML template strings and makes it easier to conditionally set active state based on `location.pathname`.

**Alternative considered:** HTML imports / `<template>` — poor browser support without build tools.
**Alternative considered:** `fetch('nav.html')` + innerHTML — extra HTTP request, flash of unstyled content.

### 2. Nav CSS stays in a shared `css/nav.css` file
Extract all nav-related CSS from the 3 HTML files into one `css/nav.css`, linked by all pages. Page-specific styles stay in their respective files.

### 3. `ticker-search.js` initializes after nav renders
`nav.js` creates the search input, then calls `initTickerSearch()`. The search module exports an init function rather than auto-running on DOMContentLoaded.

### 4. Market status + marquee init after nav mount
Same pattern — `nav.js` renders the elements, then kicks off `initMarketStatus()` and marquee rendering.

## Risks / Trade-offs

- [Flash of no-nav on slow connections] → Nav.js is small (<5KB), loads fast; mount div can have min-height to prevent layout shift
- [Breaking existing page-specific nav tweaks] → Audit all 3 files for nav differences before extracting; parameterize if needed
- [Script load order] → nav.js must load before ticker-search.js and market-status.js; use `defer` ordering in HTML
