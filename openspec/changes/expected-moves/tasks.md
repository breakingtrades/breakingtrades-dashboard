## Tasks

### ✅ Done

- [x] Create `scripts/update-expected-moves-ib.py` — IB Gateway EM calculator (8/8 daily tier)
- [x] Create `scripts/update-expected-moves.py` — Polygon.io backup EM calculator
- [x] Generate `data/expected-moves.json` with daily tier for 8 tickers
- [x] Add EM banner to watchlist detail modal (`buildExpectedMoveHTML()`)
- [x] Load EM data async (`loadExpectedMoves()`)
- [x] Create `expected-moves.html` with full EM table, risk model, stats
- [x] Add tier tabs (Daily/Weekly/Monthly/Quarterly)
- [x] Implement risk color scale (green→red filled bar)
- [x] Add alert tags (AT SUPPORT, NEAR LOW, BELOW EM, AT CEILING, ABOVE EM)
- [x] Add row highlighting for buy-zone and extended tickers
- [x] Add to shared nav (`js/nav.js` PAGES array)
- [x] Switch watchlist default to Table view (Widget hijacks clicks)
- [x] Add `#SYMBOL` hash routing (was `?ticker=`)
- [x] Fix watchlist table-view display:none CSS bug
- [x] OpenSpec documentation (proposal, design, specs, tasks)
- [x] Add tests to `test-nav.html`
- [x] Update EM data with IV + yfinance Friday close reference (Mar 20)
- [x] Stale data warning banner → replaced with silent `console.warn` + subtle timestamp color
- [x] Staleness guard tests — validate freshness, close prices, range validity, position computation
- [x] Filter tabs — All / Indices / Top 10 S&P / Watchlist (`currentFilter` state)
- [x] Bias column — ▲ BULL / ▼ BEAR from watchlist + ↑↓200 SMA indicator
- [x] IB Gateway TOTP fully automated (`totp-helper.sh` + Keychain + `start-gateway.sh`)
- [x] Full market data refresh via IB live — 55/72 tickers, F&G 16.1, sector rotation (Mar 23)
- [x] Fix filter/tier tab conflict — scope event listeners to `[data-tier]` / `[data-filter]` attributes
- [x] Fix filter tab style — use `tier-tab` class to match dashboard design system
- [x] Ticker row click opens watchlist detail in new tab (`window.open(..., '_blank')`)
- [x] Add `.nojekyll` — fix GitHub Pages Jekyll build failures
- [x] Add tests for filter tab logic (Indices, Top10, Watchlist, All)

### ⬜ Pending

- [ ] Set up daily Mac cron: 4:05 PM ET Mon-Fri → run IB EM script → git commit → push
- [ ] Run full weekly EM tier for all ~70 watchlist tickers
- [ ] Run quarterly EM tier for 14 index/mega-cap tickers
- [ ] Add EM history sparkline to table (52-week EM % trend)
- [ ] Add EM data to watchlist table columns (compact view)
