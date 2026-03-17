# BreakingTrades Dashboard

Professional trading intelligence dashboard with real-time setup tracking, AI-powered analysis, and interactive TradingView charts.

## Features

- **Live Watchlist** — Tickers with SMA alignment, bias, key levels, and distance to entry
- **Setup Tracker** — Real-time lifecycle: Watching → Approaching → Triggered → Active → Trailing
- **Interactive Charts** — TradingView embeds with SMA 20/50 (daily) and SMA 20/50/100/200 (weekly)
- **Tom's Take** — AI trading assistant analysis per ticker and daily macro briefing
- **Macro Dashboard** — VIX regime, DXY, yields, pair ratios (XLY/XLP, HYG/SPY, RSP/SPY)
- **Sector Rotation** — Heatmap and relative strength tracking

## Architecture

This is a **presentation layer**. Market data and analysis live in the parent BreakingTrades project. An export script bridges data → JSON → GitHub Pages.

```
Parent Project (local)  →  Export Script  →  JSON  →  GitHub Pages
   CSVs, agents               ↓              ↓          ↓
   watchlists              compute         commit    auto-deploy
   Tom's brain             signals          push     serve static
```

## Status

**Phase 0: Planning** ✅ — OpenSpec proposals, architecture, design system  
**Phase 1: Build** — Next

## Docs

- [Architecture Decisions](docs/DECISIONS.md)
- [Project Plan](docs/PLAN.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [Architecture](docs/ARCHITECTURE.md)

## Org

[github.com/breakingtrades](https://github.com/breakingtrades)
