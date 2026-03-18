# BreakingTrades Dashboard — OpenSpec Index

> Last updated: 2026-03-18

## Shipped Changes

| Change | Date | Commits | Description |
|--------|------|---------|-------------|
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
| [Tom Chat Widget](changes/tom-chat/) | Low | Interactive chat — deferred to Phase 3 of AI-Ready Architecture |
| Mac Cron Push | Medium | IB Gateway data enrichment (expected moves, dark pool) |
| Trade Lifecycle Engine | Medium | 9-state status classifier for ticker cards |
| Per-Ticker Tom's Take | Low | Pre-generated LLM analysis per symbol |

## Archived

| Change | Date | Description |
|--------|------|-------------|
| [Watchlist Engine](changes/archive/2026-03-17-watchlist-engine/) | 2026-03-17 | Initial watchlist data + export |
| [Dashboard Frontend](changes/archive/2026-03-17-dashboard-frontend/) | 2026-03-17 | Initial 3-page dashboard build |
| [Tom Agent](changes/archive/2026-03-17-tom-agent/) | 2026-03-17 | Tom persona files + rules |
