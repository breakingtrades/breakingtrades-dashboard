# AGENTS.md — BreakingTrades Dashboard

AI assistants: read this file, then `docs/PLAN.md` for roadmap, then `docs/MULTI_PAGE_ARCHITECTURE.md` for page structure.

## What This Is

**A multi-page trading intelligence dashboard** on GitHub Pages. Three pages:

1. **Signals** (`index.html`) — Trade setup cards with lifecycle tracking, detail modals with TradingView charts ✅ LIVE
2. **Watchlist** (`watchlist.html`) — Full ~70 symbol tracker with TradingView Market Overview + sortable table 📋 SPEC'D
3. **Market** (`market.html`) — Sector heatmap, Fear & Greed gauge, market health dashboard 📋 SPEC'D

**Live URL:** https://breakingtrades.github.io/breakingtrades-dashboard/

## Architecture (Critical — Read This)

```
~/projects/breakingtrades/          ← DATA LIVES HERE (local, not on GitHub)
├── data/*.csv                      ← 958 OHLCV files
├── agents/tom-fxevolution/         ← Tom's full agent brain
├── screener.py, update_data.py     ← Data pipeline
├── scrape_tv_watchlist.sh          ← Watchlist scraping
└── fxevolution/watchlists/         ← Dated watchlist snapshots

~/projects/breakingtrades/breakingtrades-dashboard/  ← THIS REPO
├── src/                            ← Frontend (HTML/CSS/JS)
├── data/                           ← JSON snapshots (exported, not raw)
├── scripts/export-dashboard-data.py ← Bridge script
└── → GitHub Pages serves the dashboard
```

**The export script is the bridge.** It reads parent data → computes signals → writes JSON → commits → pushes → GitHub Pages deploys.

## Rules

1. **No data duplication.** This repo has JSON snapshots, not CSVs or raw data.
2. **No external source attribution.** Everything is BreakingTrades branded. No FXEvolution, no community names.
3. **Tom's agent brain lives in the parent repo.** `tom/` here is output only (cached analysis JSON).
4. **Moving averages are SMA, not EMA.** Tom uses SMA 20 (primary), SMA 50, Weekly SMA 20. NOT EMA 8/21/50.
5. **Dark theme only.** Trading terminal aesthetic. See `docs/DESIGN_SYSTEM.md`.
6. **OpenSpec for features, not fixes.** Use `/opsx:propose` for new modules. Direct edit for bugs.
7. **Setup tracking is real-time.** The dashboard tracks setup lifecycle: WATCHING → APPROACHING → TRIGGERED → ACTIVE → TRAILING/STOPPED/TARGET.

## Key Docs

| File | What |
|------|------|
| `docs/PLAN.md` | Roadmap, phases, current status |
| `docs/MULTI_PAGE_ARCHITECTURE.md` | Pages, navigation, TradingView widget configs |
| `docs/TRADINGVIEW_EMBED_GUIDE.md` | **MUST READ** — Valid params, gotchas, multi-chart pattern |
| `docs/TRADE_LIFECYCLE.md` | 9-state trade lifecycle + retest detection |
| `docs/UX_DESIGN_SPEC.md` | Design tokens, wireframes, component specs |
| `docs/DATA_ARCHITECTURE.md` | Static site data delivery analysis |
| `docs/FILTER_SYSTEM.md` | Filter bar, tabs, search, timezone |
| `docs/DESIGN_SYSTEM.md` | Colors, typography, components |
| `docs/TOM_CHAT_SPEC.md` | Tom chat 3-tier architecture |
| `openspec/changes/` | Feature proposals with specs/design/tasks |

## OpenSpec Changes

| Change | Status | Focus |
|--------|--------|-------|
| `data-pipeline` | Designed (proposal + specs + design + tasks) | Python pipeline for signal computation |
| `dashboard-ui` | Designed | Data-driven rendering, filters, card variants |
| `tom-chat` | Designed | AI chat widget, intent router, cached responses |
| `watchlist-page` | Proposed (proposal + specs) | TradingView Market Overview + sortable table |
| `market-page` | Proposed (proposal + specs) | Sector heatmap + F&G gauge + shared nav |

## Moving Average Config (Tom's Actual System)

### TradingView Chart Settings (Idan's config)
| SMA | Color | Width |
|-----|-------|-------|
| 20 | Gray (`#9e9e9e`) | 2 |
| 50 | Yellow (`#ffeb3b`) | 3 |
| 100 | Red | 4 |
| 150 | Orange | 4 |
| 200 | Purple | 4 |

### Dashboard Charts (embed widget limitations)
- **Daily:** SMA 20 (gray, width 2) + SMA 50 (TV default) + Volume. Range: `12M`
- **Weekly:** SMA 20 (gray, width 2) + SMA 50 (TV default) + Volume. Range: `60M`
- ⚠️ Embed widget can only override first MA instance. Second MA gets TV default color.
- ⚠️ See `docs/TRADINGVIEW_EMBED_GUIDE.md` for all gotchas before touching chart code.

### Bias Determination
- **BULLISH:** Price > SMA 20 > SMA 50, AND price > Weekly SMA 20
- **BEARISH:** Price < SMA 20 < SMA 50, AND price < Weekly SMA 20
- **MIXED:** Everything else
- **EXIT SIGNAL:** Daily close below SMA 20

## Deploy

```bash
# Export data from parent project
cd ~/projects/breakingtrades/breakingtrades-dashboard
python3 scripts/export-dashboard-data.py --commit --push

# GitHub Pages auto-deploys from main branch
# URL: https://breakingtrades.github.io/breakingtrades-dashboard/
```
