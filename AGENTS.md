# AGENTS.md — BreakingTrades Dashboard

AI assistants: read this file, then `docs/PLAN.md` for roadmap, then `docs/MULTI_PAGE_ARCHITECTURE.md` for page structure.

## What This Is

**A multi-page trading intelligence dashboard** on GitHub Pages. Three pages:

1. **Signals** (`index.html`) — Trade setup cards with lifecycle tracking, detail modals with TradingView charts ✅ LIVE
2. **Watchlist** (`watchlist.html`) — 74-symbol tracker with table view, detail modals, EM banner, hash routing (`#SPY`) ✅ LIVE
3. **Expected Moves** (`expected-moves.html`) — Options EM risk heatmap with position bars, alert tags, staleness guard ✅ LIVE
4. **Market** (`market.html`) — Sector heatmap, RRG, Fear & Greed, VIX, pairs, sector rankings ✅ LIVE

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

## Tests

`test-nav.html` — browser-based test suite (~50 assertions). Open in browser or serve locally.

**Covers:**
- Nav rendering (logo, links, search, timezone, market status)
- Expected Moves data structure + freshness validation
- Staleness guard (data age, close price validity, range checks, position computation)
- SPY-specific sanity checks (4 tiers, reasonable EM%, price > $400)
- Event lifecycle (`nav:ready`, tz-picker availability)

**Run:** `python3 scripts/serve.py` → open `http://localhost:8888/test-nav.html`

## OpenSpec Changes

See [openspec/INDEX.md](openspec/INDEX.md) for full change log.

| Change | Status |
|--------|--------|
| `expected-moves` | ✅ Shipped — EM page, watchlist banner, risk model, staleness guard |
| `shared-nav-component` | ✅ Shipped — Nav bar, ticker search, market status, timezone |
| `sector-rotation-chart` | ✅ Shipped — RRG + risk badges |
| `ci-data-pipeline` | ✅ Shipped — yfinance fallback + GitHub Models briefing |
| `data-pipeline` | Designed | 
| `dashboard-ui` | Designed |
| `tom-chat` | Designed |

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
