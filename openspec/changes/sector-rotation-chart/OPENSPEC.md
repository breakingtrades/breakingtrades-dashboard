# OpenSpec: Sector Rotation RRG Integration

_Updated: 2026-03-18. Replaces previous sector-rotation-chart spec._

## Summary

Integrate the new **Chart.js-based Relative Rotation Graph (RRG)** into both the **Signals page** (`index.html`) and the **Market page** (`market.html`). The standalone `sector-rotation.html` is now the working prototype — this spec covers extracting it into a reusable component and embedding it.

## What We Built (Prototype)

**File:** `sector-rotation.html` — fully working standalone RRG with:
- **Chart.js 4** scatter plot with `showLine: true` for trailing paths
- **chartjs-plugin-annotation** — colored quadrant backgrounds, dashed crosshairs at (100,100), quadrant labels
- **chartjs-plugin-zoom** — scroll to zoom, drag to pan, reset button
- **Real RS math:** `(1 + sectorChange) / (1 + benchmarkChange) × 100`, 13-week lookback vs SPY
- **RS Momentum:** `currentRS / prevRS × 100` (centered at 100)
- **26-week trail data** with 8W / 13W / 26W toggle
- **Interactive legend:** single-click toggles sector on/off, double-click solos, hover shows full sector name tooltip
- **Click on chart dots** to highlight/focus a sector
- **Dark theme** matching BT design system

**Data pipeline:** `scripts/export-sector-rotation.py` reads weekly CSVs from parent `data/` dir, computes RS + momentum with 26-week trail history, writes `data/sector-rotation.json`.

## Plan

### Phase 1: Extract Reusable Component
**Goal:** Make RRG embeddable as a module so both pages can use it.

**Tasks:**
1. Extract JS logic from `sector-rotation.html` into `js/sector-rotation.js`
   - Export a `createRRG(containerId, options)` function
   - Options: `{ trailLength, dataUrl, showControls, height }`
   - Handles chart creation, legend building, zoom, filtering
2. Extract RRG-specific CSS into `css/sector-rotation.css`
3. Keep `sector-rotation.html` as standalone test page (imports the module)
4. CDN deps stay in HTML (Chart.js, annotation, zoom plugins)

### Phase 2: Signals Page Integration (`index.html`)
**Goal:** Add RRG as a collapsible section on the Signals page.

**Tasks:**
1. Add "Sector Rotation" section after the macro strip / before setup cards
2. Compact variant: shorter height (~350px), no subtitle, controls inline
3. Default trail: 8W (short view, most relevant for active traders)
4. Collapsible — toggle with a header click (remember state in localStorage)
5. Replaces or complements the existing flat sector bar (if any)

**Layout:**
```
┌─────────────────────────────────────────────┐
│  BREAKINGTRADES    [Signals] [Watchlist] ... │
│  ── macro strip ──────────────────────────── │
│  ▼ SECTOR ROTATION  [8W] [13W] [26W] [Reset]│
│  ┌─────────────────────────────────────────┐ │
│  │           RRG Chart (350px)             │ │
│  │         (zoomable, pannable)            │ │
│  └─────────────────────────────────────────┘ │
│  ● XLE  ● XLB  ● XLI  ...  ● XLRE          │
│  ─────────────────────────────────────────── │
│  [Setup Cards...]                            │
└─────────────────────────────────────────────┘
```

### Phase 3: Market Page Integration (`market.html`)
**Goal:** RRG as a primary component on the Market page.

**Tasks:**
1. Add RRG as a hero component (full-width, ~500px height)
2. Full variant with all controls visible
3. Default trail: 13W (broader market context view)
4. Position: below heatmap, above Fear & Greed gauge
5. Include "Sector Strength Rankings" table below RRG (sorted by RS value, with quadrant badge)

**Layout:**
```
┌─────────────────────────────────────────────┐
│  ── TradingView Heatmap (hero) ──────────── │
│                                              │
│  SECTOR ROTATION                             │
│  [8W] [13W] [26W] [Reset] Scroll/Drag zoom  │
│  ┌─────────────────────────────────────────┐ │
│  │           RRG Chart (500px)             │ │
│  └─────────────────────────────────────────┘ │
│  ● XLE  ● XLB  ● XLI  ...  ● XLRE          │
│                                              │
│  SECTOR RANKINGS                             │
│  ┌────────┬────────┬──────┬──────────┐       │
│  │ Sector │   RS   │ Mom  │ Quadrant │       │
│  ├────────┼────────┼──────┼──────────┤       │
│  │ XLE    │ 132.06 │ 97.1 │ Weakening│       │
│  │ XLU    │ 111.47 │ 97.4 │ Weakening│       │
│  │ ...    │        │      │          │       │
│  └────────┴────────┴──────┴──────────┘       │
│                                              │
│  [Fear & Greed Gauge]  [VIX Badge]           │
│  [Pair Ratios]                               │
└─────────────────────────────────────────────┘
```

### Phase 4: Data Pipeline Integration
**Goal:** Automate `sector-rotation.json` export.

**Tasks:**
1. Add `export-sector-rotation.py` call to `scripts/export-dashboard-data.py`
2. Run as part of the `--commit --push` deploy flow
3. Keep `sectors.json` (old format) for backward compat until fully migrated
4. Add `--status` flag to export script for staleness check

## Data Format

**`data/sector-rotation.json`** (current, working):
```json
{
  "benchmark": "SPY",
  "lookback": 13,
  "trailLength": 26,
  "generatedAt": "2026-03-18T...",
  "sectors": [
    {
      "symbol": "XLE",
      "name": "Energy",
      "color": "#FF5722",
      "quadrant": "Weakening",
      "trail": [
        { "date": "2025-09-28", "rs": 91.3, "momentum": 98.2 },
        ...
        { "date": "2026-03-18", "rs": 132.06, "momentum": 97.056 }
      ]
    },
    ...
  ]
}
```

## Dependencies
- Chart.js 4 (CDN)
- chartjs-plugin-annotation 3 (CDN)  
- chartjs-plugin-zoom 2 (CDN)
- Weekly OHLCV CSVs for 11 sectors + SPY (from IB via `update_data.py`)

## Planned Changes

### Trace Lines Toggle
**Goal:** Add a toggle button to show/hide the trailing path lines on the RRG chart.

**Behavior:**
- Default: traces **ON** (current behavior — `showLine: true` on all datasets)
- Toggle button label: `[Traces ●]` / `[Traces ○]` (or "Trails ON/OFF")
- When OFF: only the current dot (latest position) is shown per sector — no path lines
- Implementation: flip `dataset.showLine` on all Chart.js datasets + call `chart.update()`
- State persisted in `localStorage` (remembers preference across page loads)
- Button lives in the RRG controls bar alongside `[8W] [13W] [26W] [Reset]`

**Controls bar (updated):**
```
[8W] [13W] [26W]  |  [Traces ●]  [Reset]
```

**Tasks:**
1. Add toggle button to `sector-rotation.html` controls bar
2. On click: iterate `chart.data.datasets`, flip `showLine`, call `chart.update('none')`
3. Persist state: `localStorage.setItem('rrg-traces', 'on'|'off')`
4. Read on init: restore last preference
5. When extracted to `js/sector-rotation.js` (Phase 1): include in `createRRG()` options as `showTraces: true` default

## Acceptance Criteria
- [ ] `js/sector-rotation.js` — reusable module with `createRRG()` API
- [ ] `css/sector-rotation.css` — extracted styles
- [ ] Signals page: collapsible RRG section, compact 350px, 8W default
- [ ] Market page: full RRG component, 500px, 13W default, sector rankings table
- [ ] Both pages: zoom, pan, filter (toggle on/off), solo (dblclick), hover tooltips
- [ ] **Trace lines toggle** — button in controls bar, persisted in localStorage
- [ ] `export-sector-rotation.py` integrated into deploy pipeline
- [ ] Standalone `sector-rotation.html` still works for testing
