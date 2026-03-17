# AGENTS.md — BreakingTrades Dashboard

AI assistants: read this file, then `docs/DECISIONS.md` for architecture decisions, then `docs/PLAN.md` for roadmap.

## What This Is

**A presentation layer** for the BreakingTrades trading system. This repo does NOT own data — it consumes existing data from the parent BreakingTrades project and renders it as a professional dashboard on GitHub Pages.

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
| `docs/DECISIONS.md` | Architecture decisions — **read this first** |
| `docs/PLAN.md` | Roadmap, modules, tech stack |
| `docs/DESIGN_SYSTEM.md` | Colors, typography, components |
| `docs/ARCHITECTURE.md` | System diagrams, data flow |
| `openspec/changes/` | Feature proposals with specs/design/tasks |
| `tom/README.md` | How Tom agent integration works |

## Moving Average Config (Tom's Actual System)

### Daily Charts
- **SMA 20** — Primary. Solid cyan. "King for exits."
- **SMA 50** — Trend. Dashed orange.
- **Weekly SMA 20** — Mean reversion. Dotted purple. (Side-by-side for MVP)

### Weekly Charts
- **SMA 20** — THE weekly level. Solid cyan.
- **SMA 50** — Dashed orange.
- **SMA 100** — Dotted gray.
- **SMA 200** — Dotted dim gray.

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
