# Design: Dashboard Frontend

## Chart Configuration — Tom's Moving Averages

### Daily Chart
| MA | Type | Style | Color | Purpose |
|----|------|-------|-------|---------|
| SMA 20 | Simple | Solid, 2px | `#00d4aa` (cyan) | Tom's primary — "King for exits" |
| SMA 50 | Simple | Dashed, 1.5px | `#ffa726` (orange) | Trend direction |
| Weekly SMA 20 | Simple | Dotted, 2px | `#ab47bc` (purple) | Mean reversion level (projected onto daily) |

### Weekly Chart
| MA | Type | Style | Color | Purpose |
|----|------|-------|-------|---------|
| SMA 20 | Simple | Solid, 2px | `#00d4aa` (cyan) | THE weekly level |
| SMA 50 | Simple | Dashed, 1.5px | `#ffa726` (orange) | Intermediate trend |
| SMA 100 | Simple | Dotted, 1px | `#78909c` (gray) | Structure |
| SMA 200 | Simple | Dotted, 1px | `#546e7a` (dim gray) | Long-term trend |

### TradingView Widget Studies Config
```javascript
// Daily
"studies": [
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 20}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 50}},
  "RSI@tv-basicstudies"
]

// Weekly
"studies": [
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 20}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 50}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 100}},
  {"id": "MASimple@tv-basicstudies", "inputs": {"length": 200}}
]
```

**Note:** Free TradingView embeds have limited style control. MA colors/line styles may not be configurable via the widget API. We may need to:
1. Accept TV's default MA colors (research what's available)
2. Add a legend/key explaining which MA is which
3. Consider TradingView Lightweight Charts library for full control (more work but full styling)

### Weekly SMA 20 on Daily Chart
TradingView embeds don't support cross-timeframe MAs natively. Options:
- **Option A:** Pre-compute weekly SMA 20 value and display as horizontal line annotation (static, updates daily)
- **Option B:** Use TradingView Lightweight Charts (open-source, full control) instead of embeds for the main chart
- **Option C:** Show weekly chart side-by-side with its own SMA 20 (current approach, simpler)

**Recommendation:** Option C for MVP (side-by-side), explore Option B for v2.

---

## Page Structure

### Home — Watchlist Grid
```
┌─────────────────────────────────────────────────────────┐
│ Ticker Tape (scrolling)                                  │
├──────┬──────────────────────────────────────────────────┤
│      │  ┌─── Status Filter ──────────────────────────┐  │
│  S   │  │ ALL | APPROACHING | ACTIVE | WATCHING      │  │
│  I   │  └────────────────────────────────────────────┘  │
│  D   │                                                   │
│  E   │  ┌── Approaching (urgent) ─────────────────┐    │
│  B   │  │  🟡 D    $63.60  Entry: $62.50  1.7% away │  │
│  A   │  │  🟡 ADM  $72.34  Entry: $70.00  3.2% away │  │
│  R   │  └─────────────────────────────────────────────┘  │
│      │                                                   │
│  N   │  ┌── Active (monitoring) ──────────────────┐    │
│  A   │  │  🟢 XLU  $47.30  +2.1%  Trail stop      │  │
│  V   │  │  🟢 AR   $41.35  +1.8%                   │  │
│      │  └─────────────────────────────────────────────┘  │
│      │                                                   │
│      │  ┌── Watching ─────────────────────────────┐    │
│      │  │  ⚪ NEE  $92.55  BULL  5.2% to entry     │  │
│      │  │  ⚪ DELL $154.01 BULL  8.0% to entry     │  │
│      │  └─────────────────────────────────────────────┘  │
├──────┴──────────────────────────────────────────────────┤
│  Macro Bar: VIX 22.5 | DXY 103.5 | 10Y 4.25 | XLY/XLP↓│
└─────────────────────────────────────────────────────────┘
```

### Ticker Detail Page
```
┌─────────────────────────────────────────────────────────┐
│ ← Back    D — Dominion Energy    🟢 BULLISH    $63.60   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Daily Chart (SMA 20/50 + RSI) ──────────────────┐ │
│  │                                                     │ │
│  │              [TradingView Widget]                    │ │
│  │                   600px                              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Weekly Chart (SMA 20/50/100/200) ───────────────┐ │
│  │              [TradingView Widget]                    │ │
│  │                   500px                              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Setup Status ───────┐  ┌── Tom's Take ──────────┐ │
│  │  Status: APPROACHING   │  │  "Bullish SMA stack.    │ │
│  │  Entry: $62.50-63.00   │  │   Entry on pullback to  │ │
│  │  Stop: $61.50          │  │   SMA20. Utilities show  │ │
│  │  T1: $66.86  T2: $70   │  │   relative strength..."  │ │
│  │  R:R: 1:3              │  │  Action: WATCH for pull  │ │
│  │  [Visual Range Bar]    │  │  Key level: $63.14 SMA20│ │
│  └────────────────────────┘  └─────────────────────────┘ │
│                                                          │
│  ┌── Key Levels ─────────────────────────────────────┐  │
│  │  SMA20: $63.14  SMA50: $61.96  Weekly20: $62.50   │  │
│  │  6mo Hi: $66.86  6mo Lo: $55.26  RSI: 58.3       │  │
│  │  Exit Signal: NO  Days below SMA20: 0             │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌── Technical Analysis Gauge ──┐  ┌── Sector ────────┐│
│  │  [TradingView TA Widget]      │  │  D vs XLU vs NEE ││
│  └───────────────────────────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Macro Dashboard (separate page or tab)
- VIX regime gauge
- DXY chart
- Yield curve visualization
- Pair ratio cards (XLY/XLP, HYG/SPY, RSP/SPY, IWF/IWD)
- Sector rotation heatmap
- Tom's macro briefing

---

## Setup Card Component

### States & Visual Treatment
```
┌─────────────────────────────────────┐
│ 🟡 APPROACHING        D  $63.60    │  ← Yellow pulse animation
│ Dominion Energy · Utilities          │
│                                      │
│ Entry: $62.50-63.00  (1.7% away)    │  ← Distance highlighted
│ Stop: $61.50  T1: $66.86  R:R 1:3  │
│                                      │
│ [═══════●════════════════════]       │  ← Range bar with price dot
│  stop   entry    price    t1    t2  │
│                                      │
│ SMA20: $63.14 ● SMA50: $61.96 ●    │  ← Green dots = above
│ Weekly20: $62.50 ●                   │
│                                      │
│ Tom: "Bullish stack. Watch for pull  │
│  to SMA20 for entry."               │
└─────────────────────────────────────┘
```

### Color by Status
| Status | Card Border | Badge Color | Animation |
|--------|------------|-------------|-----------|
| APPROACHING | `#ffa726` (orange) | Yellow | Gentle pulse |
| TRIGGERED | `#00d4aa` (cyan) | Green | Flash once |
| ACTIVE | `#00d4aa` (cyan) | Green | Steady glow |
| TRAILING | `#42a5f5` (blue) | Blue | None |
| WATCHING | `#2a2a2a` (dim) | Gray | None |
| STOPPED | `#ef5350` (red) | Red | None |
| TARGET HIT | `#ffd700` (gold) | Gold | None |
