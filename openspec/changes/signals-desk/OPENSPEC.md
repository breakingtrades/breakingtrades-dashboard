# Signals Desk — Anonymized Social-Signal Aggregate Page

> Status: **Shipping** · Route: `#signals-desk` · Date: 2026-06-30

## Why

Idan tracks market commentary across YouTube creators and X accounts (and a paid
MeetKevin/Reinvest membership) via the standalone `signals/` framework in the parent
repo. That framework extracts structured trade signals + macro warnings into an indexed
SQLite store. This change surfaces a **public-safe, anonymized** slice of that data as a
new dashboard page so Idan can browse aggregated ideas/warnings from the live site.

## What Changes

- New SPA route `#signals-desk` (distinct from the existing `#signals` trade-setup page).
- New `js/pages/signals-desk.js` page module (reuses `ai-trader.css`).
- New bridge script `scripts/export-signals-desk.py` reading the parent
  `signals/data/signals.db` → `data/signals-desk.json`.
- Sidebar nav item under ANALYSIS.
- Router row + sidebar item (the standard 5-touch-point new-page wiring).

## Anonymization & Safety (load-bearing)

The dashboard is a **public, unauthenticated, brand-name** site. AGENTS.md rule:
"No external source attribution." Therefore:

1. **Creator names/handles are STRIPPED.** Each source entity maps to a stable
   anonymous label `Desk N · <type> · <platform>` derived from its extract mode.
   No real names (Matt/Michael/Steven/Kevin/Tom) ever reach the JSON or the page.
2. **Paid MeetKevin Alpha content is EXCLUDED.** Only `source_id ∈ {youtube, x}` is
   exported; `meetkevin_app` (paid membership) is dropped at the query.
3. The exporter runs a hard leak-check: if any known creator name appears in the output
   JSON it aborts with a non-zero exit before write is trusted.
4. Educational-use disclaimer chrome on the page; nothing here is investment advice.

## Impact

- Parent `signals/` framework: read-only (export queries the DB, never writes it).
- No Tom/FXEvolution coupling.
- `data/signals-desk.json` is generated output (like other dashboard data files).

## Non-goals

- NOT publishing creator names or paid content (anonymized + excluded by design).
- NOT wiring an EOD cron yet (manual `export-signals-desk.py` for now).
- NOT a write path back into the signals framework.
