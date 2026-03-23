# BreakingTrades Dashboard — OpenSpec Index

> Last updated: 2026-03-23

## Shipped Changes

| Change | Date | Commits | Description |
|--------|------|---------|-------------|
| [EM Watchlist Filter + Top 10 S&P](changes/expected-moves/proposal.md) | 2026-03-23 | `16eb624` | Filter tabs (All / Top 10 S&P / Watchlist) + Bias column (▲ BULL / ▼ BEAR + ↑↓200 SMA) on expected-moves.html |
| [IB Gateway TOTP Automation](changes/ib-gateway-totp/) | 2026-03-23 | — | Fully unattended IB Gateway login: Keychain TOTP secret + `totp-helper.sh` + `start-gateway.sh`; live account `idansh235`, port 4002 |
| [Market Data Refresh](changes/expected-moves/proposal.md) | 2026-03-23 | `237df55` | EM 55/72 tickers via IB live, F&G 16.1 (Extreme Fear), sector rotation + watchlist refresh |
| [generate-brief.py Cron](changes/ci-data-pipeline/proposal.md) | 2026-03-23 | — | `*/30 * * * *` cron added; stale `hourly-brief.sh` cron removed |
| [Event Calendar](changes/event-calendar/proposal.md) | 2026-03-22 | `d2f8d8c`..`d1f34ec` | `events.html` full calendar page + `events.js` renderer + mini strip on index + `events.jsonl` store + `bt-event` CLI + `trump-monitor.py` (Google News RSS → LLM classify) + `extract-events.py` (video + brief extraction). Tests pending. |
| [Expected Moves](changes/expected-moves/proposal.md) | 2026-03-20 | `c9e8957`..`3b8b053` | EM page with risk model, watchlist banner, staleness guard + staleness tests |
| [Futures Strip](changes/futures-strip/proposal.md) | 2026-03-19 | — | Pre-market futures/macro data strip (14 instruments, 5 groups) |
| [Ticker Search](changes/ticker-search/proposal.md) | 2026-03-19 | — | Global search bar with tracked (enriched) vs external (TradingView) routing |
| [Logo & Branding](changes/logo-branding/proposal.md) | 2026-03-19 | — | Inline SVG logo mark in nav bar |
| [CI Data Pipeline](changes/ci-data-pipeline/proposal.md) | 2026-03-18 | `a03bc1d` | Self-sustained yfinance fallback + GitHub Models briefing |
| [Market Status Indicator](changes/market-status-indicator/proposal.md) | 2026-03-18 | `44f01b5`, `501b559` | Real-time open/closed/pre/after with holidays |
| [Sector Rotation Chart](changes/sector-rotation-chart/OPENSPEC.md) | 2026-03-18 | `44fa968` | RRG chart + sector risk badges (4 phases) |

## Active Changes (in progress)

| Change | Status | Description |
|--------|--------|-------------|
| [AI-Ready Architecture](changes/ai-ready-architecture/) | **Proposed** | Tom agent multi-channel output: alerts, ticker notes, market pulse, feed panel |
| [Watchlist Detail Modal](changes/watchlist-detail-modal/) | ✅ Shipped | Click ticker → TradingView charts + computed technicals + earnings markers |
| [Data Pipeline](changes/data-pipeline/) | Partial | Core signals shipped; lifecycle classifier + per-ticker Tom pending |
| [Dashboard UI](changes/dashboard-ui/) | Partial | Card variants + filters shipped; detail modal + responsive pending |
| [Watchlist Page](changes/watchlist-page/) | Shipped | Widget + table views, TradingView embed |
| [Market Page](changes/market-page/) | Shipped | Heatmap, RRG, F&G, VIX, pairs, sector rankings |

## Planned Changes (not started)

| Change | Priority | Description |
|--------|----------|-------------|
| [Earnings Calendar](changes/earnings-calendar/) | High | Dedicated earnings tool — EarningsWhisper (primary, whisper numbers + surprise history), TradingView (secondary), possibly Finviz/Nasdaq as fallback. Shows upcoming earnings for watchlist + broader market, EPS estimates vs actuals, surprise %, reaction moves. Full page + mini strip integration. Future: auto-tag ticker cards with earnings proximity. |
| EM Daily Cron | High | 4:05 PM ET Mon-Fri cron → `update-expected-moves-ib.py` → git commit + push |
| EM History Sparkline | Medium | Per-ticker mini sparkline of historical EM values on expected-moves.html |
| EM Columns on Watchlist | Medium | Compact weekly EM% + position in range columns on watchlist table |
| [Tom Chat Widget](changes/tom-chat/) | Low | Interactive chat — deferred to Phase 3 of AI-Ready Architecture |
| Trade Lifecycle Engine | Medium | 9-state status classifier for ticker cards |
| Per-Ticker Tom's Take | Low | Pre-generated LLM analysis per symbol |
| Event Calendar — Phase 2 | Medium | Bolt-on FastAPI route in market-watcher; external calendar API polling (FRED releases, macro data). Drop-in URL swap. |

## Archived

| Change | Date | Description |
|--------|------|-------------|
| [Watchlist Engine](changes/archive/2026-03-17-watchlist-engine/) | 2026-03-17 | Initial watchlist data + export |
| [Dashboard Frontend](changes/archive/2026-03-17-dashboard-frontend/) | 2026-03-17 | Initial 3-page dashboard build |
| [Tom Agent](changes/archive/2026-03-17-tom-agent/) | 2026-03-17 | Tom persona files + rules |

## Shipped Changes

| Change | Date | Commits | Description |
|--------|------|---------|-------------|
| [Event Calendar](changes/event-calendar/proposal.md) | 2026-03-22 | `d2f8d8c`..`d1f34ec` | `events.html` full calendar page + `events.js` renderer + mini strip on index + `events.jsonl` store + `bt-event` CLI + `trump-monitor.py` (Google News RSS → LLM classify) + `extract-events.py` (video + brief extraction). Tests pending. |
| [Expected Moves](changes/expected-moves/proposal.md) | 2026-03-20 | `c9e8957`..`b5a8cee` | EM page with risk model, watchlist banner, staleness guard |
| [Futures Strip](changes/futures-strip/proposal.md) | 2026-03-19 | — | Pre-market futures/macro data strip (14 instruments, 5 groups) |
| [Ticker Search](changes/ticker-search/proposal.md) | 2026-03-19 | — | Global search bar with tracked (enriched) vs external (TradingView) routing |
| [Logo & Branding](changes/logo-branding/proposal.md) | 2026-03-19 | — | Inline SVG logo mark in nav bar |
| [CI Data Pipeline](changes/ci-data-pipeline/proposal.md) | 2026-03-18 | `a03bc1d` | Self-sustained yfinance fallback + GitHub Models briefing |
| [Market Status Indicator](changes/market-status-indicator/proposal.md) | 2026-03-18 | `44f01b5`, `501b559` | Real-time open/closed/pre/after with holidays |
| [Sector Rotation Chart](changes/sector-rotation-chart/OPENSPEC.md) | 2026-03-18 | `44fa968` | RRG chart + sector risk badges (4 phases) |

## Active Changes (in progress)

| Change | Status | Description |
|--------|--------|-------------|
| [AI-Ready Architecture](changes/ai-ready-architecture/) | **Proposed** | Tom agent multi-channel output: alerts, ticker notes, market pulse, feed panel |
| [Watchlist Detail Modal](changes/watchlist-detail-modal/) | ✅ Shipped | Click ticker → TradingView charts + computed technicals + earnings markers |
| [Data Pipeline](changes/data-pipeline/) | Partial | Core signals shipped; lifecycle classifier + per-ticker Tom pending |
| [Dashboard UI](changes/dashboard-ui/) | Partial | Card variants + filters shipped; detail modal + responsive pending |
| [Watchlist Page](changes/watchlist-page/) | Shipped | Widget + table views, TradingView embed |
| [Market Page](changes/market-page/) | Shipped | Heatmap, RRG, F&G, VIX, pairs, sector rankings |

## Planned Changes (not started)

| Change | Priority | Description |
|--------|----------|-------------|
| [Earnings Calendar](changes/earnings-calendar/) | High | Dedicated earnings tool — EarningsWhisper (primary, whisper numbers + surprise history), TradingView (secondary), possibly Finviz/Nasdaq as fallback. Shows upcoming earnings for watchlist + broader market, EPS estimates vs actuals, surprise %, reaction moves. Full page + mini strip integration. Future: auto-tag ticker cards with earnings proximity. |
| [Tom Chat Widget](changes/tom-chat/) | Low | Interactive chat — deferred to Phase 3 of AI-Ready Architecture |
| Mac Cron Push | Medium | IB Gateway data enrichment (expected moves, dark pool) |
| Trade Lifecycle Engine | Medium | 9-state status classifier for ticker cards |
| Per-Ticker Tom's Take | Low | Pre-generated LLM analysis per symbol |
| Event Calendar — Phase 2 | Medium | Bolt-on FastAPI route in market-watcher; external calendar API polling (FRED releases, macro data). Drop-in URL swap. |

## Archived

| Change | Date | Description |
|--------|------|-------------|
| [Watchlist Engine](changes/archive/2026-03-17-watchlist-engine/) | 2026-03-17 | Initial watchlist data + export |
| [Dashboard Frontend](changes/archive/2026-03-17-dashboard-frontend/) | 2026-03-17 | Initial 3-page dashboard build |
| [Tom Agent](changes/archive/2026-03-17-tom-agent/) | 2026-03-17 | Tom persona files + rules |
