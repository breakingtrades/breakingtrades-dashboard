# Tasks: Data Pipeline

> **Updated 2026-03-18.** Original spec was for a single monolithic `export-dashboard-data.py`. Reality evolved into multiple focused scripts + a CI-first architecture. Tasks updated to reflect shipped vs remaining work.

## ✅ SHIPPED — Signal Computation (Task 3 equivalent)
- `scripts/export-dashboard-data.py` — reads IB CSVs, computes SMA 20/50/200, weekly SMA 20, bias, % change
- `scripts/export-yfinance-fallback.py` — same computations from yfinance when IB data is stale
- Outputs: `data/watchlist.json` (67 tickers)

## ✅ SHIPPED — Pair Ratio Engine (Task 5 equivalent)
- 12 pair ratios computed in both `export-dashboard-data.py` (IB) and `export-yfinance-fallback.py` (yfinance)
- Trend classification: RISING/FALLING/FLAT based on SMA20 comparison + 1-week change
- Outputs: `data/pairs.json`

## ✅ SHIPPED — Macro/VIX (Task 6 equivalent)
- VIX current + SMA 20/50 + 30d percentile + regime classification
- Outputs: `data/vix.json`
- Fear & Greed: CNN API with VIX-based approximation fallback
- Outputs: `data/fear-greed.json`

## ✅ SHIPPED — Sector Rotation (not in original spec)
- `scripts/export-sector-rotation.py` — RS + momentum with 26-week trail for 11 GICS sectors vs SPY
- `export-yfinance-fallback.py` — same computation from yfinance
- Sector risk map derived from quadrant position
- Outputs: `data/sector-rotation.json`, `data/sector-risk.json`

## ✅ SHIPPED — Tom Briefing Generation (Task 7 partial)
- `scripts/generate-briefing.py` — GPT-4.1 via GitHub Models API with Tom's full persona
- Reads all dashboard data files, generates daily briefing
- Outputs: `data/briefing.json`
- Tom agent files in `agents/tom-fxevolution/` for CI access

## ✅ SHIPPED — CI Pipeline (Task 8 equivalent)
- `.github/workflows/daily-briefing.yml` — Mon-Fri 6:30 AM ET + manual
- Freshness check → yfinance fallback → briefing generation → commit + push
- Single secret: `GH_PAT`

## ❌ NOT STARTED — Trade Lifecycle Classifier (Task 4)
- [ ] 9-state lifecycle: WATCHING → APPROACHING → RETEST → TRIGGERED → ACTIVE → EXIT_SIGNAL → STOPPED → DORMANT
- [ ] Retest detection with confidence scoring + volume health
- [ ] Confluence zone detection (multiple MAs within 2-3%)
- [ ] Status-based sorting and grouping (Hot, Active, Alerts, Watching, Inactive)
- **Depends on:** Defining lifecycle rules in `docs/TRADE_LIFECYCLE.md`
- **Priority:** Medium — cards currently show status from watchlist metadata

## ❌ NOT STARTED — Per-Ticker Tom's Take (Task 7 remainder)
- [ ] Per-ticker LLM analysis: `data/tom/takes/{TICKER}.json`
- [ ] Schema: `{ symbol, take, action, key_level, confidence, bias, signals[], suggested_questions[] }`
- [ ] Rate limiting, caching, incremental updates
- **Priority:** Low — blocked on Tom Chat widget (see `openspec/changes/tom-chat/`)

## ❌ NOT STARTED — Mac Cron Push (supplementary)
- [ ] macOS cron at 4:30 PM ET Mon-Fri: start IB Gateway if needed, run `export-dashboard-data.py`, git push
- [ ] Enriched IB data: expected moves, dark pool flows (not available from yfinance)
- **Priority:** Medium — CI covers daily needs; Mac adds premium data when available
