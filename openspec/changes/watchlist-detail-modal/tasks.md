# Tasks: Watchlist Ticker Detail Modal

## Task 1: Enrich export scripts with computed technicals
- [ ] Add to `export-yfinance-fallback.py`: RSI-14, ATR-14, ATR%, volume, volumeAvg20, volumeRatio
- [ ] Add 52-week high/low, pctFrom52wHigh
- [ ] Add Bollinger Band width + 6-month percentile
- [ ] Add SMA crossover detection (golden/death/compression) with approximate date
- [ ] Add next earnings date from yfinance `.info` field
- [ ] Mirror same fields in `export-dashboard-data.py` (IB source)
- [ ] Test: run export, verify new fields in `data/watchlist.json`
- **Estimate:** 1.5 hours

## Task 2: Modal HTML/CSS in watchlist.html
- [ ] Add modal overlay + modal container (reuse Signals page styling patterns)
- [ ] Header: ticker, name, sector, price, change, bias badge, sector risk badge
- [ ] Chart row: two TradingView Advanced Chart containers (daily + weekly), 400px each
- [ ] Info row: TA gauge widget + Key Levels card + Volatility card
- [ ] Technical Signals section (auto-generated bullet list)
- [ ] Tom's Take placeholder (hidden until data exists)
- [ ] Close button + Escape key + overlay click to close
- [ ] Mobile: stack charts vertically, reduce heights
- **Estimate:** 2 hours

## Task 3: TradingView widget embedding
- [ ] Advanced Chart widget with `calendar: true` (earnings markers on timeline)
- [ ] SMA 20 + SMA 50 studies overlay
- [ ] Dark theme matching dashboard (`toolbar_bg: #0a0a0f`)
- [ ] Timezone from `tz-picker` selection
- [ ] Exchange prefix resolution (NASDAQ:AAPL, NYSE:XLE, etc.)
- [ ] Technical Analysis gauge widget (buy/sell/neutral)
- [ ] Lazy load: only create widgets when modal opens, destroy on close
- **Estimate:** 1 hour

## Task 4: Technical Signals auto-generation
- [ ] `generateSignals(ticker)` function — returns array of signal strings
- [ ] Priority sorting: earnings warning > overbought/oversold > crossover > squeeze > volume > distance
- [ ] Max 6 signals displayed
- [ ] Color coding: warnings in red/orange, bullish in cyan, neutral in dim
- **Estimate:** 45 min

## Task 5: Wire up click handlers
- [ ] Widget view: onclick on TradingView's ticker list rows (if possible via widget API, else overlay)
- [ ] Table view: onclick on table rows
- [ ] Both call `openDetail(symbol)`
- [ ] URL hash support: `#detail=AAPL` opens modal on load (shareable)
- **Estimate:** 30 min

## Task 6: Test and polish
- [ ] Test all 70 tickers open correctly
- [ ] Verify earnings "E" markers show on charts
- [ ] Verify signals generate correctly for edge cases (no earnings, missing data)
- [ ] Check mobile layout
- [ ] Performance: ensure widget cleanup on modal close (no iframe leaks)
- **Estimate:** 45 min

## Execution Order
1 → 2 → 3 → 4 → 5 → 6

## Total Estimate: ~6.5 hours
