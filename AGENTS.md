# AGENTS.md — BreakingTrades Dashboard

AI assistants: read this file first, then `docs/PLAN.md` for full project context.

## What This Is

A professional trading intelligence dashboard combining:
- Real-time watchlists with automated technical analysis
- Interactive TradingView charts across multiple timeframes
- AI-powered trade setup generation and analysis
- An embedded AI trading assistant ("Tom") for market Q&A
- Macro context and sector rotation signals

## Rules

1. **No external source attribution.** This is BreakingTrades branded. Do not reference external communities, paid services, or data sources by name.
2. **Spec-driven development.** Use OpenSpec for all feature work. Propose → spec → design → implement → archive.
3. **Dark theme only.** All UI is dark trading terminal aesthetic. Color tokens in `docs/DESIGN_SYSTEM.md`.
4. **TradingView widgets are free embeds only.** No API keys, no paid features.
5. **Data pipeline is Python.** Frontend is HTML/JS (static for MVP, Next.js later).
6. **Tom agent context** lives in `tom/` — system prompt + methodology + curated analysis.

## Key Files

- `docs/PLAN.md` — Full project plan, architecture, roadmap
- `docs/DESIGN_SYSTEM.md` — Colors, typography, component specs (TODO)
- `docs/ARCHITECTURE.md` — Technical architecture (TODO)
- `openspec/` — Specs and changes (after `openspec init`)
- `data/pipeline/` — Python data processing scripts
- `tom/` — AI assistant configuration and context

## Getting Started

```bash
# Install OpenSpec
npm install -g @fission-ai/openspec@latest
openspec init

# Propose a feature
# /opsx:propose watchlist-grid-view
```
