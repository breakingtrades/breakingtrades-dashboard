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
- [x] Stale data warning banner (>48h shows red warning, >24h shows orange age)
- [x] Staleness guard tests — validate freshness, close prices, range validity, position computation

### ⬜ Pending

- [ ] Set up daily Mac cron: 4:05 PM ET Mon-Fri → run IB EM script → git commit → push
- [ ] Run full weekly EM tier for all ~70 watchlist tickers
- [ ] Run quarterly EM tier for 14 index/mega-cap tickers
- [ ] IB Gateway auto-restart before cron (or integrate into cron)
- [ ] Add EM history sparkline to table (52-week EM % trend)
- [ ] Add EM data to watchlist table columns (compact view)
