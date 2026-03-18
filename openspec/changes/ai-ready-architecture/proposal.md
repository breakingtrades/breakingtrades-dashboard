# AI-Ready Architecture — Tom Agent Dashboard Integration

> Status: **Proposed** | Priority: **High** | Created: 2026-03-18

## Problem

Tom (our FXEvolution AI agent) currently generates one static daily briefing (`data/briefing.json`) during CI. He has no way to:

1. Push real-time alerts or intraday insights to the dashboard
2. Annotate specific tickers, charts, or sectors with commentary
3. Respond to user questions interactively
4. Surface structured trade ideas beyond the morning briefing
5. Highlight what changed since the last data refresh

The dashboard is **data-rich but insight-poor** — all the numbers are there, but Tom's voice is limited to a single text block.

## Vision

Make the dashboard a **living surface** that Tom can write to at any time. The user opens the dashboard and sees what Tom thinks is important *right now* — not just what he said at 6:30 AM.

**Design principle:** Tom writes JSON files. The dashboard reads JSON files. No backend, no WebSocket, no server. GitHub Pages + static JSON + CI = the entire stack.

## Architecture

### Data Contract: `data/tom/*.json`

Tom's output lives in a dedicated namespace. Each file is a different "channel" Tom can publish to:

```
data/tom/
├── briefing.json        # Daily briefing (migrated from data/briefing.json)
├── alerts.json          # Intraday alerts & callouts (array, newest first)
├── ticker-notes.json    # Per-ticker commentary keyed by symbol
├── market-pulse.json    # Structured market read (regime, bias, key levels)
└── chat-history.json    # Recent Q&A if chat widget is enabled
```

### File Schemas

#### `alerts.json` — Tom's Alert Feed
```json
[
  {
    "id": "2026-03-18-001",
    "timestamp": "2026-03-18T14:32:00Z",
    "type": "alert|insight|callout|warning",
    "severity": "info|watch|urgent",
    "title": "SPY broke below SMA20 — first close below in 3 weeks",
    "body": "The 20 MA at $678.96 was the line in the sand...",
    "tickers": ["SPY"],
    "sectors": ["XLK", "XLF"],
    "expires": "2026-03-19T09:30:00Z",
    "pinned": false
  }
]
```

#### `ticker-notes.json` — Per-Ticker Tom's Take
```json
{
  "NVDA": {
    "updatedAt": "2026-03-18T15:00:00Z",
    "bias": "bearish",
    "note": "Death cross forming, SMA20 < SMA50. Volume declining on bounces...",
    "keyLevels": "$820 support, $875 resistance",
    "setup": null
  },
  "AAPL": {
    "updatedAt": "2026-03-18T15:00:00Z",
    "bias": "neutral",
    "note": "Falling wedge forming. RSI 34 — oversold but no reversal signal yet.",
    "keyLevels": "$210 support, $228 SMA20",
    "setup": "watching for SMA20 reclaim"
  }
}
```

#### `market-pulse.json` — Structured Market Read
```json
{
  "updatedAt": "2026-03-18T15:30:00Z",
  "regime": "risk-off",
  "regimeScore": -2,
  "bias": "bearish",
  "biasReason": "VIX above SMA20, F&G Extreme Fear, breadth deteriorating",
  "keyLevels": {
    "SPY": { "support": 655, "resistance": 679, "pivotNote": "SMA20 rejection" },
    "QQQ": { "support": 580, "resistance": 605, "pivotNote": "Below all major MAs" }
  },
  "sectorView": {
    "leading": ["XLE", "XLU"],
    "weakening": ["XLB", "XLI"],
    "lagging": ["XLK", "XLY", "XLV"],
    "improving": ["XLF", "XLRE"]
  },
  "oneLineSummary": "Risk-off regime. Energy and utilities leading, tech and discretionary lagging. VIX elevated at 25."
}
```

### UI Components

#### 1. Tom's Alert Banner (all pages)
A slim, dismissible banner at the top of every page showing Tom's most recent urgent alert.

```
┌─────────────────────────────────────────────────────────┐
│ ⚡ TOM: SPY broke SMA20 — first close below in 3 weeks │ 14:32 ET  ✕
└─────────────────────────────────────────────────────────┘
```

- Reads `data/tom/alerts.json`, shows newest non-expired alert with `severity: urgent`
- Colored by severity: `urgent` = red border, `watch` = orange, `info` = blue
- Dismissible per session (localStorage)
- Max 1 banner visible at a time

#### 2. Tom's Feed Panel (Signals page sidebar)
Replace or augment the current briefing section with a scrollable feed of Tom's recent activity:

```
┌── TOM'S FEED ──────────────────┐
│                                 │
│ 📋 DAILY BRIEFING  6:30 AM     │
│ Tech cracking at SMA20...      │
│ [Read more]                     │
│                                 │
│ ⚡ ALERT  2:32 PM               │
│ SPY broke SMA20                 │
│                                 │
│ 💡 INSIGHT  11:15 AM            │
│ XLE relative strength at 132    │
│ — strongest since Oct 2024      │
│                                 │
│ 🎯 SETUP  10:00 AM             │
│ AAPL falling wedge watch        │
│ Entry: $228 (SMA20 reclaim)     │
│                                 │
└─────────────────────────────────┘
```

- Chronological feed, newest first
- Sources: `alerts.json` + `briefing.json` merged by timestamp
- Each item expandable inline
- Feed auto-refreshes on page load (no polling — static JSON)

#### 3. Tom's Take in Ticker Cards (Signals page)
If `ticker-notes.json` has an entry for a ticker, show a "Tom's Take" section in the card:

```
┌── NVDA ─────────────────────────┐
│ $835.10  ▼ -1.2%   🔴 Bearish  │
│                                  │
│ ┌─ TOM'S TAKE ───────────────┐  │
│ │ Death cross forming.        │  │
│ │ Key: $820 support, $875 res │  │
│ │ Updated 3:00 PM             │  │
│ └────────────────────────────-┘  │
│                                  │
│ Entry: $850 · Stop: $820        │
│ T1: $900 (+5.3%)                │
└──────────────────────────────────┘
```

- Bias color-coded: bullish=green, bearish=red, neutral=gray
- Collapsed by default on mobile, visible on desktop
- Falls back gracefully if no note exists for that ticker

#### 4. Tom's Take in Watchlist Detail Modal
Same `ticker-notes.json` data surfaces in the watchlist detail modal (the one shipped in `42a220a`):

- New card below "Volatility & Volume": **"Tom's Analysis"**
- Shows bias badge, note text, key levels, setup if any
- If no note exists: card hidden (not empty state)

#### 5. Market Pulse Widget (Market page)
A compact structured summary card replacing/augmenting the "Market Regime" section:

```
┌── MARKET PULSE ─────────────────────────┐
│                                          │
│  REGIME: RISK-OFF  ●  BIAS: BEARISH     │
│                                          │
│  "Risk-off regime. Energy and utilities  │
│   leading, tech lagging. VIX at 25."    │
│                                          │
│  KEY LEVELS                              │
│  SPY  $655 support · $679 resistance     │
│  QQQ  $580 support · $605 resistance     │
│                                          │
│  SECTOR VIEW                             │
│  Leading: XLE XLU                        │
│  Lagging: XLK XLY XLV                   │
│                                          │
│  Updated 3:30 PM ET                      │
└──────────────────────────────────────────┘
```

- Reads `data/tom/market-pulse.json`
- Regime badge color: risk-on=green, neutral=yellow, risk-off=red
- Falls back to current hardcoded "LATE CYCLE" if file missing

#### 6. Tom Chat Widget (Future — Phase 3)
Interactive chat overlay, bottom-right corner. User types a question, Tom answers from pre-computed context + live dashboard data.

**Deferred** — requires either:
- Client-side LLM call (GitHub Models API with user's PAT)
- Pre-generated FAQ responses in JSON
- Or a lightweight serverless function

For now, the static feed + annotations cover 80% of the value.

### Generation Pipeline

#### Current Flow (briefing only)
```
CI cron 6:30 AM → generate-briefing.py → data/briefing.json → git push → Pages deploy
```

#### New Flow (multi-channel)
```
CI cron 6:30 AM → generate-tom-outputs.py → data/tom/*.json → git push → Pages deploy
                                              ├── briefing.json
                                              ├── alerts.json
                                              ├── ticker-notes.json
                                              └── market-pulse.json
```

Single script, one LLM call with structured output (JSON mode), writes all files.

**Prompt structure:**
```
You are Tom. Here is today's market data: {all dashboard JSON}

Generate the following outputs as a JSON object:
1. briefing: {title, headline, body[], callout_title, callout_body, action_items[], closing_quote}
2. alerts: [{type, severity, title, body, tickers[], sectors[]}]  — only if something noteworthy
3. ticker_notes: {SYMBOL: {bias, note, keyLevels, setup}} — for top 10-15 most interesting tickers
4. market_pulse: {regime, bias, biasReason, keyLevels, sectorView, oneLineSummary}
```

**Token budget:** ~25K input (dashboard data + persona), ~4K output. Well within GPT-4.1's 128K context.

#### Intraday Updates (Optional — Phase 2)
If Mac cron pushes fresh IB data mid-day, a second CI run can:
1. Diff current data vs morning snapshot
2. Generate only `alerts.json` updates (what changed)
3. Append to existing alerts, don't regenerate everything

Trigger: `workflow_dispatch` or scheduled at 12:30 PM ET.

### Migration Plan

1. Create `data/tom/` directory
2. Move `data/briefing.json` → `data/tom/briefing.json` (update all references)
3. Update `generate-briefing.py` → `generate-tom-outputs.py` (single script, multi-output)
4. Update CI workflow to write to new paths
5. Dashboard JS reads from `data/tom/` namespace

**Backward compat:** During migration, `generate-tom-outputs.py` can write both old and new paths.

## Phases

### Phase 1: Data Foundation (2-3 hours)
- [ ] Create `data/tom/` directory structure
- [ ] Define JSON schemas (TypeScript-style JSDoc in a `schemas.md` doc)
- [ ] Refactor `generate-briefing.py` → `generate-tom-outputs.py`
- [ ] Generate all 4 output files from single LLM call (structured JSON output)
- [ ] Update CI workflow
- [ ] Migrate briefing.json path references in index.html

### Phase 2: Dashboard UI (3-4 hours)
- [ ] Tom's Alert Banner component (all pages) — `js/tom-alerts.js`
- [ ] Tom's Feed Panel on Signals page (replace static briefing section)
- [ ] Tom's Take section in ticker cards (index.html)
- [ ] Tom's Take card in watchlist detail modal (watchlist.html)
- [ ] Market Pulse widget on Market page (market.html)
- [ ] Graceful fallbacks when files missing/empty

### Phase 3: Intelligence Layer (future)
- [ ] Intraday alert generation (mid-day CI run on data change)
- [ ] Data diff engine (what changed since morning)
- [ ] Tom Chat Widget (interactive Q&A — needs arch decision on LLM hosting)
- [ ] Tom's trade journal — historical log of calls + outcomes
- [ ] Push notifications via Telegram when urgent alerts generated

## Design Principles

1. **Tom writes JSON. Dashboard reads JSON.** No runtime AI calls from the browser. All intelligence is pre-computed.
2. **Graceful degradation.** Every Tom component checks if its data file exists. Missing file = component hidden, not broken.
3. **Single LLM call.** One prompt, one API call, all outputs. Keeps costs near zero and latency low.
4. **Namespace isolation.** All Tom data in `data/tom/`. Easy to gitignore, easy to wipe, easy to version.
5. **Timestamp everything.** Every Tom output has `updatedAt`. Dashboard shows staleness.
6. **No backend.** This is a GitHub Pages site. The "server" is CI + git push.

## Cost Estimate

- GPT-4.1 via GitHub Models: **$0/day** (free with Copilot Enterprise PAT)
- One call/day: ~25K input + ~4K output = ~29K tokens
- Even at paid rates: ~$0.03/day ($0.90/month)

## Files Affected

| File | Change |
|------|--------|
| `scripts/generate-tom-outputs.py` | New (replaces generate-briefing.py) |
| `js/tom-alerts.js` | New — alert banner + feed panel |
| `js/tom-ticker.js` | New — ticker card/modal annotations |
| `data/tom/*.json` | New — all Tom output files |
| `index.html` | Briefing section → feed panel, ticker cards get Tom's Take |
| `market.html` | Market Pulse widget replaces hardcoded regime |
| `watchlist.html` | Detail modal gets Tom's Analysis card |
| `.github/workflows/daily-briefing.yml` | Updated to call new script, write new paths |
| `docs/MULTI_PAGE_ARCHITECTURE.md` | Updated with Tom integration layer |
