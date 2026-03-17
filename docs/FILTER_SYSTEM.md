# Filter System — BreakingTrades Dashboard

## Problem

The current dashboard has:
- Hardcoded HTML for each card (no data model)
- Dummy filter tabs that do nothing (`// TODO`)
- Cards organized by hardcoded `<div class="section-header">` groups
- No way to filter by status, sector, bias, or any dimension
- No way to sort dynamically
- Section headers are static, don't update when filters change

## Design

### Principle: Data-Driven Rendering

All cards are rendered from a single `SETUPS[]` JavaScript array. No hardcoded HTML for cards. The filter system operates on this array and re-renders.

### Data Model (per ticker)

```javascript
const SETUPS = [
  {
    symbol: "PFE",
    name: "Pfizer",
    sector: "Healthcare",
    direction: "LONG",
    price: 26.61,
    change_pct: -1.4,
    
    // Status (computed by export script, one of:)
    // RETEST | TRIGGERED | APPROACHING | ACTIVE | TRAILING | 
    // TARGET_HIT | EXIT_SMA20 | EXIT_SMA50 | EXIT_W20 | 
    // STOPPED | WATCHING | DORMANT
    status: "RETEST",
    
    // Retest-specific (only when status=RETEST)
    retest: {
      level: "SMA50",          // which level is being retested
      level_price: 26.46,
      distance_pct: 0.6,
      holding: true,           // price > level
      healthy_volume: true,    // retest vol < breakout vol
      confidence: "HIGH",      // HIGH | MEDIUM | LOW
      is_confluence: false,    // multiple levels converging
      confluence_levels: []    // ["SMA20", "SMA50", "W20"] if true
    },
    
    // Bias
    bias: "MIXED",             // BULL | BEAR | MIXED
    
    // Technical levels (all computed)
    sma20: 26.98,
    sma50: 26.46,
    weekly_sma20: 26.06,
    rsi: 43.2,
    pct_from_high: -4.8,
    
    // Level positions relative to price
    above_sma20: false,        // price > sma20
    above_sma50: true,
    above_weekly20: true,
    
    // Setup levels (optional, from setup definition)
    entry_zone: [25.80, 26.20],
    stop_loss: 24.50,
    target_1: 28.00,
    target_2: 29.50,
    
    // Distance metrics (computed)
    distance_to_entry_pct: 1.6,   // how far from entry zone
    distance_to_stop_pct: -8.6,   // how far from stop
    distance_to_t1_pct: 5.2,      // how far from target 1
    
    // Alerts / signals
    signals: [
      "RETEST_SMA50",
      "RSI_NEUTRAL"
    ],
    
    // Analysis text
    analysis: "Healthcare holding relative strength...",
    
    // Metadata
    source: "community_trade",   // community_trade | watchlist | macro | custom
    updated: "2026-03-17T14:00:00Z",
    days_in_status: 2
  },
  // ... more tickers
];
```

---

## Filter Dimensions

### 1. Status Filter (Primary — Tab Bar)

The main filter. Mutually exclusive tabs with counts.

| Tab | Filter Logic | Badge |
|-----|-------------|-------|
| **All** | No filter | Total count |
| **🔥 Hot** | `status in [RETEST, TRIGGERED, APPROACHING]` | Orange badge |
| **🟢 Active** | `status in [ACTIVE, TRAILING, TARGET_HIT]` | Green badge |
| **⚠️ Alerts** | `status in [EXIT_SMA20, EXIT_SMA50, EXIT_W20, STOPPED]` | Red badge |
| **👁 Watch** | `status in [WATCHING, DORMANT]` | Gray badge |

Badge shows filtered count, updates dynamically.

### 2. Sector Filter (Dropdown or Chip Row)

Multi-select chips below the status tabs:

```
[All Sectors] [Technology] [Healthcare] [Energy] [Utilities] [Financials] [Consumer] [Materials] [Crypto]
```

- Click to toggle (multi-select)
- "All Sectors" deselects others
- Any specific sector deselects "All"
- Chips highlight in sector color

### 3. Bias Filter (Inline Toggles)

Three small toggle buttons:

```
[🟢 BULL] [🟡 MIXED] [🔴 BEAR]
```

- All active by default
- Click to toggle off/on
- Dimmed when off
- Multiple can be active

### 4. Direction Filter

```
[📈 LONG] [📉 SHORT] [ALL]
```

### 5. Sort Control

Dropdown or toggle:

| Sort | Logic |
|------|-------|
| **Priority** (default) | Status priority order (RETEST first → DORMANT last) |
| **% Change** | Biggest movers first |
| **Distance to Entry** | Closest to actionable first |
| **RSI** | Extremes first (most overbought/oversold) |
| **Alphabetical** | A-Z |
| **Sector** | Grouped by sector |

### 6. Search

Simple text input that filters by symbol or name:
```
🔍 [Search ticker or name...        ]
```

Instant filter on keyup. Clears with X button.

---

## Filter Bar Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [All 42] [🔥 Hot 7] [🟢 Active 12] [⚠️ Alerts 8] [👁 Watch 15]    │  ← Status tabs
├──────────────────────────────────────────────────────────────────────┤
│ 🔍 [Search...    ]  [BULL] [MIXED] [BEAR]  Sort: [Priority ▾]      │  ← Controls row
│ [All] [Tech] [Health] [Energy] [Utils] [Finance] [Consumer] [Crypto]│  ← Sector chips
└──────────────────────────────────────────────────────────────────────┘
```

Total height: ~80px. Compact but fully functional.

---

## Rendering Logic

### Card Groups

Cards are NOT grouped by hardcoded section headers. Instead, they flow as a flat list with **auto-generated group separators** based on current sort:

- **Sort by Priority:** Group headers by status category (🟠 RETEST, 🟡 APPROACHING, etc.)
- **Sort by Sector:** Group headers by sector name
- **Sort by % Change:** No groups, flat list
- **Sort by RSI:** Groups: "🔴 Overbought (>70)" / "🟡 Neutral" / "🟢 Oversold (<30)"

Group headers show count: `🟠 RETEST (3)` and collapse/expand on click.

### Re-render Pipeline

```javascript
function renderCards() {
  // 1. Start with full SETUPS array
  let filtered = [...SETUPS];
  
  // 2. Apply status filter
  if (activeStatusTab !== 'all') {
    filtered = filtered.filter(s => STATUS_GROUPS[activeStatusTab].includes(s.status));
  }
  
  // 3. Apply sector filter
  if (activeSectors.length > 0 && !activeSectors.includes('all')) {
    filtered = filtered.filter(s => activeSectors.includes(s.sector));
  }
  
  // 4. Apply bias filter
  if (activeBiases.length < 3) {
    filtered = filtered.filter(s => activeBiases.includes(s.bias));
  }
  
  // 5. Apply search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(s => 
      s.symbol.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q)
    );
  }
  
  // 6. Sort
  filtered.sort(SORT_FUNCTIONS[activeSort]);
  
  // 7. Generate group headers
  const groups = groupBy(filtered, activeSort);
  
  // 8. Render HTML
  const container = document.getElementById('card-container');
  container.innerHTML = groups.map(g => 
    renderGroupHeader(g.name, g.items.length) +
    g.items.map(renderCard).join('')
  ).join('');
  
  // 9. Update tab badges
  updateBadgeCounts();
}
```

### Status Priority Order (for sorting)

```javascript
const STATUS_PRIORITY = {
  'RETEST':      0,   // 🟠 highest — the money signal
  'TRIGGERED':   1,   // ✅ just fired
  'APPROACHING': 2,   // 🟡 getting close
  'TRAILING':    3,   // 📈 manage position
  'TARGET_HIT':  4,   // 🎯 take profit
  'EXIT_SMA20':  5,   // ⚠️ warning
  'EXIT_SMA50':  6,   // 🔴 serious
  'EXIT_W20':    7,   // 🔴 critical
  'ACTIVE':      8,   // 🟢 running fine
  'WATCHING':    9,   // 👁 radar
  'STOPPED':     10,  // 🛑 done
  'DORMANT':     11   // ❄️ sleeping
};
```

---

## Card Rendering Variants

Each status has a different card layout optimized for what matters:

### RETEST Card (expanded)
```
┌─🟠─────────────────────────────────────────────────┐
│ PFE    Pfizer · Healthcare                $26.61    │
│ 🟠 RETESTING SMA50 at $26.46 · HIGH CONFIDENCE     │
│ ✅ Holding above · ✅ Low volume retest             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓●▓▓▓▓▓▓▓▓▓▓ range bar   │
│ SMA20 $26.98 ● SMA50 $26.46 ● W20 $26.06 RSI 43   │
│ ┌ Analysis ─────────────────────────────────────┐   │
│ │ PFE SMA50 holding as support. Compression...  │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### EXIT Card (compact + warning)
```
┌─🔴─────────────────────────────────────────────────┐
│ MSFT   Microsoft · Technology             $399.95   │
│ ⚠️ EXIT — Below SMA20 ($400.10) · BEAR             │
│ ▓▓▓▓ all MAs above · SMA50 $427 · W20 $440         │
└─────────────────────────────────────────────────────┘
```

### WATCHING Card (minimal)
```
┌─── ─────────────────────────────────────────────────┐
│ GOOG   Alphabet                           $308.57   │
│ 👁 MIXED · Just above SMA20 ($306.80) · RSI 48     │
└─────────────────────────────────────────────────────┘
```

### DORMANT Card (collapsed single line)
```
│ CHTR  Charter · -22% · MIXED · dormant 25 sessions  │
```

---

## URL State

Filter state persists in URL hash so you can share/bookmark:

```
#status=hot&sectors=Healthcare,Energy&bias=BULL&sort=priority&search=PFE
```

Parse on load, update on every filter change.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-5` | Switch status tab (1=All, 2=Hot, 3=Active, 4=Alerts, 5=Watch) |
| `/` | Focus search |
| `Escape` | Clear search / close modal |
| `B` | Toggle BULL bias |
| `M` | Toggle MIXED bias |
| `R` | Toggle BEAR bias (or mnemonic: "Red") |
| `S` | Cycle sort mode |
| `↑/↓` | Navigate cards |
| `Enter` | Open selected card detail |

---

## Badge Count Logic

Badges update on every filter change to show counts WITHIN the active filter context:

```javascript
function updateBadgeCounts() {
  // Counts are always against the FULL dataset (not further filtered)
  // So "Hot (7)" always means 7 hot items total, regardless of sector filter
  const counts = {
    all: SETUPS.length,
    hot: SETUPS.filter(s => ['RETEST','TRIGGERED','APPROACHING'].includes(s.status)).length,
    active: SETUPS.filter(s => ['ACTIVE','TRAILING','TARGET_HIT'].includes(s.status)).length,
    alerts: SETUPS.filter(s => s.status.startsWith('EXIT_') || s.status === 'STOPPED').length,
    watch: SETUPS.filter(s => ['WATCHING','DORMANT'].includes(s.status)).length,
  };
  
  // But ALSO show filtered count when sector/bias/search active:
  // "Hot (3/7)" means 3 match current filters out of 7 total hot
}
```

---

## Empty States

When a filter combination returns 0 results:

```
┌─────────────────────────────────────────┐
│                                         │
│    No setups match current filters      │
│                                         │
│    Try: [Clear all filters]             │
│                                         │
└─────────────────────────────────────────┘
```

---

## Responsive (Mobile)

On mobile (< 768px):
- Status tabs become horizontal scroll
- Sector chips become horizontal scroll
- Bias/sort row stacks vertically
- Search goes full width
- Cards render without range bars (too small)
- Tap card → full-screen detail (not modal)

---

## Timezone Selection

Users across different timezones (e.g. Israel IST, UK GMT, US ET/CT/PT) should see all time-related data in their local timezone.

### Affected Elements

| Element | Default (ET) | Behavior |
|---------|-------------|----------|
| Top bar timestamp | `Mar 17, 2026 • 2:15 PM ET` | Converts to selected TZ |
| TradingView chart widgets | `America/New_York` | Pass selected TZ to widget `timezone` param |
| "Last updated" on cards | `Updated 2:30 PM` | Converts to selected TZ |
| Daily briefing date header | `Daily Briefing — Mar 17` | Date may shift for TZ ahead of ET (after midnight ET) |
| Data pipeline timestamps (JSON) | Always stored as UTC ISO-8601 | Converted client-side |

### UI — Timezone Picker

Location: **top bar**, right side, next to the market open/closed indicator.

```
Market: OPEN  |  🕐 ET ▾  |  Mar 17, 2026 • 2:15 PM ET
```

Dropdown options (most common trading timezones):

| Label | IANA Timezone | Offset (winter) |
|-------|--------------|-----------------|
| ET (New York) | `America/New_York` | UTC-5 |
| CT (Chicago) | `America/Chicago` | UTC-6 |
| PT (Los Angeles) | `America/Los_Angeles` | UTC-8 |
| GMT (London) | `Europe/London` | UTC+0 |
| CET (Frankfurt) | `Europe/Berlin` | UTC+1 |
| IST (Israel) | `Asia/Jerusalem` | UTC+2 |
| JST (Tokyo) | `Asia/Tokyo` | UTC+9 |
| AEST (Sydney) | `Australia/Sydney` | UTC+11 |
| UTC | `UTC` | UTC+0 |

### Behavior

1. **Default:** Auto-detect from browser via `Intl.DateTimeFormat().resolvedOptions().timeZone`. If the detected TZ matches one of the preset options, select it. Otherwise default to `America/New_York` (market TZ).
2. **Persistence:** Save selection to `localStorage` key `bt_timezone`. On load, restore from localStorage before auto-detect.
3. **On change:**
   - Re-format all displayed timestamps using the new TZ
   - Destroy and recreate TradingView widgets with the new `timezone` parameter
   - Update URL hash: `#tz=Asia/Jerusalem&...`
4. **Market status indicator** (`OPEN`/`CLOSED`/`PRE-MARKET`/`AFTER-HOURS`) is always based on NYSE hours in ET — not affected by user timezone. The label should clarify: `Market: OPEN (NYSE)`.

### Implementation

```javascript
// Timezone state
const TZ_OPTIONS = [
  { label: 'ET', tz: 'America/New_York' },
  { label: 'CT', tz: 'America/Chicago' },
  { label: 'PT', tz: 'America/Los_Angeles' },
  { label: 'GMT', tz: 'Europe/London' },
  { label: 'CET', tz: 'Europe/Berlin' },
  { label: 'IST', tz: 'Asia/Jerusalem' },
  { label: 'JST', tz: 'Asia/Tokyo' },
  { label: 'AEST', tz: 'Australia/Sydney' },
  { label: 'UTC', tz: 'UTC' }
];

let userTZ = localStorage.getItem('bt_timezone')
  || detectBrowserTZ()
  || 'America/New_York';

function formatTime(isoString) {
  return new Date(isoString).toLocaleString('en-US', {
    timeZone: userTZ,
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' ' + getTZLabel(userTZ);
}

function detectBrowserTZ() {
  const browserTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const match = TZ_OPTIONS.find(o => o.tz === browserTZ);
  return match ? match.tz : null;
}

function getTZLabel(tz) {
  const match = TZ_OPTIONS.find(o => o.tz === tz);
  return match ? match.label : 'ET';
}
```

### TradingView Widget Integration

When creating widgets, pass the user's timezone:

```javascript
new TradingView.widget({
  // ...existing config...
  timezone: userTZ,  // was hardcoded 'America/New_York'
});
```

When user changes timezone and modal is open, destroy and recreate both charts with the new TZ.

---

## Implementation Notes

1. **All cards rendered from JS** — no hardcoded card HTML in the page
2. **Section headers are dynamic** — generated from current group logic
3. **Filter state is reactive** — any filter change triggers full re-render
4. **Debounced search** — 150ms debounce on keyup
5. **Smooth transitions** — cards fade in/out on filter change (CSS `transition: opacity 0.15s`)
6. **Counts use `SETUPS.length`** — always reflect true data, not DOM counting
7. **URL hash sync** — read on load, write on change (debounced 300ms)
