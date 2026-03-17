# Design: Dashboard Frontend

## Page Architecture

```
src/
├── index.html              ← Watchlist grid (home page)
├── ticker.html             ← Ticker detail page (query param: ?s=D)
├── css/
│   ├── tokens.css          ← Design system variables
│   ├── layout.css          ← Grid, sidebar, responsive
│   ├── components.css      ← Cards, badges, range bars
│   └── tradingview.css     ← TradingView widget overrides
├── js/
│   ├── app.js              ← Entry point, router, data fetch
│   ├── watchlist.js        ← Grid rendering, sort/filter
│   ├── ticker-detail.js    ← Detail page rendering
│   ├── tradingview.js      ← TradingView widget initialization
│   └── utils.js            ← Formatters, helpers
└── assets/
    └── logo.svg
```

## Component Design

### Watchlist Card (Grid Item)
```
┌──────────────────────┐
│  AAPL          ● Bull│
│  Apple Inc.          │
│  $187.44    +1.24%   │
│  ───── mini chart ───│
│  RSI: 62  EMA: ●●●  │
└──────────────────────┘
```
- Background: `var(--card)` with `var(--border)` border
- Bias badge: green for Bull, red for Bear, orange for Mixed
- Mini chart: TradingView Symbol Overview (compact) or CSS sparkline
- Hover: border glow `rgba(0,212,170,0.3)`

### Ticker Detail Layout
```
┌─────────┬─────────────────────────────────────┐
│ Sidebar  │  Ticker Tape (fixed top)            │
│          ├─────────────────────────────────────┤
│ D        │  Key Levels Strip                   │
│ Dominion │  EMA Alignment Status               │
│ ● BULL   ├─────────────────────────────────────┤
│          │  Daily Chart (TradingView)           │
│ Sections │                                      │
│ ▸ Levels │                                      │
│ ▸ Daily  ├─────────────────────────────────────┤
│ ▸ 4H     │  4H Chart (TradingView)             │
│ ▸ Setup  │                                      │
│ ▸ TA     ├──────────────┬──────────────────────┤
│          │  TA Gauge     │  Symbol Overview     │
│          ├──────────────┴──────────────────────┤
│          │  Trade Setup Card + Range Bar        │
│          │  Entry | Stop | T1 | T2 | R:R       │
└──────────┴─────────────────────────────────────┘
```

### Trade Setup Range Bar
- Full-width horizontal bar showing price range from stop → targets
- Color zones: red (stop area), green (entry zone), light green (target area)
- Marker labels staggered to avoid overlap (alternating above/below)
- Stats grid below: Entry, Stop, Target 1, R:R ratio

### EMA Alignment Dots
- Three dots (EMA 8, 21, 50) with connectors
- Green dots + line = bullish alignment
- Red dots + line = bearish alignment
- Mixed = orange dots, no connector

## TradingView Widget Configuration

### Advanced Chart (Daily)
```javascript
{
  "autosize": true,
  "symbol": "NYSE:D",
  "interval": "D",
  "timezone": "America/New_York",
  "theme": "dark",
  "style": "1",
  "locale": "en",
  "backgroundColor": "rgba(18, 18, 26, 1)",
  "gridColor": "rgba(30, 30, 46, 0.5)",
  "hide_top_toolbar": false,
  "hide_legend": false,
  "save_image": false,
  "studies": [
    { "id": "MAExp@tv-basicstudies", "inputs": { "length": 8 } },
    { "id": "MAExp@tv-basicstudies", "inputs": { "length": 21 } },
    { "id": "MAExp@tv-basicstudies", "inputs": { "length": 50 } }
  ]
}
```

### Ticker Tape
```javascript
{
  "symbols": [/* dynamic from watchlist */],
  "showSymbolLogo": true,
  "isTransparent": true,
  "displayMode": "adaptive",
  "colorTheme": "dark"
}
```

## Data Flow

```
Page Load
    │
    ├── fetch('data/output/watchlist.json')
    │       │
    │       ▼
    │   Parse JSON → Render watchlist grid
    │
    ├── fetch('data/output/setups.json')
    │       │
    │       ▼
    │   Parse JSON → Attach setup data to ticker cards
    │
    └── Initialize TradingView widgets
            │
            ▼
        Ticker tape, charts, gauges render via embed scripts
```

## Responsive Strategy

| Breakpoint | Layout |
|-----------|--------|
| ≥ 1440px | 4-column grid, sidebar visible, full charts |
| 1024-1439px | 3-column grid, sidebar visible, full charts |
| 768-1023px | 2-column grid, sidebar hidden, stacked charts |
| < 768px | 1-column grid, sidebar hidden, stacked charts |

## CSS Architecture

- All colors via CSS custom properties (from `tokens.css`)
- No external frameworks — pure CSS Grid + Flexbox
- Card animations: `fadeInUp` with staggered delays
- Transitions: 0.2-0.3s ease for hovers and state changes
- Dark theme only — no light mode toggle
