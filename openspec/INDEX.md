# BreakingTrades Dashboard — OpenSpec Index

> Last updated: 2026-03-29
> Status: **Production** — live at https://breakingtrades.github.io/breakingtrades-dashboard/
> Running smoothly as of Mar 27 2026.

## Production Pages

| Page | File | Description |
|------|------|-------------|
| **Market** (landing) | `market.html` | Sector heatmap, RRG, Fear & Greed gauge, VIX strip, pair ratios, sector rankings |
| **Signals** | `signals.html` | Trade setup cards with lifecycle tracking, detail modals + TradingView charts |
| **Watchlist** | `watchlist.html` | 74-symbol tracker, table view, detail modals, EM banner, hash routing (`#SPY`) |
| **Expected Moves** | `expected-moves.html` | Options EM risk heatmap, position bars, alert tags, staleness guard, filter/tier tabs, inline detail modal |
| **Events** | `events.html` | Calendar page + `events.js` renderer, mini strip on index, `bt-event` CLI |
| **Sector Rotation** | `sector-rotation.html` | RRG chart entry point |

## Production Data Pipeline

| Component | Schedule | Description |
|-----------|----------|-------------|
| **Canonical Prices** | 4× daily (9:30/12/3/4:05 ET) + EOD | `update-prices.py` → `data/prices.json` — single source of truth for all ticker prices. `bt-prices.js` shared module consumed by all pages. |
| **Futures Strip** | 4× daily (9:30/12/3/4:05 ET) + EOD | `update_futures.py` → `data/futures.json` — 14 instruments (ES, NQ, RTY, YM, CL, NG, GC, SI, HG, TNX, DXY, VIX, BTC, ETH) |
| **Fear & Greed** | ~Hourly cron | `update-fear-greed.py` → `data/fear-greed.json` |
| **VIX** | 4× daily (9:30/12/3/4:05 ET) | `update-vix.py` → `data/vix.json` |
| **Sector Rotation** | On demand / EOD | `export-sector-rotation.py` → `data/sector-rotation.json` + `data/sector-risk.json` |
| **Expected Moves** | EOD 4:20 PM ET (GH Action) + local fallback | `update-expected-moves.py` — IB Gateway first, yfinance fallback (Polygon removed). `--source auto/ib/yfinance`. `BT_EM_SOURCE` env var for CI/containers. → `data/expected-moves.json` |
| **EOD Pipeline** | Mon-Fri 4:20 PM ET | `eod-update.sh` — single runner: F&G + VIX + sector rotation + EM + yfinance fallback. Fri runs all EM tiers (weekly/monthly/quarterly), Mon-Thu daily tier only (8 proxies). GH Action uses yfinance (no IB in CI). Local Mac cron tries IB first. |
| **Daily Briefing** | Every 30 min | `generate-briefing.py` → `data/briefs/` |
| **Dashboard Export** | On demand | `export-dashboard-data.py` — bridge from parent data CSVs → dashboard JSON |
| **Trump Monitor** | On demand | `trump-monitor.py` — Google News RSS → LLM classify → `events.jsonl` |

## Shipped Changes (Chronological)

| Change | Date | Commits | Description |
|--------|------|---------|-------------|
| [Watchlist Engine](changes/archive/2026-03-17-watchlist-engine/) | 2026-03-17 | — | Initial watchlist data + export pipeline |
| [Dashboard Frontend](changes/archive/2026-03-17-dashboard-frontend/) | 2026-03-17 | — | Initial 3-page dashboard build |
| [Tom Agent](changes/archive/2026-03-17-tom-agent/) | 2026-03-17 | — | Tom persona files + rules |
| [CI Data Pipeline](changes/ci-data-pipeline/proposal.md) | 2026-03-18 | `a03bc1d` | Self-sustained yfinance fallback + GitHub Models briefing |
| [Market Status Indicator](changes/market-status-indicator/proposal.md) | 2026-03-18 | `44f01b5`, `501b559` | Real-time open/closed/pre/after with holidays |
| [Sector Rotation Chart](changes/sector-rotation-chart/OPENSPEC.md) | 2026-03-18 | `44fa968` | RRG chart + sector risk badges (4 phases) |
| [Logo & Branding](changes/logo-branding/proposal.md) | 2026-03-19 | — | Inline SVG logo mark in nav bar |
| [Ticker Search](changes/ticker-search/proposal.md) | 2026-03-19 | — | Global search bar with tracked (enriched) vs external (TradingView) routing |
| [Futures Strip](changes/futures-strip/proposal.md) | 2026-03-19 | — | Pre-market futures/macro data strip (14 instruments, 5 groups) |
| [Shared Nav Component](changes/shared-nav-component/) | 2026-03-20 | — | Nav bar, ticker search, market status, timezone picker — shared across all pages |
| [Expected Moves](changes/expected-moves/proposal.md) | 2026-03-20 | `c9e8957`..`3b8b053` | EM page with risk model, watchlist banner, staleness guard + staleness tests |
| [Watchlist Page](changes/watchlist-page/) | 2026-03-20 | — | Widget + table views, TradingView embed, detail modals |
| [Market Page](changes/market-page/) | 2026-03-20 | — | Heatmap, RRG, F&G, VIX, pairs, sector rankings |
| [Event Calendar](changes/event-calendar/proposal.md) | 2026-03-22 | `d2f8d8c`..`d1f34ec` | `events.html` full calendar page + `events.js` renderer + mini strip on index + `events.jsonl` store + `bt-event` CLI + `trump-monitor.py` + `extract-events.py` |
| [IB Gateway TOTP Automation](changes/expected-moves/) | 2026-03-23 | — | Fully unattended IB Gateway login: Keychain TOTP secret + `totp-helper.sh` + `start-gateway.sh`; live account `idansh235`, port 4002 |
| [EM Watchlist Filter + Top 10 S&P + Bias](changes/expected-moves/) | 2026-03-23 | `16eb624` | Filter tabs (All / Top 10 S&P / Watchlist) + Bias column (▲ BULL / ▼ BEAR + ↑↓200 SMA) |
| [Market Data Refresh](changes/expected-moves/) | 2026-03-23 | `237df55` | EM 55/72 tickers via IB live, F&G 16.1 (Extreme Fear), sector rotation + watchlist refresh |
| [generate-brief.py Cron](changes/ci-data-pipeline/) | 2026-03-23 | — | `*/30 * * * *` cron added; stale `hourly-brief.sh` cron removed |
| [.nojekyll Fix](changes/ci-data-pipeline/) | 2026-03-24 | `18ed114` | Added `.nojekyll` — bypasses Jekyll build, fixes Pages deploy failures from `node_modules` Liquid syntax |
| [Signals Page F&G Fix](changes/ci-data-pipeline/) | 2026-03-24 | `89eff9d` | Signals page F&G now fetches from `data/fear-greed.json` (was hardcoded) |
| [EM Filter Tab Style Fix](changes/expected-moves/) | 2026-03-24 | `012c36a` | Filter tabs match `tier-tab` style; both tab rows on one line; removed emoji |
| [EM Indices Filter](changes/expected-moves/) | 2026-03-24 | `ead37d4` | Indices filter tab (SPY, QQQ, IWM, DIA, TLT, HYG, LQD, GLD, USO, UNG, IBIT) |
| [EM Detail Modal](changes/expected-moves/) | 2026-03-24 | `5cef627` | Inline detail modal on EM page — TradingView chart + all 4 EM tier cards; works for all tickers incl. USO/GLD/IBIT; Escape to close |
| [EM Filter Tab Tests](changes/expected-moves/) | 2026-03-24 | `7b81db0` | Filter tab logic tests — Indices/Top10/Watchlist/All + mutual exclusivity |
| [Nav — Market First](changes/dashboard-ui/) | 2026-03-24 | `8b4cd51` | Market page moved to first in navbar; logo + default landing → Market |
| [Root URL → market.html](changes/dashboard-ui/) | 2026-03-24 | `23c7258` | `index.html` replaced with instant redirect to `market.html`; Signals moved to `signals.html` |
| [Market Data Cron](changes/ci-data-pipeline/) | 2026-03-24 | `ba90804` | `update-vix.py` + `update-market-data.sh` — F&G + VIX auto-refresh at 9:30am/12pm/3pm/4:05pm ET Mon–Fri |
| [EOD Update Pipeline](changes/ci-data-pipeline/) | 2026-03-25 | `a95bbc5` | `eod-update.sh` — single EOD runner for F&G + VIX + sector rotation + EM. GitHub Action Mon-Fri 4:20 PM ET, auto-push. Fri runs all EM tiers (weekly/monthly/quarterly), Mon-Thu daily tier only. Local Mac cron fallback. Handles rebase conflicts. |
| [EM Calculator — IB→yfinance](changes/expected-moves/) | 2026-03-25 | `4afa1bb` | Rewrote `update-expected-moves.py` — IB Gateway first, yfinance fallback, Polygon removed. `--source auto/ib/yfinance`. `BT_EM_SOURCE` env var. 57-60 tickers in ~2 min (vs 80+ min Polygon). |
| [EM History Slice Fix](changes/expected-moves/) | 2026-03-25 | `efd6d26` | `history[-52]` → `history[-52:]` — slice not index bug fix |
| [F&G Updated Tooltip](changes/dashboard-ui/) | 2026-03-27 | — | Hover "Fear & Greed Index" title on signals + market pages shows last-updated timestamp (e.g. "Updated: Mar 25, 8:20 PM ET"). `cursor: help` hint. Reads `updated` field from `fear-greed.json`. |
| [Canonical Price Layer](changes/dashboard-ui/) | 2026-03-27 | — | `data/prices.json` + `bt-prices.js` — single source of truth for all ticker prices across all pages. `update-prices.py` fetches 79 tickers from yfinance. All pages (EM, watchlist, signals, market) load `bt-prices.js` and prefer its prices over stale per-file snapshots. EM page drops redundant "Close" column, shows "Price" from canonical source. `macro-context.js` overlays btPrices. `futures.json` added to all pipelines (was orphaned since Mar 19). EOD + intraday pipelines run prices + futures first. Push retry (3×) with stuck-rebase cleanup fixes Mar 26 EOD gap. GH Actions workflow also gets retry. |
| [EM Anchor Fix — previousClose](changes/expected-moves/) | 2026-03-27 | `0aa01c9` | **Bug fix:** EM script used `lastPrice` (live intraday) as anchor → ranges drifted during market hours → all tickers showed ABOVE EM after big moves. Now uses `regularMarketPreviousClose` (yesterday's settled 4 PM close). Fallback chain: `regularMarketPreviousClose` → `previousClose` → `lastPrice`. Option straddle prices still use live data (correct — fresh IV). EM rules fully documented in proposal.md: anchor definition, staleness trap, scaling rules, risk model interpretation, two-source display architecture. |
| [EM Canonical Price Enforcement + Monthly Fallback](changes/expected-moves/) | 2026-03-29 | `d97aee7`, `2f992ed` | **Bug fix:** Both EM scripts (`update-expected-moves-ib.py` + `update-expected-moves.py`) weren't reading from canonical price layer — IB used `reqMktData.close` (stale after hours), yfinance used `regularMarketPreviousClose`. Now both read `prices.json` → `watchlist.json` first (enforcing existing canonical price rule from Mar 27). Also: tickers with no weekly options (17 names like SYK, ADM, XLRE) now fall back to nearest monthly expiry (14-45 DTE) instead of being skipped. Result: 77 tickers with all 4 tiers (was 60). |
| [SPX Native Index Support](changes/expected-moves/) | 2026-03-29 | `0c7cf06` | SPX added to Indices filter + EM data via native IB `Index('SPX', 'CBOE')` contract — real CBOE options chain (706 strikes, 40 expirations). yfinance uses `^SPX` symbol mapping. Both EM scripts handle Index contracts (`secType='IND'`). SPX in DAILY_TICKERS + QUARTERLY_TICKERS. Dashboard: INDICES list, exchange map (`SP:SPX` for TradingView). 78 total tickers. |
| [EM Formula Test Suite](changes/expected-moves/) | 2026-03-29 | `a4eaaa0` | 206 assertions across 10 groups: core formula (`straddle × 0.85`, `√DTE` scaling), tier ordering, index sanity (SPX/SPY/QQQ/IWM/DIA range checks), SPX↔SPY cross-validation, straddle integrity (call+put=straddle, strike near close), formula recomputation from stored data, direct monthly/quarterly straddle override verification, canonical price consistency (0 stale), data completeness (78 tickers, 4 tiers), edge cases (DTE=0, high/low IV). |

## Active Changes (in progress)

| Change | Status | Description |
|--------|--------|-------------|
| [Dashboard UI](changes/dashboard-ui/) | Partial | Card variants + filters shipped; responsive polish pending |
| [Data Pipeline](changes/data-pipeline/) | Partial | Core signals + EOD pipeline shipped; lifecycle classifier + per-ticker Tom pending |

## Planned Changes (not started)

| Change | Priority | Description |
|--------|----------|-------------|
| Earnings Calendar | High | Dedicated earnings tool — EarningsWhisper (primary), TradingView (secondary). Upcoming earnings for watchlist + broader market. |
| EM History Sparkline | Medium | Per-ticker mini sparkline of historical EM values on expected-moves.html |
| EM Columns on Watchlist | Medium | Compact weekly EM% + position in range columns on watchlist table |
| [AI-Ready Architecture](changes/ai-ready-architecture/) | Medium | Tom agent multi-channel output: alerts, ticker notes, market pulse, feed panel |
| Trade Lifecycle Engine | Medium | 9-state status classifier for ticker cards |
| Per-Ticker Tom's Take | Low | Pre-generated LLM analysis per symbol |
| [Tom Chat Widget](changes/tom-chat/) | Low | Interactive chat — deferred to Phase 3 of AI-Ready Architecture |
| Event Calendar — Phase 2 | Medium | FastAPI route in market-watcher; external calendar API polling (FRED releases, macro data) |

## Archived

| Change | Date | Description |
|--------|------|-------------|
| [Watchlist Engine](changes/archive/2026-03-17-watchlist-engine/) | 2026-03-17 | Initial watchlist data + export |
| [Dashboard Frontend](changes/archive/2026-03-17-dashboard-frontend/) | 2026-03-17 | Initial 3-page dashboard build |
| [Tom Agent](changes/archive/2026-03-17-tom-agent/) | 2026-03-17 | Tom persona files + rules |
