# Tasks: Dashboard Frontend

## Task 1: Project Scaffolding
- [ ] Create `src/` directory structure (html, css/, js/, assets/)
- [ ] Create `css/tokens.css` with all design system variables
- [ ] Create base HTML templates with meta tags, favicon placeholder
- [ ] Set up GitHub Pages deployment config
- **Estimate:** 30 min

## Task 2: Layout & Design System CSS
- [ ] Implement `css/layout.css` — grid system, sidebar, responsive breakpoints
- [ ] Implement `css/components.css` — cards, badges, range bars, level strips
- [ ] Implement `css/tradingview.css` — widget container overrides
- [ ] Add `fadeInUp` animation and hover transitions
- [ ] Verify responsive layout at all breakpoints
- **Estimate:** 2-3 hours

## Task 3: Watchlist Grid Page (`index.html`)
- [ ] Implement data fetch from `data/output/watchlist.json`
- [ ] Render watchlist cards grouped by section
- [ ] Add bias badge color coding (Bull/Bear/Mixed)
- [ ] Implement sort controls (bias, RSI, change %, alpha)
- [ ] Implement filter controls (section, bias)
- [ ] Add ticker tape widget at top
- [ ] Click card → navigate to `ticker.html?s=TICKER`
- **Estimate:** 3-4 hours

## Task 4: Ticker Detail Page (`ticker.html`)
- [ ] Parse `?s=TICKER` query parameter
- [ ] Render sidebar with ticker info, bias badge, section nav
- [ ] Render key levels strip (EMA 8/21/50, 6M High/Low, Price)
- [ ] Render EMA alignment status with colored dots
- [ ] Initialize TradingView Advanced Chart — Daily (full width, 600px height)
- [ ] Initialize TradingView Advanced Chart — 4H (full width, 600px height)
- [ ] Initialize TradingView Technical Analysis gauge
- [ ] Initialize TradingView Symbol Overview widget
- [ ] Render trade setup card with range bar visualization
- [ ] Render setup stats grid (Entry, Stop, Target, R:R)
- [ ] Add ticker tape widget at top
- **Estimate:** 4-5 hours

## Task 5: TradingView Integration (`js/tradingview.js`)
- [ ] Create widget factory functions for each widget type
- [ ] Dynamic symbol injection from data
- [ ] Dark theme configuration with custom background colors
- [ ] EMA study overlays (8, 21, 50) on charts
- [ ] Handle widget loading states (skeleton/placeholder)
- **Estimate:** 2 hours

## Task 6: Utility Functions (`js/utils.js`)
- [ ] Price formatter ($ with 2 decimals)
- [ ] Percentage formatter (with + sign for positive)
- [ ] Bias color mapper
- [ ] Date formatter for "Generated at" timestamps
- [ ] Section name normalizer
- **Estimate:** 30 min

## Task 7: GitHub Pages Deployment
- [ ] Create `.github/workflows/deploy.yml` for GitHub Pages
- [ ] Configure `src/` as the publish directory
- [ ] Add `404.html` redirect for client-side routing
- [ ] Test deploy with sample data
- **Estimate:** 30 min

## Task 8: Testing & Polish
- [ ] Test all TradingView widgets load correctly
- [ ] Test responsive layout at 1440, 1024, 768, 375 breakpoints
- [ ] Run Lighthouse audit, target > 80 accessibility
- [ ] Cross-browser test (Chrome, Firefox, Safari)
- [ ] Verify data fetch works with relative paths on GitHub Pages
- **Estimate:** 1-2 hours

## Execution Order
1 → 2 → 6 → 3 → 5 → 4 → 7 → 8

## Total Estimate: 14-18 hours
