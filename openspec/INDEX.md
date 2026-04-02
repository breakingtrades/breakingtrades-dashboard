# BreakingTrades Dashboard — OpenSpec Index

> Last updated: 2026-03-31
> Status: **Production (v1)** + **Staging (v2 SPA)** 
> v1 live at: https://breakingtrades.github.io/breakingtrades-dashboard/
> v2 staging at: https://brave-glacier-07c70460f.2.azurestaticapps.net/root index.html
> Azure SWA auto-deploys from GitHub on every push.

## Architecture

### v1 (Current Production) — Multi-Page
6 standalone HTML files, each with inline CSS/JS. Full page reload on navigation.

### v2 (Staging) — Single Page Application
Vanilla JS SPA in `root ` subdirectory. Hash router, persistent nav + ticker tape, shared component library. 33 files, ~6,800 lines. Zero framework, zero build step.

| Layer | Files | Description |
|-------|-------|-------------|
| **Shell** | `index.html`, `shell.js`, `router.js`, `app.js`, `preferences.js` | Single HTML shell, hash router, localStorage preferences |
| **CSS** | `variables.css`, `reset.css`, `shell.css`, `components.css` + 7 page CSS | Extracted from v1 inline styles, single `:root` token source |
| **Components** | `fear-greed.js`, `vix-regime.js`, `detail-modal.js`, `collapsible.js` | Shared across pages, deduplicated from v1's 3 modal implementations |
| **Pages** | `market.js`, `signals.js`, `watchlist.js`, `expected-moves.js`, `events.js`, `autoresearch.js` | Lazy-loaded by router, register on `BT.pages` namespace |
| **Lib** | `bt-prices.js`, `market-status.js`, `ticker-search.js`, `ticker-tape.js`, `sector-rotation.js` | Copied from v1, data paths adjusted to `../data/` |
| **Icons** | Lucide Icons via CDN (`unpkg.com/lucide@latest`) | Replaced all emoji + inline SVGs with consistent monoline SVG icons |
| **Hosting** | Azure Static Web Apps (Free tier, eastus2) | Auto-deploy via GitHub Actions, auth-ready, PR preview environments |

## Production Pages

| Page | v1 File | v2 Route | Description |
|------|---------|----------|-------------|
| **Market** (landing) | `market.html` | `#market` | Sector heatmap, RRG, Fear & Greed gauge, VIX regime, pair ratios, sector rankings, market breadth |
| **Signals** | `signals.html` | `#signals` | Trade setup cards with lifecycle tracking, detail modals + TradingView charts, right panel (F&G, regime, briefing) |
| **Watchlist** | `watchlist.html` | `#watchlist` | 74-symbol tracker, table view, detail modals, EM banner, hash routing (`#watchlist/SPY`) |
| **Expected Moves** | `expected-moves.html` | `#expected-moves` | Options EM risk heatmap, position bars, alert tags, staleness guard, filter/tier tabs, inline detail modal |
| **Events** | `events.html` | `#events` | Calendar page, live countdowns, category filters, mini strip on signals |
| **Autoresearch** | `autoresearch.html` | `#airesearcher` | AI Researcher — Regime Intelligence dashboard (15-signal regime scoring, playbook, market internals, commodity chain, transition signals) |

## Production Data Pipeline

| Component | Schedule | Description |
|-----------|----------|-------------|
| **Canonical Prices** | 4× daily (9:30/12/3/4:05 ET) + EOD | `update-prices.py` → `data/prices.json` — single source of truth for all ticker prices. `bt-prices.js` shared module consumed by all pages. |
| **Futures Strip** | 4× daily (9:30/12/3/4:05 ET) + EOD | `update_futures.py` → `data/futures.json` — 14 instruments. **No longer rendered on any page** — replaced by TradingView real-time ticker tape (`js/ticker-tape-tv.js`). JSON still generated for pipeline/API consumers. `macro-context.js` also removed from all pages (was the second static strip showing SPY/QQQ/VIX/F&G with SMA20 tags). |
| **Fear & Greed** | ~Hourly cron | `update-fear-greed.py` → `data/fear-greed.json` |
| **VIX** | 4× daily (9:30/12/3/4:05 ET) | `update-vix.py` → `data/vix.json` |
| **Sector Rotation** | On demand / EOD | `export-sector-rotation.py` → `data/sector-rotation.json` + `data/sector-risk.json` |
| **Market Breadth** | EOD | `update-breadth.py` → `data/breadth.json` — 11 GICS sectors + 5 indices, multi-timeframe (20/50/100/200d SMA) |
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
| [Market Status Indicator](changes/market-status-indicator/proposal.md) | 2026-03-18 | `44f01b5`, `501b559` | Real-time open/closed/pre/after with holidays. **Updated 2026-04-02:** all times localized to user's browser timezone (open/close/clock), no hardcoded ET. |
| [Sector Rotation Chart](changes/sector-rotation-chart/OPENSPEC.md) | 2026-03-18 | `44fa968` | RRG chart + sector risk badges (4 phases) |
| [Logo & Branding](changes/logo-branding/proposal.md) | 2026-03-19 | — | Inline SVG logo mark in nav bar |
| [Ticker Search](changes/ticker-search/proposal.md) | 2026-03-19 | — | Global search bar with tracked (enriched) vs external (TradingView) routing |
| [Futures Strip](changes/futures-strip/proposal.md) | 2026-03-19 | — | Pre-market futures/macro data strip (14 instruments, 5 groups). **Fully superseded by TradingView real-time ticker tape on all pages (2026-03-31).** `futures-strip.js` and `macro-context.js` no longer loaded. |
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
| [Search → Detail Routing (System-wide)](changes/shared-nav-component/) | 2026-03-29 | `b7d6264`, `12674ad` | `ticker-search.js` now self-contained: if page has `openDetail()` (signals, watchlist, EM), routes there for all tickers (tracked + external). If page has no modal (market, sector-rotation), creates a lightweight modal on-the-fly with TradingView daily/weekly charts + technical analysis + profile + financials. EM page bridges via `window.openDetail = openEMDetail` and handles external tickers gracefully (TV chart + "Not in watchlist" note). Sort on EM page now 3-state: asc → desc → none. |
| [Market Breadth](changes/market-breadth/proposal.md) | 2026-03-29 | — | Market breadth section on market page: river map (stacked bar, 0-1100), breadth lines (per-sector, 0-100), multi-timeframe table (SPX/NDX/DJI/RUT/VTI × 20/50/100/200d), zone annotations, `update-breadth.py` pipeline (235 stocks via yfinance), added to EOD pipeline, 31 Jest tests. |
| [Signals — Remove Brief Metadata](changes/dashboard-ui/) | 2026-03-29 | `d5803bf` | Removed internal brief metadata (model name + generated timestamp) from signals page UI. Audience-facing briefing should not expose `gpt-4o` model attribution or generation timestamps. |
| [Real-time Ticker Tape](changes/realtime-ticker-tape/) | 2026-03-31 | `3c15180`, `d6c02d8`, `7359d59` | Replaced static `futures-strip.js` + `macro-context.js` strips with TradingView embedded ticker tape widget (compact mode). Shared `js/ticker-tape-tv.js` injects after `<nav>` on `nav:ready` event — **all 6 pages** (market, watchlist, expected-moves, signals, events, autoresearch). 14 tickers: S&P (`FOREXCOM:SPXUSD`), Nasdaq (`FOREXCOM:NSXUSD`), Russell (`AMEX:IWM`), Dow (`AMEX:DIA`), Oil (`TVC:USOIL`), Gas (`CAPITALCOM:NATURALGAS`), Gold (`TVC:GOLD`), Silver (`TVC:SILVER`), Copper (`CAPITALCOM:COPPER`), Energy (`AMEX:XLE`), Dollar (`AMEX:UUP`), VIX (`AMEX:UVXY`), BTC (`BITSTAMP:BTCUSD`), ETH (`BITSTAMP:ETHUSD`). Real-time WebSocket for indices/commodities/crypto; 15-min delay for ETF proxies. Free tier — no API keys, zero maintenance. Old `macro-context.js` strip removed from market/watchlist/signals (was showing stale `prices.json` data labeled as live). `futures-strip.js` no longer loaded on any page. TradingView free widget doesn't support raw TVC:DXY, TVC:VIX, CBOE:TNX, or bond ETFs — ETF proxies used instead. |
| [Dynamic Pair Ratios Strip](changes/dynamic-pair-ratios/) | 2026-03-31 | `fd93ebd` | Replaced hardcoded pair ratio pills on signals page with data-driven SMA50 computation. 8 pairs: XLY/XLP (consumer), HYG/SPY (credit), IWM/SPY (breadth), XLV/SPY (defensive), XLE/SPY (energy), IWM/QQQ (value/growth), GLD/SPY (safe haven), TLT/SPY (bonds). Signal = ratio of current prices vs ratio of SMA50 values from watchlist.json. 1% threshold: above → ↗ up, below → ↘ down, within → → neutral. RSP replaced by IWM/SPY (RSP not in watchlist). |
| [SPA v2 Rewrite — Phases 1-3](changes/spa-v2/OPENSPEC.md) | 2026-03-31 | `f773dd0`..`41d84a6` | **Full SPA rewrite, promoted to root Apr 1.** Vanilla JS, zero framework, zero build step. 33 files, ~6,800 lines (vs v1's ~7,000 with duplication). v1 archived to `v1/`. Route `#airesearcher` (was `#autoresearch`, legacy redirect in place). **Phase 1:** Single `index.html` shell, hash router (`#market`, `#signals`, etc.), `preferences.js` (localStorage persistence), `shell.js` (nav, ticker tape toggle, hamburger), market page extracted. **Phase 2:** All 6 pages migrated — signals (13 setup cards, filters, right panel), watchlist (74-symbol table, sorting), expected moves (EM table, tier/filter tabs), events (countdowns, JSONL), AI Researcher (regime intelligence). Unified `detail-modal.js` (merged 3 v1 implementations). Shared `fear-greed.js` + `vix-regime.js` components. **Phase 3:** Lucide Icons (replaced ALL emoji + inline SVGs with consistent monoline SVGs via CDN), mobile responsive (hamburger nav, sticky columns, full-screen modals at ≤768px), collapsible sections (12 sections across 3 pages, state persists in preferences), loading skeletons (shimmer animation for all data areas). CSS token system (`variables.css` — single source for 40+ design tokens). |
| [Azure Static Web Apps](changes/spa-root OPENSPEC.md) | 2026-03-31 | `f9a12e8` | Deployed dashboard to Azure SWA (Free tier, eastus2, `rg-breakingtrades`). Auto-deploy via GitHub Actions on every push to main. URL: `brave-glacier-07c70460f.2.azurestaticapps.net`. PR preview environments enabled. Auth-ready (GitHub/Entra/Google login via config-only `staticwebapp.config.json`). Runs parallel to GitHub Pages — zero disruption. Subscription: `ME-MngEnvMCAP356394-idanshimon-1` ($0 cost — free tier). |

## Active Changes (in progress)

| Change | Status | Description |
|--------|--------|-------------|
| [SPA v2 Cutover](changes/spa-root OPENSPEC.md) | Phase 4 pending | Move `root ` to root, archive v1, configure auth, custom domain |
| [Data Pipeline](changes/data-pipeline/) | Partial | Core signals + EOD pipeline shipped; lifecycle classifier + per-ticker Tom pending |

## Planned Changes (not started)

| Change | Priority | Description |
|--------|----------|-------------|
| SPA v2 Cutover (Phase 4) | **High** | Move `root ` to root, retire v1, configure Azure SWA auth + custom domain |
| [Regime Intelligence Dashboard](changes/regime-intelligence/OPENSPEC.md) | **Shipped** | ✅ Shipped as AI Researcher (`#airesearcher`). Computed regime score from 15 weighted signals, 7 regimes (CRISIS→EUPHORIA), Tom's rules mapped, playbook per regime, transition signals, market internals, commodity chain, regime history. Added to EOD pipeline. |
| Earnings Calendar | High | Dedicated earnings tool — EarningsWhisper (primary), TradingView (secondary). Upcoming earnings for watchlist + broader market. |
| EM History Sparkline | Medium | Per-ticker mini sparkline of historical EM values on expected-moves.html |
| EM Columns on Watchlist | Medium | Compact weekly EM% + position in range columns on watchlist table |
| [AI-Ready Architecture](changes/ai-ready-architecture/) | Medium | Tom agent multi-channel output: alerts, ticker notes, market pulse, feed panel |
| Trade Lifecycle Engine | Medium | 9-state status classifier for ticker cards |
| Per-Ticker Tom's Take | Low | Pre-generated LLM analysis per symbol |
| [Tom Chat Widget](changes/tom-chat/) | Low | Interactive chat — deferred to Phase 3 of AI-Ready Architecture |
| Event Calendar — Phase 2 | Medium | FastAPI route in market-watcher; external calendar API polling (FRED releases, macro data) |
| Economic Calendar Integration | **High** | Auto-populate Events page with economic calendar data (FOMC, CPI, PPI, NFP, GDP, jobless claims, FRED releases). Source: Investing.com economic calendar API or TradingView economic calendar widget. Show upcoming releases with consensus/prior, countdown timers, and severity based on market impact. Should merge seamlessly with existing JSONL events + NYSE holiday auto-injection. |

## Archived

| Change | Date | Description |
|--------|------|-------------|
| [Watchlist Engine](changes/archive/2026-03-17-watchlist-engine/) | 2026-03-17 | Initial watchlist data + export |
| [Dashboard Frontend](changes/archive/2026-03-17-dashboard-frontend/) | 2026-03-17 | Initial 3-page dashboard build |
| [Tom Agent](changes/archive/2026-03-17-tom-agent/) | 2026-03-17 | Tom persona files + rules |
