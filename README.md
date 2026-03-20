# BreakingTrades Dashboard

Professional trading intelligence dashboard with real-time setup tracking, AI-powered analysis, and interactive TradingView charts.

**Live:** [breakingtrades.github.io/breakingtrades-dashboard](https://breakingtrades.github.io/breakingtrades-dashboard/)

## Pages

| Page | URL | Status | Purpose |
|------|-----|--------|---------|
| **Signals** | `index.html` | ✅ Live | Trade setups with lifecycle tracking, detail modals, pair ratios |
| **Watchlist** | `watchlist.html` | ✅ Live | 74-symbol tracker with table view, detail modals, EM banner, hash routing |
| **Expected Moves** | `expected-moves.html` | ✅ Live | Options-based risk heatmap — position in EM range, alert tags, staleness guard |
| **Market** | `market.html` | ✅ Live | Sector heatmap, RRG chart, Fear & Greed, VIX, pairs, sector rankings |

## Features

- **Trade Lifecycle** — Status tracking: Watching → Approaching → Retest → Active → Exit
- **Expected Moves** — ATM straddle × 0.85 risk ranges (daily/weekly/monthly/quarterly) with risk heatmap, alert tags, stale data detection
- **Futures Strip** — Pre-market/live data for 14 instruments: ES, NQ, RTY, YM, CL, NG, GC, SI, HG, US10Y, DXY, VIX, BTC, ETH
- **Global Ticker Search** — Search any symbol; tracked tickers show enriched data, external tickers get TradingView widgets
- **Interactive Charts** — TradingView embeds with SMA 20/50 (daily + weekly), sequential loading
- **Sector Rotation (RRG)** — Relative Rotation Graph with 4-quadrant regime classification + risk badges
- **Market Status** — Real-time open/closed/pre/after indicator with holiday awareness
- **Macro Strip** — VIX, DXY, US10Y, Oil, BTC with live data
- **12 Pair Ratios** — XLY/XLP, RSP/SPY, HYG/SPY, IWM/SPY, and 8 more
- **Fear & Greed** — CNN index with history tracking (JSONL + CSV)
- **Status Filters** — Tab filters with badge counts (Approaching, Active, Exit, Watching)
- **Timezone Support** — 9 presets, auto-detect, localStorage persistence
- **Tom's Take** — AI trading assistant analysis per ticker (Phase 4)

## Architecture

Static HTML + vanilla JS. Data pipeline (Python) runs locally → generates JSON. Dashboard server (`scripts/serve.py`) serves static files + proxies Yahoo Finance search API.

```
Local Python Pipeline  →  JSON Files  →  Dashboard Server (serve.py)
  yfinance/tvDatafeed      watchlist.json    static files + /api/search proxy
  CNN F&G scraper          setups.json       futures.json (cron-refreshed)
  signal computation       fear-greed.json   GitHub Pages (production)
  Yahoo v8 chart API       futures.json
```

## Status

- **Phase 0: Foundation** ✅ — Repo, org, OpenSpec, design system, TV embed guide
- **Phase 1: Signals MVP** ✅ — Live dashboard with setup cards, charts, filters, pair ratios
- **Phase 2: Multi-Page** ✅ — Watchlist, Expected Moves, Market pages, shared nav, ticker search
- **Phase 3: Data Pipeline** 🔄 — yfinance fallback, Fear & Greed, expected moves, CI briefings
- **Phase 4: Tom Agent** ⏳ — AI analysis, cached takes, chat widget

## Docs

| Doc | Description |
|-----|-------------|
| [PLAN.md](docs/PLAN.md) | Project plan & phased roadmap |
| [MULTI_PAGE_ARCHITECTURE.md](docs/MULTI_PAGE_ARCHITECTURE.md) | Multi-page layout, navigation, new widgets |
| [TRADINGVIEW_EMBED_GUIDE.md](docs/TRADINGVIEW_EMBED_GUIDE.md) | TradingView widget integration reference |
| [TRADE_LIFECYCLE.md](docs/TRADE_LIFECYCLE.md) | 9-state trade status system + retest detection |
| [UX_DESIGN_SPEC.md](docs/UX_DESIGN_SPEC.md) | Design tokens, wireframes, component specs |
| [DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) | Static site data delivery options |
| [FILTER_SYSTEM.md](docs/FILTER_SYSTEM.md) | Filter bar, tabs, search, timezone |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Colors, typography, spacing tokens |
| [TOM_CHAT_SPEC.md](docs/TOM_CHAT_SPEC.md) | Tom chat widget 3-tier architecture |

## OpenSpec Changes

See [openspec/INDEX.md](openspec/INDEX.md) for full change log with commit references.

## Org

[github.com/breakingtrades](https://github.com/breakingtrades)
