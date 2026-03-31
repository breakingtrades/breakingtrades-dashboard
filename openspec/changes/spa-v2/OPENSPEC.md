# OpenSpec: SPA v2 — Single Page Application Rewrite

> **Status:** Phases 1-3 Complete, Phase 4 Pending  
> **Priority:** High  
> **Author:** Kash + Idan  
> **Date:** 2026-03-31  
> **v2 Staging URL:** https://brave-glacier-07c70460f.2.azurestaticapps.net/v2/index.html
> **Azure SWA Resource:** `breakingtrades-dashboard` in `rg-breakingtrades` (eastus2, Free tier)

---

## 1. Problem Statement

The current dashboard is 6 standalone HTML files with:

- **~7,000 lines** across HTML/JS/CSS, growing with each feature
- **Duplicated `:root` variables** — same 14 CSS vars copy-pasted into every file's `<style>` block
- **Duplicated component CSS** — Fear & Greed gauge styles are 100% identical in `market.html` and `signals.html`
- **Full page reloads** on every nav click — ticker tape widget reinitializes, TradingView WebSocket reconnects, scroll position lost
- **No user preferences** — ticker tape always visible, no section collapse memory, no landing page config
- **Inline `<style>` blocks per page** — market.html: 200+ lines, signals.html: 750+ lines, expected-moves.html: 240+ lines
- **Inline `<script>` blocks per page** — signals.html has 1,100+ lines of render logic inline
- **No shared component model** — Fear & Greed gauge rendered by different functions in 2 files, detail modal implemented independently in signals/watchlist/EM
- **Mobile nav broken** — horizontal links overflow on small screens, no hamburger menu

### What Works (Keep)

- Data pipeline (`data/*.json`) — zero changes needed
- Shared JS modules (`bt-prices.js`, `nav.js`, `ticker-search.js`, `ticker-tape-tv.js`, `market-status.js`, `events.js`, `sector-rotation.js`, `icons.js`)
- Design language (dark theme, monospace font, cyan/red/orange color system)
- TradingView widget integration pattern
- Chart.js visualization approach
- GitHub Pages static hosting (no build step)

---

## 2. Architecture Decision: Vanilla SPA (Zero Framework)

**No React. No Vue. No build step.**

Rationale:

1. **Read-only data visualization** — no complex state, no forms, no auth, no real-time mutations
2. **Data pipeline produces static JSON** — fetch and render pattern fits vanilla JS perfectly
3. **Chart.js + TradingView are the heavy lifters** — a framework adds abstraction overhead for zero benefit
4. **Zero build step = deploy to GitHub Pages as-is** — no CI changes, no bundler, no transpiler
5. **7,000 lines total is small** — this is a refactor, not a rewrite-with-new-paradigm
6. **Maintainability comes from file separation** — extract CSS, modularize JS, share components

### Router

Hash-based routing (`#market`, `#signals`, `#watchlist`, `#expected-moves`, `#events`, `#autoresearch`).

- No server configuration required
- GitHub Pages compatible (no 404 fallback needed)
- Bookmarkable deep links: `https://breakingtrades.github.io/breakingtrades-dashboard/v2/#watchlist`
- Hash fragment routing with `#ticker/SPY` deep links for detail modals
- Browser back/forward navigation works

---

## 3. Complete Feature Inventory (v1 Audit)

Every feature from all 6 current pages, cataloged for migration.

### 3.1 Shell (Shared Across All Pages)

| Feature | Current Implementation | v2 Target |
|---------|----------------------|-----------|
| **Nav bar** | `nav.js` renders into `<nav id="nav">` | Persistent shell, never re-renders on route change |
| **Logo + brand** | SVG inline in nav.js | Same, in shell |
| **Page links** | 6 links with active highlighting | Hash links, active state from router |
| **Ticker search** | `ticker-search.js` — 405 lines, self-contained with modal fallback for pages without `openDetail()` | Unchanged, works in shell context |
| **Market status indicator** | `market-status.js` — polls `data/market-hours.json`, updates every second | Unchanged |
| **Timezone picker** | `<select>` in nav, saves to `localStorage('bt_timezone')` | Migrate to preferences system |
| **TradingView ticker tape** | `ticker-tape-tv.js` — injects TradingView widget after nav on `nav:ready` event | Persistent in shell (survives route changes), add show/hide toggle |
| **bt-prices.js** | Global `btPrices` object, fetches `data/prices.json` | Load once in shell, shared across all page modules |

### 3.2 Market Page (`market.html` — 780 lines)

| Feature | Data Source | Notes |
|---------|------------|-------|
| **S&P 500 Sector Heatmap** | TradingView embedded widget (`embed-widget-stock-heatmap.js`) | SPY500 data source, dark theme, 500px height |
| **Sector Rotation RRG** | `sector-rotation.js` → `data/sector-rotation.json` | Chart.js canvas, 13-period trail, controls + rankings, 500px height |
| **Fear & Greed Gauge** | `data/fear-greed.json` | SVG semi-circle gauge, needle, 5 zones (0-25-45-55-75-100), prev/1wk/1mo history row, trend arrow, hover tooltip with update timestamp |
| **VIX Regime Card** | `data/vix.json` | Big value + regime label, gradient bar with needle (10-50 range), SMA20/SMA50/30d percentile stats, description text |
| **Pair Ratios Grid** | `data/pairs.json` | 8 auto-fill grid cards, pair name + description + signal reading |
| **Sector Strength Rankings** | `data/sectors.json` | Ranked list, bar chart, % change with up/down coloring |
| **Market Breadth** | `data/breadth.json` | *Complex section:* |
| ↳ Insight box | Computed from `total.average` | Green/red/dim contextual message |
| ↳ Gauge + sector bars | 11 GICS sectors (sorted) | SVG semi-circle gauge (like F&G), per-sector horizontal bars with color coding |
| ↳ Multi-timeframe table | 5 indices × 4 timeframes | SPX/NDX/DJI/RUT/VTI across 20d/50d/100d/200d with oversold/overbought badges |

### 3.3 Signals Page (`signals.html` — 1,872 lines) ⚠️ Largest

| Feature | Data Source | Notes |
|---------|------------|-------|
| **Pair Ratios Strip** | `data/watchlist.json` + `btPrices` | 8 pairs, SMA50 ratio computation, 1% threshold, inline computed on load |
| **Events Mini Strip** | `data/events.jsonl` via `events.js` | Hidden by default (`display:none`), populated by `initEventsMiniStrip()` |
| **Status Tabs** | Hardcoded `TICKERS[]` array (13 tickers) | All / Approaching / Active / Exit Signal / Watching — with counts |
| **Filter Bar** | — | Text search, bias toggles (BULL/MIXED/BEAR), sort select (Status/Change↓/Change↑/A-Z/RSI) |
| **Setup Cards** | `TICKERS[]` + `btPrices` + `data/watchlist.json` + `data/sector-risk.json` | *Rich card with:* ticker/name/sector, price/change, status badge, bias badge, pattern badge, volatility badge, sector risk badge, entry zone distance, range bar (stop→entry→T1→T2 with price dot), sparkline SVG, MA level pills (SMA20/SMA50/W20/RSI), stats row (targets, volume, ATR), exit warning, analysis text |
| **Card Animations** | CSS keyframes | `fadeInUp` entrance, `approachPulse` for approaching, `exitPulse` for exit cards |
| **Detail Modal** | TradingView + ticker data | *Full modal with:* header (ticker, name, price, status, bias), daily chart (TradingView widget, 12M, SMA20+SMA50+Volume studies), weekly chart (TradingView widget, 60M, sequential load after daily), Technical Analysis widget (TradingView TA, 1D interval), pattern info card, price target range bar with R:R, 3-column detail grid (Setup Levels / Technical Levels / Volatility & Volume), analysis section with exit warning |
| **Chart Fullscreen** | CSS `.tv-fullscreen` class | Click button to expand chart to viewport |
| **Fear & Greed Gauge** | `data/fear-greed.json` | *Duplicate of market page gauge* — right panel sidebar |
| **Sector Rotation List** | Hardcoded `sectorRotation[]` array | Grouped by quadrant (leading/improving/weakening/lagging) with movement arrows |
| **Market Regime Cards** | Hardcoded in HTML | "CRISIS" regime + "EXTREME" risk level — *should be data-driven* |
| **Daily Briefing** | `data/briefing.json` | Title, headline, body paragraphs, callout, action items, closing quote |
| **Right Panel Layout** | 380px sidebar | F&G → Sector Rotation → Market Regime → Daily Briefing |
| **Responsive Collapse** | `@media (max-width: 900px)` | Sidebar collapses below cards |

### 3.4 Watchlist Page (`watchlist.html` — 967 lines)

| Feature | Data Source | Notes |
|---------|------------|-------|
| **EM Banner** | `data/expected-moves.json` + `data/watchlist.json` | Expected move ranges for top symbols, colored position bars |
| **View Toggle** | UI buttons | Table / Widget views (widget is TradingView overview widget) |
| **Watchlist Table** | `data/watchlist.json` + `btPrices` | Sortable columns (Ticker, Name, Sector, Price, Change%, SMA20, SMA50, Bias, Status), click-to-sort with arrow indicators |
| **Bias Color Coding** | Computed | Bull=cyan, Bear=red, Mixed=orange |
| **Row Click → Detail** | `openDetail(symbol)` | Full detail modal (same pattern as signals but with TradingView charts + TA + profile + financials widgets) |
| **Hash Routing** | `#SPY`, `#AAPL`, etc. | Direct deep links to detail modals |
| **TradingView Widget View** | TV Market Overview widget | Alternative view with built-in TV widget |

### 3.5 Expected Moves Page (`expected-moves.html` — 783 lines)

| Feature | Data Source | Notes |
|---------|------------|-------|
| **Stats Row** | Computed from EM data | Ticker count, above/within/below EM distribution |
| **Color Legend** | Static | 6-color risk heatmap legend (Low → Above EM) |
| **Tier Tabs** | — | Weekly / Daily / Monthly / Quarterly |
| **Filter Tabs** | — | All / Indices / Top 10 S&P / Watchlist |
| **EM Table** | `data/expected-moves.json` + `btPrices` | Sortable, columns: Ticker, Price, EM Range (low-high), EM%, Position bar (colored by zone), Alert tag, Bias |
| **Sort** | 3-state per column | Ascending → Descending → None (reset) |
| **Staleness Guard** | Checks `updated` field | Warns if EM data is >24h old |
| **EM Detail Modal** | EM data + TradingView | 4 tier cards (daily/weekly/monthly/quarterly EM), TradingView chart, handles external tickers gracefully |
| **`openDetail` Bridge** | `window.openDetail = openEMDetail` | Ticker search integration |

### 3.6 Events Page (`events.html` — 115 lines + `events.js` — 223 lines)

| Feature | Data Source | Notes |
|---------|------------|-------|
| **Live Countdowns** | `data/events.jsonl` | Events with deadlines, real-time countdown timers |
| **Upcoming 7 Days** | `data/events.jsonl` | Chronological list of upcoming events |
| **Category Badges** | — | Geo 🌍, Macro 📊, Fed 🏛️, Earnings 💰, Technical 📈, Intel 🔍 |
| **Severity Colors** | — | Critical (red), High (orange), Medium (gold), Low (gray) |
| **Filter Tabs** | — | By category |
| **Mini Strip** | `events.js:initEventsMiniStrip()` | Rendered on signals page |

### 3.7 Autoresearch Page (`autoresearch.html` — 244 lines)

| Feature | Data Source | Notes |
|---------|------------|-------|
| **Experiment Stats** | `data/autoresearch.json` | Best score, experiment count, ticker count, last run date |
| **Baseline vs Best** | — | Side-by-side comparison cards |
| **Ticker Results Table** | — | Per-ticker scores, changes |

### 3.8 Sector Rotation (standalone page, `sector-rotation.html`)

| Feature | Data Source | Notes |
|---------|------------|-------|
| **Full RRG Chart** | `data/sector-rotation.json` | Larger canvas, full controls |
| **CSS** | `css/sector-rotation.css` (166 lines) | Shared with market + signals RRG instances |

---

## 4. v2 File Structure

```
v2/
├── index.html                  ← Single shell (nav + content area + modals)
│
├── css/
│   ├── variables.css           ← :root tokens (colors, fonts, spacing) — ONE source of truth
│   ├── reset.css               ← Box-sizing, margin reset, scrollbar styles
│   ├── shell.css               ← Nav, layout grid, ticker tape, responsive breakpoints
│   ├── components.css          ← Shared: cards, badges, gauges, modals, tables, buttons, pills
│   ├── market.css              ← Heatmap, breadth, pair grid, sector rankings
│   ├── signals.css             ← Setup cards, sparklines, range bars, right panel, regime cards
│   ├── watchlist.css           ← Table styles, EM banner, view toggle
│   ├── expected-moves.css      ← EM table, position bars, tier/filter tabs, stats row
│   ├── events.css              ← Countdown, calendar grid, category badges
│   └── autoresearch.css        ← Stats cards, compare grid
│
├── js/
│   ├── app.js                  ← Entry point: init shell, load preferences, start router
│   ├── router.js               ← Hash router with lazy page loading
│   ├── preferences.js          ← localStorage manager (all bt_ keys)
│   ├── shell.js                ← Nav build, ticker tape toggle, content area management
│   │
│   ├── components/
│   │   ├── fear-greed.js       ← Shared F&G gauge (used by market + signals)
│   │   ├── vix-regime.js       ← VIX gauge + regime card
│   │   ├── detail-modal.js     ← Shared detail modal (TV charts + TA + levels grid)
│   │   ├── pair-ratios.js      ← Pair ratio computation + rendering (strip or grid)
│   │   ├── sector-rotation.js  ← Existing RRG (unchanged, already modular)
│   │   └── event-strip.js      ← Mini event strip for signals page
│   │
│   ├── pages/
│   │   ├── market.js           ← Market page render + data loading
│   │   ├── signals.js          ← Signals page (cards, filters, right panel)
│   │   ├── watchlist.js        ← Watchlist table + EM banner
│   │   ├── expected-moves.js   ← EM table + tier/filter logic
│   │   ├── events.js           ← Full event calendar
│   │   └── autoresearch.js     ← Autoresearch dashboard
│   │
│   ├── lib/
│   │   ├── bt-prices.js        ← Existing canonical price layer (unchanged)
│   │   ├── market-status.js    ← Existing market status (unchanged)
│   │   ├── ticker-search.js    ← Existing search (minor: no page-detection, always has modal)
│   │   ├── ticker-tape.js      ← Existing TV ticker tape (add show/hide API)
│   │   └── icons.js            ← Existing SVG icon helpers
│   │
│   └── utils.js                ← Shared: fmtPrice, pctDiff, clamp, breadthColor, fgColor, sparkline generator
│
├── data -> ../data             ← Symlink to production data (pipeline unchanged)
└── .nojekyll                   ← GitHub Pages bypass
```

### Key Migration Mapping

| v1 Source | v2 Target | Change Type |
|-----------|-----------|-------------|
| `:root` vars in 6 files | `css/variables.css` | Consolidate |
| `* { margin:0 }` in 6 files | `css/reset.css` | Consolidate |
| F&G CSS + JS in market.html + signals.html | `css/components.css` + `js/components/fear-greed.js` | Extract + deduplicate |
| VIX CSS + JS in market.html | `css/components.css` + `js/components/vix-regime.js` | Extract |
| Detail modal in signals + watchlist + EM | `js/components/detail-modal.js` | Merge 3 implementations → 1 |
| Pair ratios in signals (inline) + market (from JSON) | `js/components/pair-ratios.js` | Unify computation |
| `nav.js` | `js/shell.js` | Expand (ticker tape toggle, preferences) |
| `ticker-tape-tv.js` | `js/lib/ticker-tape.js` | Add `show()` / `hide()` API |
| 750 lines inline CSS in signals.html | `css/signals.css` + `css/components.css` | Extract |
| 1,100 lines inline JS in signals.html | `js/pages/signals.js` + components | Extract + modularize |
| Timezone localStorage | `preferences.js` | Absorb into unified preferences |

---

## 5. Preferences System

```js
// preferences.js — manages all user preferences
// Stored in localStorage under key 'bt_preferences'
const defaultPrefs = {
  // Display
  tickerTape: true,           // show/hide ticker tape
  timezone: 'America/New_York',
  theme: 'dark',              // future: 'light'
  
  // Navigation
  defaultPage: 'market',      // landing page on load
  lastVisited: null,           // resume last page if defaultPage not set
  
  // Per-page state
  signals: {
    statusFilter: 'all',
    biasFilters: { bull: true, mixed: true, bear: true },
    sortMode: 'status',
    searchQuery: '',
    rightPanelCollapsed: false,
  },
  watchlist: {
    view: 'table',            // 'table' or 'widget'
    sortCol: 0,
    sortAsc: true,
  },
  expectedMoves: {
    tier: 'weekly',
    filter: 'all',
    sortCol: null,
    sortDir: null,
  },
  events: {
    categoryFilter: 'all',
  },
  
  // Section collapse memory
  collapsedSections: {},       // { 'market:breadth': true, 'signals:regime': true }
};
```

**Storage:** Single `localStorage` key (`bt_preferences`) with JSON blob. Merge on load (new defaults survive old stored prefs). No cookies needed (no server-side reads).

---

## 6. Router Design

```js
// router.js
const ROUTES = {
  'market':          { module: 'pages/market.js',          css: 'css/market.css',          title: 'Market' },
  'signals':         { module: 'pages/signals.js',         css: 'css/signals.css',         title: 'Signals' },
  'watchlist':       { module: 'pages/watchlist.js',       css: 'css/watchlist.css',        title: 'Watchlist' },
  'expected-moves':  { module: 'pages/expected-moves.js',  css: 'css/expected-moves.css',   title: 'Expected Moves' },
  'events':          { module: 'pages/events.js',          css: 'css/events.css',           title: 'Events' },
  'autoresearch':    { module: 'pages/autoresearch.js',    css: 'css/autoresearch.css',     title: 'Autoresearch' },
};
```

**Lifecycle per route change:**

1. Update nav active link (CSS class swap only)
2. Save `lastVisited` to preferences
3. Call `currentPage.destroy()` (cleanup: remove event listeners, destroy Chart.js instances, clear intervals)
4. Load page CSS if not already loaded (inject `<link>` tag, idempotent)
5. Load page JS module if not already cached (`import()` or script load + callback)
6. Call `newPage.render(contentEl)` — receives the content container div
7. Call `newPage.init()` — bind events, fetch data, start renders
8. Update `document.title`
9. Restore scroll position (or scroll to top)

**Deep links:** `#watchlist/SPY` → route to watchlist page, then call `openDetail('SPY')` after render.

---

## 7. Shell (`index.html`)

Single HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BreakingTrades Dashboard</title>
  
  <!-- Core CSS (always loaded) -->
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/shell.css">
  <link rel="stylesheet" href="css/components.css">
  
  <!-- External deps -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2"></script>
  <script src="https://s3.tradingview.com/tv.js"></script>
</head>
<body>
  <!-- PERSISTENT SHELL -->
  <nav id="nav"></nav>
  <!-- Ticker tape injected here by shell.js -->
  
  <!-- PAGE CONTENT (swapped by router) -->
  <main id="content"></main>
  
  <!-- SHARED MODALS (persistent, hidden) -->
  <div id="detail-modal" class="modal-overlay"></div>
  
  <!-- Core JS -->
  <script src="js/lib/bt-prices.js"></script>
  <script src="js/lib/icons.js"></script>
  <script src="js/lib/market-status.js"></script>
  <script src="js/lib/ticker-search.js"></script>
  <script src="js/lib/ticker-tape.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/preferences.js"></script>
  <script src="js/shell.js"></script>
  <script src="js/router.js"></script>
  <script src="js/components/detail-modal.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

### Nav Enhancements

| Feature | Description |
|---------|-------------|
| **Ticker tape toggle** | Eye icon (👁) in nav right section. Click toggles ticker tape visibility. State saved to preferences. |
| **Mobile hamburger** | ≡ icon at `@media (max-width: 768px)`. Toggles nav links visibility. Auto-closes on route change. |
| **Active page transition** | CSS `transition: border-color 0.2s` on nav links instead of flash on page load |
| **Sticky behavior** | `position: sticky; top: 0; z-index: 100;` (already works, just cleaner in shell.css) |

---

## 8. Component Deduplication

### Fear & Greed Gauge

Currently: **identical** 80-line render function in `market.html` and `signals.html`, plus **identical** 60+ lines of CSS.

v2: Single `js/components/fear-greed.js` exporting:
```js
function renderFearGreed(containerId, data, options = {}) {
  // options: { compact: false, showHistory: true, showTrend: true }
}
```

Market page: full size with history row.  
Signals right panel: compact mode (smaller SVG, optional history).

### Detail Modal

Currently: **3 separate implementations** in signals, watchlist, and expected-moves — each with different feature sets:
- Signals: daily/weekly charts + TA widget + pattern + range bar + detail grid + analysis
- Watchlist: daily/weekly charts + TA widget + profile + financials
- Expected Moves: 4 EM tier cards + TradingView chart

v2: Single `js/components/detail-modal.js` with composable sections:
```js
function openDetail(symbol, options = {}) {
  // options.sections: ['charts', 'ta', 'pattern', 'range', 'levels', 'em', 'analysis', 'profile', 'financials']
  // Default: ['charts', 'ta', 'levels']
  // Signals adds: ['pattern', 'range', 'analysis']
  // EM adds: ['em']
}
```

### Pair Ratios

Currently: `data/pairs.json` on market page (pre-computed), inline SMA50 computation on signals page.

v2: `js/components/pair-ratios.js` — single computation engine, two render modes (grid for market, strip for signals).

---

## 9. New Features (v2 Only)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Ticker tape toggle** | P0 | Eye icon in nav, preference-persisted |
| **Section collapse** | P0 | Collapsible sections on all pages (click header to toggle), state saved per-section |
| **Landing page preference** | P1 | User picks default page (market/signals/etc.) |
| **Resume last visited** | P1 | If no default page set, resume where user left off |
| **Mobile nav** | P1 | Hamburger menu at ≤768px |
| **Data-driven Market Regime** | P1 | Move hardcoded regime cards from signals.html to `data/regime.json` |
| **Loading skeletons** | P2 | Shimmer placeholders while page modules load |
| **Section reorder** | P3 | Drag to reorder dashboard sections (stretch goal) |

---

## 10. CSS Token System

```css
/* css/variables.css */
:root {
  /* Backgrounds */
  --bg-primary: #0a0a12;
  --bg-card: #111122;
  --bg-card-hover: #161630;
  --bg-input: #0c0c18;
  
  /* Borders */
  --border: #1e1e3a;
  --border-hover: #2a2a50;
  
  /* Text */
  --text: #e0e0e8;
  --text-dim: #8888aa;
  --text-bright: #ffffff;
  
  /* Semantic Colors */
  --cyan: #00d4aa;
  --green: #00c853;
  --red: #ef5350;
  --orange: #ffa726;
  --gold: #ffd700;
  --blue: #42a5f5;
  --purple: #ab47bc;
  --yellow: #ffeb3b;
  
  /* Semantic Backgrounds */
  --green-bg: rgba(0,212,170,0.08);
  --red-bg: rgba(239,83,80,0.08);
  --orange-bg: rgba(255,167,38,0.08);
  --blue-bg: rgba(66,165,245,0.1);
  
  /* Typography */
  --font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
  --font-size-xs: 9px;
  --font-size-sm: 10px;
  --font-size-md: 11px;
  --font-size-base: 13px;
  --font-size-lg: 16px;
  --font-size-xl: 22px;
  --font-size-hero: 48px;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  
  /* Layout */
  --nav-height: 48px;
  --ticker-tape-height: 46px;
  --sidebar-width: 380px;
  --border-radius: 6px;
  --border-radius-sm: 4px;
  --border-radius-lg: 8px;
  
  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
  --transition-slow: 0.35s ease-out;
  
  /* Z-index layers */
  --z-ticker-tape: 90;
  --z-nav: 100;
  --z-dropdown: 150;
  --z-modal: 200;
  --z-fullscreen: 10000;
}
```

---

## 11. Data Contracts (Unchanged)

All existing `data/*.json` files remain as-is. No schema changes.

| File | Consumer Pages |
|------|---------------|
| `prices.json` | All (via `bt-prices.js`) |
| `fear-greed.json` | Market, Signals |
| `vix.json` | Market |
| `sector-rotation.json` | Market, Signals |
| `sector-risk.json` | Signals |
| `sectors.json` | Market |
| `pairs.json` | Market |
| `breadth.json` | Market |
| `watchlist.json` | Watchlist, Signals (pair ratios), EM |
| `expected-moves.json` | Expected Moves, Watchlist (EM banner) |
| `briefing.json` | Signals |
| `events.jsonl` | Events, Signals (mini strip) |
| `futures.json` | Pipeline/API only (no longer rendered) |
| `market-hours.json` | All (via `market-status.js`) |
| `status.json` | — |

**New data file (P1):**
| File | Description |
|------|-------------|
| `regime.json` | Market regime + risk level (currently hardcoded in signals.html) |

---

## 12. Migration Plan (Phases)

### Phase 1: Shell + Router + Market Page ✅ COMPLETE
**Delivered: 2026-03-31 5:00 PM ET** — Commits `f773dd0`

1. ✅ `v2/index.html` shell
2. ✅ `css/variables.css` — 40+ design tokens consolidated
3. ✅ `css/reset.css`
4. ✅ `css/shell.css` — nav, layout, hamburger
5. ✅ `js/preferences.js` — localStorage manager
6. ✅ `js/router.js` — hash router with lazy loading
7. ✅ `js/shell.js` — nav, ticker tape toggle, mobile hamburger
8. ✅ `js/lib/*` — 6 shared modules copied
9. ✅ `js/utils.js` — shared functions extracted
10. ✅ `css/market.css` + `js/pages/market.js` — full market page
11. ✅ `js/components/fear-greed.js` — shared F&G gauge
12. ✅ `js/components/vix-regime.js` — shared VIX component
13. ✅ Market page renders identically to v1

### Phase 2: Component Extraction + Remaining Pages ✅ COMPLETE
**Delivered: 2026-03-31 5:17 PM ET** — Commits `dd8a869`

14. ✅ `css/components.css` — shared badges, modals, cards, tables, gauges
15. ✅ `js/components/detail-modal.js` — unified from 3 v1 implementations
16. ✅ `js/components/pair-ratios.js` (inline in signals.js — pair ratio strip computation)
17. ✅ `css/signals.css` + `js/pages/signals.js` — 567 + 784 lines, all 13 setup cards, filters, right panel
18. ✅ `css/watchlist.css` + `js/pages/watchlist.js` — sortable table, EM banner, view toggle
19. ✅ `css/expected-moves.css` + `js/pages/expected-moves.js` — EM table, tier/filter tabs, 3-state sort
20. ✅ `css/events.css` + `js/pages/events.js` — countdowns, JSONL parser, category filters
21. ✅ `css/autoresearch.css` + `js/pages/autoresearch.js` — stats, comparison, results
22. ✅ All pages render identically, nav transitions work, preferences persist

### Phase 3: Polish + New Features ✅ COMPLETE
**Delivered: 2026-03-31 6:15 PM ET** — Commits `92cdaa4`, `8378d45`, `41d84a6`

23. ✅ Lucide Icons — replaced ALL emoji + inline SVGs with consistent monoline SVGs via CDN (`unpkg.com/lucide@latest`). Deleted custom `icons.js`. `lucide.createIcons()` called after every dynamic render. ~40 icon mappings across all pages.
24. ✅ Mobile hamburger — slide-down dropdown at ≤768px, 44px touch targets, auto-close on route change
25. ✅ Mobile responsive — search collapses at ≤480px, TZ picker hidden, sticky table columns, full-screen modals, reduced padding, momentum scroll on ticker tape
26. ✅ `js/components/collapsible.js` — reusable collapsible section component with chevron animation
27. ✅ 12 collapsible sections: market (6), signals right panel (4), expected moves (2). State persists in preferences.
28. ✅ Loading skeletons — shimmer animation for gauges, cards, charts, table rows across all pages
29. ✅ Mobile overflow fix — `html`/`body`/`nav`/`content` all constrained to `100vw`, no horizontal scroll

### Phase 4: Azure Static Web Apps + Cutover
**Estimated: 1 hour**

30. Create Azure Static Web App (free tier) linked to GitHub repo
31. Configure `staticwebapp.config.json` (routing, headers, optional auth)
32. Move v1 files to `v1-archive/`
33. Move `v2/` contents to root
34. Update `index.html` redirect to `#market`
35. Verify GitHub Actions auto-deploy to Azure SWA
36. Verify all data pipeline paths still work (EOD, prices, etc. push to repo → auto-deploy)
37. Configure auth (GitHub login, invite-only or open — Idan's call)
38. Optional: custom domain setup
39. Retire GitHub Pages deployment
40. Update openspec INDEX.md

**Deliverable:** v2 is production on Azure Static Web Apps with optional auth.

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **TradingView widget re-init on route change** | Flickering, slow transitions | Destroy cleanly in page `destroy()`, use loading skeletons |
| **Chart.js memory leaks** | Growing memory on repeated route changes | Mandatory `chart.destroy()` in page cleanup |
| **Signals page complexity** | Largest page, most inline state | Extract components first, page module last |
| **Hash routing SEO** | Not indexed by search engines | Not relevant — dashboard is private/niche |
| **Data symlink on GH Pages** | Symlinks don't deploy | Copy `data/` into `v2/` or use relative `../data/` paths |
| **Browser cache** | Stale JS/CSS after updates | Version query params on script/link tags |

---

## 15. Hosting: Azure Static Web Apps

**Decision:** Migrate from GitHub Pages to Azure Static Web Apps (free tier) as part of Phase 4.

### Why Azure SWA over GitHub Pages

| Capability | GitHub Pages | Azure SWA |
|-----------|-------------|-----------|
| Cost | Free | Free |
| CDN | Fastly | Azure Front Door |
| Built-in auth | ❌ | ✅ GitHub, Entra, Google (config-only, zero code) |
| API routes | ❌ | ✅ Azure Functions (`/api/` folder) |
| Preview envs | ❌ | ✅ Per-PR staging URLs |
| Custom routing | ❌ hash only | ✅ `staticwebapp.config.json` |
| Role-based access | ❌ | ✅ Invite-only with roles |

### Why Azure SWA over Vercel

- **Built-in auth** — Entra/GitHub/Google via config, no third-party library
- **Same Azure ecosystem** — existing subscription, `az` CLI, no new vendor
- **Free tier allows commercial use** — Vercel Hobby tier is non-commercial
- **API routes connect to Azure resources** natively (Table Storage, OpenAI, etc.)

### Infrastructure

| Setting | Value |
|---------|-------|
| **Subscription** | `ME-MngEnvMCAP356394-idanshimon-1` (or personal Azure — TBD) |
| **Resource Group** | `rg-breakingtrades` (new) |
| **App Name** | `breakingtrades-dashboard` |
| **Region** | `eastus` |
| **Source** | `github.com/breakingtrades/breakingtrades-dashboard` |
| **Branch** | `main` |
| **App location** | `/` (root) |
| **API location** | `/api` (future — not used initially) |
| **SKU** | Free |

### Auth Configuration (`staticwebapp.config.json`)

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/data/*", "/css/*", "/js/*", "/images/*"]
  },
  "routes": [
    {
      "route": "/data/*",
      "headers": {
        "Cache-Control": "public, max-age=300"
      }
    }
  ],
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff"
  }
}
```

Auth routes added when ready (not blocking v2 launch):

```json
{
  "routes": [
    { "route": "/*", "allowedRoles": ["authenticated"] }
  ],
  "responseOverrides": {
    "401": { "redirect": "/.auth/login/github", "statusCode": 302 }
  }
}
```

### Deploy Pipeline

1. Data scripts (`eod-update.sh`, `update-prices.py`, etc.) push JSON to repo → GitHub Actions auto-deploys to Azure SWA
2. Code changes push to repo → same GitHub Actions auto-deploys
3. PR branches get preview URLs automatically
4. Zero pipeline changes from v1

### Risk: Dev Subscription Stability

The `MngEnvMCAP356394` dev subscription has $150/mo credits. SWA free tier costs $0 so credits aren't consumed. However, if Microsoft revokes/modifies the subscription, the SWA goes down. Magen Yehuda has run on this same sub for months at ~$45/mo without issues. Mitigation: can migrate to personal Azure account (free, $0 SWA) if needed — takes 10 minutes.

## 16. Success Criteria

- [ ] All 6 pages render pixel-identical to v1
- [ ] Nav is persistent — no page reload on navigation
- [ ] Ticker tape survives route changes (no re-init flash)
- [ ] Ticker tape toggle works and persists across sessions
- [ ] Mobile nav works at ≤768px
- [ ] Preferences persist: timezone, ticker tape, filter states, sort states
- [ ] Deep links work: `#market`, `#signals`, `#watchlist/SPY`
- [ ] Detail modal works from all pages (unified component)
- [ ] No inline `<style>` blocks (all CSS in files)
- [ ] No inline `<script>` blocks >10 lines (all JS in files)
- [ ] `data/` pipeline requires zero changes
- [ ] Zero build step — deploys to GitHub Pages as static files
- [ ] Total JS payload ≤ v1 total (no bloat from refactor)
