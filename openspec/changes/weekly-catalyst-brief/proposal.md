# Weekly Catalyst Brief — Proposal

> **Status:** Draft → in-progress
> **Created:** 2026-06-09
> **Priority:** High
> **Related:** Event Calendar (shipped 2026-03-22, econ slice 2026-05-10), Daily Briefing (shipped — `generate-briefing.py`)

---

## Problem

Today's Events page is a passive aggregator. The data on it is whatever happened to flow in from disparate sources:

- **Geopolitical:** `trump-monitor.py` Google News RSS (Iran-heavy)
- **Macro:** `fetch-economic-calendar.py` — top 3 US 3-star within 14 days, no Fed-speak split
- **Earnings:** baked-on-export `earningsDate` for the 74-symbol watchlist universe only
- **Manual:** ad-hoc `bt-event add` (the IPO slate currently shown was hand-typed Jun 5)
- **Video Analysis:** `extract-events.py` from Tom transcripts — accidentally captures catalysts

Nothing **scans for the week ahead.** No Sunday-evening sweep, no widening of the econ window, no broader-market earnings (only watchlist), no Fed speakers, no FOMC dates, no narrative layer that fuses them. The Daily Briefing is daily-only, doesn't reference any of these catalysts, and runs every 30 minutes regardless of relevance.

A trader sitting down on Sunday night with the dashboard open does NOT get a "here's what to watch this week" view. They get a snapshot.

## Solution

Two coupled deliverables:

### 1. Weekly Catalyst Scan (data layer)

A Sunday-evening sweep that pulls every catalyst class for the upcoming 5 trading days and writes a single normalized JSON file:

```
data/weekly-catalysts.json
{
  week_of: "2026-06-15",        // Monday's date
  generated_at: ISO,
  econ:      [...],              // US 3-star: thisWeek + nextWeek (was top-3-in-14d only)
  fed:       [...],              // FOMC meetings + Fed speakers (Investing.com filter + Fed.gov scrape)
  earnings:  [...],              // Investing.com US earnings calendar — top N by market cap
  ipos:      [...],              // Manual events.jsonl with category=earnings/IPO context
  geopolitical: [...],           // Active events.jsonl with deadline within 7d
  index_emoves: {...},           // Weekly EM bands for SPY/QQQ/IWM/DIA + leaders
  summary: { totals, hottest_day, ... }
}
```

Producers (new + extended scripts):

| Script | Status | Purpose |
|--------|--------|---------|
| `fetch-economic-calendar.py` | **Extended** | Already pulls thisWeek+nextWeek; widen `--limit` defaults to capture all 3-star US events in window. Add `--week-mode` flag that returns full 14-day list, not top-3. |
| `fetch-earnings-calendar.py` | **New** | Investing.com `/earnings-calendar/` AJAX endpoint, US filter, thisWeek+nextWeek tabs. Parses ticker, market-cap, BMO/AMC, day. No API key. |
| `fetch-fomc-calendar.py` | **New** | Scrape `fomccalendars.htm` for the year's meeting dates; parse the next upcoming meeting. Static data — runs weekly, output cached. |
| `weekly-catalyst-scan.py` | **New** | Orchestrator. Calls all producers, reads `events.jsonl` for active geopolitical events, reads `expected-moves.json` for index EMs, normalizes everything into one JSON. Idempotent. |

### 2. Week-Ahead Brief (narrative layer)

A Sunday-evening Tom-persona LLM brief that takes `weekly-catalysts.json` as input and emits a human read of what matters and what doesn't. Same Tom agent (`agents/tom-fxevolution/`) but with a **weekly system prompt variant** — different cadence, different voice ("Sunday night, Idan's getting set for the week"), different output schema.

```
data/week-ahead.json
{
  week_of: "2026-06-15",
  title: "Week Ahead — Jun 15-19",
  headline: "...",
  thesis: ["...", "...", "..."],         // 3 bullets — the macro frame
  hot_days: [
    { date: "2026-06-17", reason: "FOMC + retail sales BMO" },
    { date: "2026-06-18", reason: "ACN earnings (mega-cap services tell)" }
  ],
  rule_triggers: ["R487 macro demand shock active", ...],
  what_im_watching: { tickers: [...], levels: {...} },
  what_im_skipping: "...",
  closing_quote: "...",
  generatedAt: ISO,
  model: "...",
  agent: "tom-fxevolution"
}
```

### 3. Frontend (`#week-ahead` SPA route)

New page module `js/pages/week-ahead.js` registered in `router.js`. Layout:

```
[ Tom's Brief ]                      ← week-ahead.json — full hero
   headline + 3-bullet thesis + closing quote

[ Hot Days strip ]                   ← visual: Mon Tue Wed Thu Fri with badges per day

[ Catalysts grid (4 columns) ]
  ┌───────────┬───────────┬───────────┬───────────┐
  │ Macro/Fed │ Earnings  │ IPOs      │ Geopolit. │
  │  - CPI    │  - ACN    │  - SPCX   │  - Iran   │
  │  - FOMC   │  - KR     │  - EROC   │  - mid-   │
  │  ...      │  - JBL    │  ...      │    terms  │
  └───────────┴───────────┴───────────┴───────────┘

[ Index Expected Moves ]              ← weekly EM bands SPY/QQQ/IWM/DIA
   Range visualizer with current price marker

[ Last Week's Recap ]                 ← (Phase 2) what played out vs predicted
```

Each catalyst card carries:
- Title + **headline-style market-impact context** (matching the IPO/midterms cards Idan likes)
- Tickers
- Deadline + countdown
- Severity tag
- Source attribution

### 4. Cron + Skill

- **Cron:** Sunday 6pm ET — `weekly-catalyst-scan.py` → `generate-week-ahead-brief.py` → optional Telegram preview via `send_message`
- **Skill:** `weekly-catalyst-scan` — documents the workflow, edge cases, manual-run commands, and how the pieces compose

---

## Data Flow

```
Sunday 18:00 ET
  │
  ├─► fetch-economic-calendar.py --week-mode    (existing, extended)
  │       └─► data/economic-calendar.json
  │
  ├─► fetch-earnings-calendar.py --weeks 2      (NEW)
  │       └─► data/earnings-calendar.json
  │
  ├─► fetch-fomc-calendar.py                    (NEW)
  │       └─► data/fomc-calendar.json
  │
  ├─► weekly-catalyst-scan.py                   (NEW orchestrator)
  │       ├─reads► economic-calendar.json
  │       ├─reads► earnings-calendar.json
  │       ├─reads► fomc-calendar.json
  │       ├─reads► events.jsonl (active geopolitical, deadline ≤7d)
  │       ├─reads► expected-moves.json (weekly EMs SPY/QQQ/IWM/DIA + leaders)
  │       └─writes► data/weekly-catalysts.json
  │
  ├─► generate-week-ahead-brief.py              (NEW Tom narrative)
  │       ├─reads► weekly-catalysts.json
  │       ├─reads► agents/tom-fxevolution/{SOUL,RULES,VOCABULARY,FEW_SHOT,MARKET_MEMORY}
  │       └─writes► data/week-ahead.json
  │
  ├─► commit + push (eod-update.sh handles auth/rebase)
  │
  └─► send_message → Telegram preview (optional, via cron deliver=)

Frontend:
  /#week-ahead → js/pages/week-ahead.js
                   ├─loads► weekly-catalysts.json
                   └─loads► week-ahead.json
```

---

## Schema Contracts

### `weekly-catalysts.json` event shape (normalized)

```json
{
  "id": "earn-ACN-2026-06-18",
  "category": "earnings|macro|fed|geopolitical|ipo",
  "title": "Accenture (ACN) Q3 Earnings",
  "context": "Mega-cap services tell — IT services demand proxy. ACN guidance reads through to consulting/tech-services book of business...",
  "deadline": "2026-06-18T13:30:00Z",
  "tickers": ["ACN", "XLK", "XLI"],
  "severity": "high",
  "stars": 3,
  "source": "investing.com|fed.gov|events.jsonl|manual",
  "extra": { "bmo_amc": "BMO", "market_cap_b": 105.65, "forecast": "...", "previous": "..." }
}
```

`context` is the new field — short enriched headline (1-2 sentences) similar to what Idan likes on the IPO cards: *"Largest IPO ever, $75B drain. Forces megacap rebalance..."*. For automated catalysts (econ/earnings/Fed), we templatize the context based on the event class and ticker. For manual events it's already free-form. For Tom-narrative-injected items, the brief writer can supply context.

### Severity classes (consistent across all categories)

- `critical` — FOMC decision, mega-cap earnings (NVDA/AAPL/MSFT/etc) within 7d, CPI/PPI/NFP, mega-IPO day-1
- `high` — Fed speakers, large-cap earnings >$50B, retail sales/PCE, geopolitical with imminent deadline
- `medium` — Mid-cap earnings, PMI, regional Fed, scheduled but distant geopolitical
- `low` — Small-cap earnings, secondary data

---

## Why this isn't a Daily Briefing extension

The existing `generate-briefing.py` runs every 30 minutes off intraday data and is structured around *current* market state (sector rotation, F&G, VIX). The Week Ahead Brief is built around *upcoming events*, runs once a week, has a different output schema, and a different voice ("Sunday-night Tom"). They share Tom's agent files but otherwise have nothing in common — coupling them would force one or the other into a worse shape.

---

## Out of Scope (this change)

- Last-week recap / "what played out" loop — schema-supported (`week_of` indexable), implementation deferred to Phase 2
- Earnings options-implied moves per ticker — already exist on the EM page; week-ahead only references the index EMs
- Dark-pool flow into the catalyst feed — out of scope; tracked elsewhere
- Per-event LLM enrichment for econ data points (CPI commentary, FOMC dot-plot scenario tree) — Phase 2

---

## Testing Strategy

Per dashboard rule 6 — verify locally before pushing.

1. **Unit:** new producers each have a `--dry-run` flag that prints output without writing. Run all 3 producers, eyeball normalized output.
2. **Integration:** run `weekly-catalyst-scan.py` end-to-end, confirm `weekly-catalysts.json` has all 5 categories populated with non-empty arrays.
3. **Narrative:** generate `week-ahead.json` against a real catalyst set; confirm Tom's voice matches existing daily-briefing samples (no AI sterility).
4. **Frontend:** `python3 scripts/serve.py` → `localhost:8888/?nocache=1#week-ahead`. Visual QA via dogfood skill: countdown ticking, all 4 columns populated, mobile responsive.
5. **Headline-context QA:** Check that auto-templatized contexts feel as informative as the manually-curated IPO cards. If not, iterate the templates.

---

## Pitfalls Anticipated (from existing skills + lessons)

- **Investing.com cloudflare challenge** (sometimes returns 18-byte body). Retry with full UA. Existing `fetch-economic-calendar.py` doesn't retry — bake retry into all 3 producers.
- **Earnings deadline timezone** — Investing.com BMO/AMC labels but no time. Convert to 4 PM ET for AMC, 8:30 AM ET for BMO (matches existing watchlist injection in events.js).
- **Fed.gov is HTML, not RSS** — `press_speeches.xml`/`press_calendar.xml` paths return HTML 404 page. Scrape `newsevents/calendar.htm` and `monetarypolicy/fomccalendars.htm` directly.
- **events.jsonl drift** — parent `~/projects/breakingtrades/data/events.jsonl` vs dashboard copy. Read the dashboard copy (canonical for this repo). The geopolitical pull only needs active deadline-bearing events.
- **Watchlist universe is 74-81 tickers** but earnings calendar should pull broader (all US >$10B market cap that week) so we surface ACN/KR/JBL even though they're not in the watchlist.
- **Sunday cron timing** — Investing.com `nextWeek` tab works fine on Sunday (returns Mon-Fri). `thisWeek` on Sunday returns the *current* week which has zero remaining events; skip it on Sunday and use only `nextWeek`.

---

## Acceptance Criteria

- `python3 scripts/weekly-catalyst-scan.py` produces a `weekly-catalysts.json` with all 5 categories populated for the next trading week
- `python3 scripts/generate-week-ahead-brief.py` produces `week-ahead.json` with non-empty headline + thesis + hot_days
- `localhost:8888/#week-ahead` renders all sections, ticking countdowns, no console errors
- Cron `weekly catalyst scan` exists and is enabled, runs Sunday 6pm ET
- Skill `weekly-catalyst-scan` documents the workflow
- OpenSpec INDEX.md row added under Shipped Changes after merge

---

## Follow-ups (not blocking)

- Phase 2: "Last week's recap — what played out" diff against previous `week-ahead.json`
- Phase 2: Per-event LLM enrichment (CPI scenario tree, FOMC dot-plot read)
- Phase 2: Telegram interactive — let Idan reply to the Sunday brief with Q's about a specific catalyst
- Phase 2: Pin the brief to `#signals` and `#market` right-rail
