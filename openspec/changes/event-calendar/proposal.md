# Event Calendar — Proposal

> **Status:** Planned  
> **Priority:** High  
> **Created:** 2026-03-22  
> **Phase:** 1 (static) → 2 (service)

---

## Problem

The dashboard has no way to surface time-sensitive market events — geopolitical deadlines, macro data releases, Fed speak, or analyst-flagged catalysts. These events are currently trapped in free-form markdown recaps or not captured at all. Traders miss context that directly affects position sizing and timing decisions.

---

## Solution

A dedicated **Events & Calendar** page (`events.html`) that aggregates market-moving events from two internal pipelines and renders them as a live countdown calendar — always visible, always current.

---

## Data Flow

```
┌─ FEEDER 1: Video Analysis Pipeline ────────────────────┐
│                                                        │
│  pull-and-transcribe.sh                                │
│    └── generate_recap()         ← already runs        │
│    └── extract_events()         ← NEW: 2nd LLM pass   │
│          prompt: "extract time-sensitive events        │
│          with deadlines from this transcript"          │
│          output: structured JSON                       │
│          → appends to data/events.jsonl                │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ FEEDER 2: Market Watcher Daily Brief ─────────────────┐
│                                                        │
│  market-watcher.py                                     │
│    └── generates market-picture.md  ← already runs    │
│    └── extract_events_from_brief()  ← NEW: LLM pass   │
│          prompt: "from this market brief, extract      │
│          upcoming macro catalysts and data releases    │
│          traders should watch in the next 7 days"      │
│          output: structured JSON                       │
│          → appends to data/events.jsonl                │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ FEEDER 3: Trump / Political News Monitor ─────────────┐
│                                                        │
│  trump-monitor.py  (cron every 15min)                  │
│    Source: Google News RSS                             │
│    Queries:                                            │
│      - "Trump site:truthsocial.com" (direct posts)     │
│      - "Trump tariffs OR Iran OR Fed OR economy"       │
│      - "Trump executive order OR sanctions OR deal"    │
│    Flow:                                               │
│      fetch RSS → dedupe by URL hash → LLM classify    │
│      → if market_impact score >= threshold             │
│      → append to data/events.jsonl                     │
│                                                        │
│  Why Google News RSS (not direct Truth Social):        │
│    - Truth Social: Cloudflare-blocked, no public RSS   │
│    - X/Twitter: requires paid API auth                 │
│    - Google News RSS: free, no auth, proven reliable,  │
│      indexes Truth Social posts within minutes,        │
│      same pattern used by Iran-Israel watcher          │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ FEEDER 4: Manual Injection ───────────────────────────┐
│                                                        │
│  bt-event CLI                                          │
│    bt-event add "Trump Hormuz ultimatum"               │
│              --deadline "2026-03-23T23:44:00Z"         │
│              --category geopolitical                   │
│              --severity critical                       │
│              --tickers CL,GC,USO,XLE,SPY               │
│    → appends to data/events.jsonl                      │
│                                                        │
└────────────────────────────────────────────────────────┘

          All three feeders write to:
          ~/projects/breakingtrades/data/events.jsonl
                          │
                          ▼
          Dashboard reads via fetch('./data/events.jsonl')
```

---

## Event Schema (JSONL — one object per line)

```json
{
  "id": "uuid-v4",
  "title": "Trump Hormuz Ultimatum",
  "category": "geopolitical",
  "severity": "critical",
  "deadline": "2026-03-23T23:44:00Z",
  "created": "2026-03-21T23:44:00Z",
  "source": "manual",
  "source_ref": "internal_id_never_displayed",
  "market_impact": "Oil (CL) and Gold (GC) bullish on escalation risk. SPY bearish.",
  "tickers": ["CL", "GC", "USO", "XLE", "SPY"],
  "countdown": true,
  "status": "active",
  "notes": "48h deadline posted Mar 21 7:44 PM ET"
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `title` | string | Short display title (max 60 chars) |
| `category` | enum | `geopolitical \| macro \| fed \| earnings \| technical \| analyst_flag` |
| `severity` | enum | `critical \| high \| medium \| low` |
| `deadline` | ISO8601 | When the event fires/expires (UTC) |
| `created` | ISO8601 | When this entry was created |
| `source` | enum | `video_analysis \| market_brief \| manual \| macro_api` |
| `source_ref` | string | Internal ID only — never displayed in UI |
| `market_impact` | string | LLM-generated or manual impact summary |
| `tickers` | string[] | Affected tickers/ETFs |
| `countdown` | bool | Show live countdown clock |
| `status` | enum | `active \| expired \| resolved` |
| `notes` | string | Optional additional context |

### Category Colors

| Category | Color | Examples |
|----------|-------|---------|
| `geopolitical` | 🔴 `#ef5350` | Hormuz ultimatum, sanctions, strikes |
| `macro` | 🟡 `#ffd700` | PCE, CPI, NFP, GDP |
| `fed` | 🔵 `#42a5f5` | FOMC, Powell speech, rate decision |
| `earnings` | 🟢 `#00d4aa` | Key earnings (NVDA, AAPL, etc.) |
| `technical` | 🟣 `#ab47bc` | 200DMA test, gamma flip, key level |
| `analyst_flag` | ⚪ `#e0e0e8` | Video analysis flags |

---

## Dashboard Page: `events.html`

### Layout (two-column)

```
╔══════════════════════════════════════════════════════════════╗
║  📅 EVENTS & CALENDAR     [All] [Geo] [Macro] [Fed] [+Add]  ║
╠═══════════════════════════╦══════════════════════════════════╣
║  LIVE COUNTDOWNS          ║  UPCOMING — NEXT 7 DAYS         ║
║  (critical/high only)     ║  (timeline view)                ║
║                           ║                                  ║
║  🔴 Trump Hormuz DL       ║  MON 23  🔴 Hormuz deadline     ║
║  ⏳ 43h 22m 18s  [pulse]  ║  FRI 28  🟡 PCE Inflation       ║
║  CL↑ GC↑ USO↑ SPY↓       ║  MON 31  🟡 ISM Manufacturing   ║
║                           ║  TUE 01  🔵 Powell @ BIS        ║
╠═══════════════════════════╬══════════════════════════════════╣
║  VIDEO ANALYSIS INTEL     ║  RESOLVED / EXPIRED             ║
║  (analyst_flag events)    ║  (collapsed, last 7 days)       ║
║                           ║                                  ║
║  📊 200DMA break          ║  ✅ Tariff pause · Mar 18        ║
║  60-100d bottom window    ║  ✅ FOMC · Mar 19                ║
║  IVV distribution signal  ║                                  ║
╚═══════════════════════════╩══════════════════════════════════╝
```

### Mini Strip (index.html)
Compact event strip injected above Signals cards. Shows next 2-3 critical/high events with countdown. Links to `events.html`.

```
⚠️ NEXT: Trump Hormuz DL — 43h 22m  |  PCE — 5d 6h  [→ Full Calendar]
```

---

## Files to Build

### Phase 1 (static JSONL — no running service)

| File | Location | Purpose |
|------|----------|---------|
| `events.jsonl` | `data/events.jsonl` (parent repo) | Event store — canonical source of truth |
| `events.jsonl` | `breakingtrades-dashboard/data/events.jsonl` | Dashboard copy (symlink or export script) |
| `extract-events.py` | `scripts/extract-events.py` (parent repo) | LLM event extractor (video + brief) |
| `bt-event` | `scripts/bt-event` (parent repo) | CLI: add / list / resolve / expire |
| `trump-monitor.py` | `scripts/trump-monitor.py` (parent repo) | Polls Google News RSS every 15min → LLM classifies → `events.jsonl` |
| `events.js` | `breakingtrades-dashboard/js/events.js` | Dashboard renderer + countdown engine |
| `events.html` | `breakingtrades-dashboard/events.html` | Full calendar page |
| Edit `nav.js` | `breakingtrades-dashboard/js/nav.js` | Add Events to nav |
| Edit `index.html` | `breakingtrades-dashboard/index.html` | Add mini strip above signals |
| Edit `pull-and-transcribe.sh` | parent repo | Call extract-events.py after recap |
| Edit `market-watcher.py` | `market-watcher/market-watcher.py` | Call extract_events after daily brief |
| Edit `pull-and-transcribe.sh` | parent repo | Call extract-events.py after recap |
| Edit `market-watcher.py` | `market-watcher/market-watcher.py` | Call extract_events after daily brief |

### Phase 2 (service upgrade — drop-in)
- Add `/events` GET endpoint to market-watcher Flask/FastAPI
- Add external calendar API polling (FRED release schedule, Investing.com RSS)
- Dashboard `fetch()` URL switches from static file → API endpoint
- Zero change to `events.jsonl` schema or dashboard JS logic

---

## LLM Extraction Prompts

### Video Analysis Extractor
```
From this market analysis transcript, extract all time-sensitive events
that traders should track. For each event return JSON array:
[{
  "title": "...",          // max 60 chars, no source attribution
  "deadline": "ISO8601",   // specific date/time or null if fuzzy
  "deadline_fuzzy": "...", // "within 48 hours", "this week", etc.
  "category": "geopolitical|macro|fed|earnings|technical|analyst_flag",
  "severity": "critical|high|medium|low",
  "market_impact": "...",  // 1 sentence
  "tickers": ["..."]
}]
Only include events with a specific or approximate deadline.
Return [] if none found.
```

### Market Brief Extractor
```
From this daily market brief, extract upcoming macro events and data
releases traders should watch in the next 7-10 days. Return JSON array
(same schema). Include: earnings, Fed events, economic data releases,
key technical levels being tested. Return [] if none found.
```

---

## CLI Reference (`bt-event`)

```bash
bt-event add "Trump Hormuz ultimatum" \
  --deadline "2026-03-23T23:44:00Z" \
  --category geopolitical \
  --severity critical \
  --tickers CL,GC,USO,XLE,SPY \
  --impact "Oil and gold bullish on escalation risk"

bt-event list                    # all active
bt-event list --category macro   # filter
bt-event resolve <id>            # mark resolved
bt-event expire                  # auto-expire past deadlines
```

---

## Constraints

- **No external source attribution in UI** — source/source_ref are internal only
- **No FXEvolution references** — video analysis events appear as "Video Analysis Intel"
- **Schema is frozen at v1** — Phase 2 service must be backward compatible
- **events.jsonl is append-only** — use `status: expired/resolved` not deletion
- **Dashboard is read-only** — all writes go through scripts/CLI, never from browser JS

---

## Success Criteria

- [ ] `trump-monitor.py` runs on 15min cron, classifies Trump/political news via LLM → `events.jsonl`
- [ ] Trump Hormuz ultimatum visible on `events.html` with live countdown
- [ ] Mini strip on `index.html` shows next critical event
- [ ] `bt-event add` successfully appends to `events.jsonl`
- [ ] `pull-and-transcribe.sh` auto-runs `extract-events.py` after recap
- [ ] `market-watcher.py` auto-runs event extraction after daily brief
- [ ] Events page added to nav (`nav.js`)
- [ ] No FXEvolution/external source names visible in any UI element
