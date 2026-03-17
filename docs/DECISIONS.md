# Architecture Decisions — Updated Mar 17

## Decision 1: NO Data Duplication

### Problem
The dashboard repo was being set up to duplicate data that already exists in `~/projects/breakingtrades/`:
- 958 CSV files (OHLCV across 5 timeframes)
- `screener.py`, `update_data.py`, `download_data.py` (data pipeline)
- `scrape_tv_watchlist.sh` (watchlist scraping)
- `fxevolution/watchlists/` (dated snapshots)
- `agents/tom-fxevolution/` (full Tom agent config)

### Decision
**The dashboard repo is a PRESENTATION LAYER only.** It reads from the existing BreakingTrades data — it does NOT duplicate or own data.

### What goes WHERE:

| Concern | Location | Repo |
|---------|----------|------|
| Raw market data (CSV) | `~/projects/breakingtrades/data/` | breakingtrades (private, NOT on GitHub) |
| Data pipeline (Python) | `~/projects/breakingtrades/*.py` | breakingtrades (local) |
| Watchlist scraping | `~/projects/breakingtrades/scrape_tv_watchlist.sh` | breakingtrades (local) |
| Tom agent brain (AGENT.md, RULES.json, SOUL.md) | `~/projects/breakingtrades/agents/tom-fxevolution/` | breakingtrades (local) |
| **Dashboard frontend (HTML/CSS/JS)** | `breakingtrades-dashboard/src/` | **breakingtrades-dashboard (GitHub)** |
| **Dashboard JSON snapshots** | `breakingtrades-dashboard/data/` | **breakingtrades-dashboard (GitHub)** |
| **Tom's public analysis output** | `breakingtrades-dashboard/data/tom/` | **breakingtrades-dashboard (GitHub)** |

### Data Flow
```
LOCAL (~/projects/breakingtrades/)          →  DASHBOARD REPO (GitHub Pages)
                                               
data/*.csv                                     
  ↓                                            
screener.py / analyze_batch.py                 
  ↓                                            
EXPORT script (new) ───────────────────────→  data/watchlist.json
  ↓                                            data/setups.json
Tom agent (AGENT.md + context)                 data/tom-briefing.json
  ↓                                            data/macro.json
EXPORT script ─────────────────────────────→  data/tom/*.json
                                               
                                           →  GitHub Pages serves static JSON
                                           →  Frontend fetches JSON at load time
```

### What the export script does:
1. Reads existing CSVs → computes current levels/EMAs/signals
2. Reads watchlist snapshot → maps sections
3. Runs Tom agent → generates daily briefing + per-ticker takes
4. Writes JSON files → commits to dashboard repo → pushes
5. GitHub Pages auto-deploys

**Zero data duplication. Zero new pipelines. Just an export bridge.**

---

## Decision 2: Tom Agent — Use Existing Brain, Don't Rebuild

### Problem
The Opus 4.6 session created a simplified `tom/system-prompt.md` (100 lines) that's a watered-down version of what already exists.

### What already exists:
- `agents/tom-fxevolution/AGENT.md` — 350+ line decision engine with 6-layer stack, current regime read, data sources, indicator priorities
- `agents/tom-fxevolution/SOUL.md` — personality, voice, blind spots
- `agents/tom-fxevolution/RULES.json` — 30+ structured trading rules with priorities
- `agents/tom-fxevolution/TRACK_RECORD.json` — historical calls for validation
- `agents/tom-fxevolution/MARKET_MEMORY.md` — historical analogs
- `agents/tom-fxevolution/DATA_SOURCES.json` — ranked data source priorities
- `agents/tom-fxevolution/VOCABULARY.json` — Tom's actual phrases
- `agents/tom-fxevolution/FEW_SHOT.json` — example outputs for consistency

### Decision
**The dashboard Tom agent is a CONSUMER of the existing agent config, not a replacement.**

The export script will:
1. Load AGENT.md + RULES.json + current watchlist data
2. Feed to LLM with appropriate system prompt
3. Cache output as JSON (daily briefing + per-ticker takes)
4. Dashboard displays cached analysis

The `tom/` directory in dashboard repo will contain:
- `tom/README.md` — explains that Tom's brain lives in the parent repo
- No duplicated methodology docs

---

## Decision 3: Moving Average Configuration — Tom's ACTUAL Setup

### Problem
The current prototype uses EMA 8/21/50 (BreakingTrades system). But Tom's methodology is different:

### Tom's actual indicator usage (from video analysis):
- **Volume** (57 mentions) — #1 indicator
- **Volume Profile** (30 mentions) — #2 
- **SMA 50** (17 mentions) — primary trend MA
- **SMA 20** — "KING for exits" (15+ years using it)
- **Weekly 20 MA** — "most important weekly level" (mean reversion)
- **SMA 100, 150, 200** — longer-term structure

### Decision: Show BOTH systems
**Daily charts show:**
- SMA 20 (solid, bright — Tom's primary)
- SMA 50 (dashed — Tom's trend)
- Weekly 20 MA (dotted, distinct color — Tom's mean reversion level, projected onto daily)

**Weekly charts show:**
- SMA 20 (solid, bright — THE level)
- SMA 50 (dashed)
- SMA 100 (lighter)
- SMA 200 (faintest)

**Styling must be consistent across ALL tickers** — same colors, same line styles, same weights.

### TradingView Widget Config:
```javascript
// Daily chart studies
"studies": [
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 20}},  // SMA 20 — primary
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 50}},  // SMA 50 — trend
  // Weekly 20 MA needs custom overlay or annotation — TV widgets may not support cross-TF MAs
]

// Weekly chart studies  
"studies": [
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 20}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 50}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 100}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 200}},
]
```

**Note:** TradingView free embeds may not support custom MA colors/styles. Research needed on what's configurable.

---

## Decision 4: Setup Tracking — Real-Time Status Engine

### Problem
The dashboard needs to be more than a static report. It needs to track setups in real-time:
- Which setups are **almost ready** (approaching entry zone)?
- Which are **active** (entered, managing position)?
- Which need **stop adjustments** (trailing stops, raising stops)?
- Which **completed** (hit target or stopped out)?

### Setup Lifecycle:
```
WATCHING → APPROACHING → TRIGGERED → ACTIVE → [HIT TARGET | STOPPED OUT | TRAILING]
```

### State Definitions:
| State | Criteria | Dashboard Display |
|-------|----------|-------------------|
| **WATCHING** | On watchlist, bias confirmed, but price not near entry zone | Gray card, levels shown |
| **APPROACHING** | Price within 2% of entry zone | Yellow pulse, "Almost Ready" badge |
| **TRIGGERED** | Price enters defined entry zone | Green flash, "ENTRY ZONE" alert |
| **ACTIVE** | Position entered (manual confirmation or auto-detect) | Green card with live P&L |
| **TRAILING** | Price moved >50% to target, raise stop to breakeven | Blue badge, "Raise Stop" indicator |
| **HIT TARGET** | Price reached T1 or T2 | Gold card, "✅ Target Hit" |
| **STOPPED OUT** | Price hit stop loss | Red card, "❌ Stopped" |

### Trailing Stop Strategy:
- When price reaches 50% of T1 distance → move stop to breakeven
- When price reaches T1 → move stop to 50% of T1 distance above entry
- When price reaches T1 → partial take profits, trail remaining to T2

### Implementation:
- Export script computes current state for each setup based on:
  - Current price vs entry zone, stop, targets
  - Distance calculations
  - Time in zone
- Dashboard shows real-time status cards sorted by urgency:
  1. APPROACHING (action needed soon)
  2. ACTIVE (monitoring)
  3. TRIGGERED (just entered)
  4. WATCHING (patience)
  5. COMPLETED (archive)

---

## Decision 5: OpenSpec Lessons Learned

### From Joaquin's SE Team Meeting (Mar 16):
- OpenSpec is best for **complex multi-service work**, not simple fixes
- Use plan mode for simple changes, OpenSpec for architectural decisions
- The #1 community complaint is **AI doesn't follow the rules** — no enforcement mechanism
- OpenSpec = spec authoring (input to agent), not governance (output enforcement)
- Value for this project: **tracking decisions and specs across sessions** — critical when multiple AI agents (Opus, Gemini, etc.) work on the same codebase

### How we'll use OpenSpec here:
- One proposal per major module (already done: 3 proposals)
- Archive completed changes to track what was built and why
- Use `/opsx:propose` for new features, not for bug fixes or tweaks
- Don't over-spec — specs should be concise decision records, not novels

---

_Updated: 2026-03-17_
