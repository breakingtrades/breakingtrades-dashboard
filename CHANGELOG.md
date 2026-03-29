# BreakingTrades Dashboard — Changelog

All notable changes to this project are documented here.
Format: `[YYYY-MM-DD] commit — description`

---

## 2026-03-29

### Fixes
- **`d97aee7`** — Expected Moves: canonical price source fix. IB `reqMktData.close` returns previous session's close after hours (Thursday's price on Saturday night). EM script now reads close from `prices.json` → `watchlist.json` (source of truth), falls back to IB `reqHistoricalData` → IB market data. Straddle prices still from IB (correct — option-specific). 45 tickers corrected from Thursday → Friday close. Script also prints price source (`prices`/`ib-hist`/`ib-mkt`) for debugging.

### Data
- **`562aeb8`** — EM update: 60 tickers, all 4 tiers (D/W/M/Q) refreshed via IB Gateway
- Full EOD pipeline run: prices (74), futures, F&G, VIX, watchlist, sectors, EM, briefing

---

## 2026-03-25

### Features
- **`a95bbc5`** — EOD Update Pipeline: `eod-update.sh` — single runner for F&G + VIX + sector rotation + expected moves + yfinance fallback. GitHub Action Mon-Fri 4:20 PM ET with auto-push. Friday runs all EM tiers (weekly/monthly/quarterly), Mon-Thu daily only. Local Mac cron fallback. Handles rebase conflicts from concurrent GH Action pushes.

### Fixes
- **`efd6d26`** — Expected Moves: `history[-52]` → `history[-52:]` — slice not index bug

### Docs
- **`c2360d2`** — OpenSpec INDEX: full production snapshot — all shipped changes, production pages/pipeline inventory, status marked as production

---

## 2026-03-24

### Features
- **`23c7258`** — Root URL (`/`) now redirects to `market.html`; Signals page moved to `signals.html`
- **`5cef627`** — Expected Moves: inline detail modal — TradingView chart + all 4 EM tier cards; works for all tickers (USO, GLD, IBIT, BRK B etc.); Escape to close
- **`8b4cd51`** — Nav: Market page moved to first position; logo + default landing → `market.html`

### Fixes
- **`012c36a`** — Expected Moves: filter tabs (All/Top 10 S&P/Watchlist) now match `tier-tab` style; both tab rows on one line; removed emoji
- **`89eff9d`** — Signals page: F&G now fetches from `data/fear-greed.json` (was hardcoded value)
- **`18ed114`** — Added `.nojekyll` — bypasses Jekyll build; fixes Pages deploy failures caused by `node_modules` Liquid syntax errors

---

## 2026-03-23

### Features
- **`5c24f70`** — Expected Moves: remove stale data UI banner; log to `console.warn` only; timestamp turns red/orange subtly
- **`16eb624`** — Expected Moves: filter tabs (All / 🏆 Top 10 S&P / Watchlist) + Bias column (▲ BULL / ▼ BEAR + ↑↓200 SMA indicator)
- **`237df55`** — Market data refresh: EM 55/72 tickers via IB live account, F&G 16.1 (Extreme Fear), sector rotation all 12 sectors, watchlist prices

### Infrastructure
- **IB Gateway TOTP automation**: `totp-helper.sh` + macOS Keychain secret (`ibkr-totp-secret`) + `start-gateway.sh` — fully unattended login, live account `idansh235`, port 4002
- **Cron**: `generate-brief.py` added every 30 min; stale `hourly-brief.sh` cron removed

### Docs
- **`0fd58d6`** — OpenSpec INDEX updated with all Mar 23 shipped work
- **`3b8b053`** — (prior) Staleness guard tests + stale data warning in `test-nav.html`

---

## 2026-03-22

### Features
- **`d1f34ec`** — Event Calendar: `events.html` full calendar page, `events.js` renderer, mini strip on index, `bt-event` CLI, `trump-monitor.py` (Google News RSS → LLM classify), `extract-events.py` (video + brief extraction)

---

## 2026-03-20

### Features
- **`b5a8cee`** — Expected Moves page: risk model, watchlist position banner, staleness guard, tier tabs (Daily/Weekly/Monthly/Quarterly), alert tags, risk color scale

---

## 2026-03-19

### Features
- **`c9e8957`** — Futures strip: pre-market futures/macro data strip (14 instruments, 5 groups)
- Ticker search: global search bar with tracked vs external (TradingView) routing
- Logo & Branding: inline SVG logo mark in nav bar

---

## 2026-03-18

### Features
- **`a03bc1d`** — CI Data Pipeline: self-sustained yfinance fallback + GitHub Models briefing
- **`501b559`** — Market Status Indicator: real-time open/closed/pre/after-hours with holidays
- **`44fa968`** — Sector Rotation Chart: RRG chart + sector risk badges (4 phases)

---

## 2026-03-17

### Initial Release
- Watchlist Engine: initial watchlist data + export pipeline
- Dashboard Frontend: 3-page dashboard (index, watchlist, market)
- Tom Agent: persona files + rules + training pipeline scaffold
