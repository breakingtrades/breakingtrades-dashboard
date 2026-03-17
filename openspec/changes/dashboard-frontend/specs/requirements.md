# Requirements: Dashboard Frontend

## Functional Requirements

### FR-1: Watchlist Grid View
- FR-1.1: Fetch and parse `data/output/watchlist.json` on page load
- FR-1.2: Display symbols in a responsive grid of compact cards
- FR-1.3: Each card shows: ticker, name, price, change %, EMA bias badge, RSI gauge
- FR-1.4: Cards grouped by section (Quality Stocks, Community Trades, Pending Setups, Sectors)
- FR-1.5: Clicking a card navigates to the ticker detail page
- FR-1.6: Sort by: bias, RSI, change %, alphabetical
- FR-1.7: Filter by: section, bias (Bullish/Bearish/Mixed)

### FR-2: Ticker Detail Page
- FR-2.1: Display ticker name, exchange, sector, bias badge, price with live dot
- FR-2.2: Sidebar navigation with anchor links to page sections
- FR-2.3: Key levels strip: EMA 8, EMA 21, EMA 50, 6M High, 6M Low, Current Price
- FR-2.4: EMA alignment status with colored dots and connector visualization
- FR-2.5: TradingView Advanced Chart — Daily timeframe (full width, 600px min height)
- FR-2.6: TradingView Advanced Chart — 4H timeframe (full width, 600px min height)
- FR-2.7: TradingView Technical Analysis gauge widget
- FR-2.8: TradingView Symbol Overview widget
- FR-2.9: Trade setup card with range bar (stop → entry → targets) and R:R stats
- FR-2.10: Sector comparison chart (symbol vs sector ETF)

### FR-3: TradingView Widgets (Free Embeds Only)
- FR-3.1: Ticker tape at top of page (fixed position, all pages)
- FR-3.2: Advanced Chart with dark theme, EMA overlays (8, 21, 50), volume
- FR-3.3: Technical Analysis gauge (interval: daily)
- FR-3.4: Symbol Overview for quick reference
- FR-3.5: Mini charts on watchlist cards (Symbol Overview widget, compact mode)
- FR-3.6: All widgets use `colorTheme: "dark"` and `isTransparent: true`

### FR-4: Macro Context Panel
- FR-4.1: Display key macro indicators: SPY, QQQ, VIX, DXY, US10Y, US02Y
- FR-4.2: Show trend direction with colored arrows
- FR-4.3: TradingView ticker tape with macro symbols

### FR-5: Navigation & Layout
- FR-5.1: Fixed sidebar (desktop) with logo, ticker info, section links
- FR-5.2: Sidebar collapses on mobile (< 1024px)
- FR-5.3: Smooth scroll between sections
- FR-5.4: Breadcrumb: Home → Watchlist → Ticker

### FR-6: GitHub Pages Deployment
- FR-6.1: All files served as static assets (no server-side rendering)
- FR-6.2: Relative paths for all assets and data files
- FR-6.3: 404.html fallback for client-side routing

## Non-Functional Requirements

- **NFR-1:** First contentful paint < 1.5 seconds
- **NFR-2:** No build step — vanilla HTML/CSS/JS, no bundler
- **NFR-3:** Dark theme only — all UI elements use design system tokens
- **NFR-4:** Responsive breakpoints: 1440px (desktop), 1024px (tablet), 375px (mobile)
- **NFR-5:** Semantic HTML, ARIA labels on interactive elements
- **NFR-6:** Works in Chrome, Firefox, Safari, Edge (latest versions)
- **NFR-7:** No external CSS frameworks — custom CSS with CSS variables

## Dependencies

- `data/output/watchlist.json` and `setups.json` from watchlist-engine
- TradingView widget embed scripts (loaded from `s3.tradingview.com`)
- Design tokens from `docs/DESIGN_SYSTEM.md`
