# BreakingTrades Dashboard — Multi-Page Architecture

_Evolved from single-page MVP to multi-page dashboard. Last updated: 2026-03-17._

---

## Pages

### 1. **Signals** (`index.html`) — CURRENT, KEEP AS-IS
The existing page. Trade setup cards with status lifecycle (Approaching → Active → Exit → Watching), pair ratios, macro strip, detail modals with daily/weekly TradingView charts, analysis panel.

**Purpose:** "What should I trade today?" — actionable setups with entry/stop/target levels.

### 2. **Watchlist** (`watchlist.html`) — NEW
Full watchlist view for tracking all ~70 symbols at a glance without opening individual cards.

**Components:**
- **TradingView Watchlist Widget** (`embed-widget-market-overview.js`) — tabbed groups (Quality Stocks, Sector ETFs, Macro, Community Ideas) with live prices, % change, sparklines
- **Custom table view** — sortable by: ticker, price, % change, SMA20 distance, SMA50 distance, bias, status, sector
- **Toggle:** Widget view (visual) ↔ Table view (data-dense)
- **Click-through:** Clicking a ticker opens the detail modal (same as Signals page)

**Data source:** Same `watchlist.json` from pipeline + TradingView live widget for real-time prices.

### 3. **Market** (`market.html`) — NEW
Market health dashboard — the macro context page.

**Components:**
- **TradingView Stock Heatmap Widget** (`embed-widget-stock-heatmap.js`)
  - Data source: `SPY500` (S&P 500 by sector)
  - Grouped by sector
  - Block size: market cap
  - Block color: % change (daily performance)
  - Dark theme
  - Full-width, ~500px tall
  
- **Fear & Greed Index** — CNN F&G via Python pipeline
  - `fear-greed-index` Python package (`pip install fear-greed-index`) → scrapes CNN's API
  - Pipeline generates gauge value (0-100) + classification (Extreme Fear → Extreme Greed) → `data/fear-greed.json`
  - Custom SVG/CSS gauge on the page — semi-circle meter with needle
  - Updates 2x/day with pipeline run
  - Historical 30-day sparkline (optional, from pipeline)

- **Pair Ratios** — moved/duplicated from Signals page
  - XLY/XLP, RSP/SPY, HYG/SPY, IWM/SPY, etc.
  - Shows trend direction (rising/falling/flat) with color coding
  
- **VIX Regime Badge** — from macro strip, enlarged
- **Sector Strength Rankings** — sorted list of sector ETFs by relative performance

**Layout:** Heatmap hero (top), Fear & Greed gauge + VIX badge (mid-left), pair ratios (mid-right), sector rankings (bottom).

---

## Navigation

Shared top nav bar across all pages:

```
┌──────────────────────────────────────────────────────────────┐
│  BREAKINGTRADES    [Signals]  [Watchlist]  [Market]    🕐 ET │
│  ─── macro strip: VIX · DXY · US10Y · OIL · BTC ──────────  │
└──────────────────────────────────────────────────────────────┘
```

- Active page highlighted with cyan underline
- Macro strip stays on all pages (already exists)
- Timezone selector stays in corner (already exists)

---

## Shared Components (extract from index.html)

To avoid code duplication across 3 pages, extract into shared files:

```
css/
  tokens.css       ← CSS custom properties (colors, spacing, fonts)
  layout.css       ← nav, macro strip, modal, responsive
  components.css   ← cards, badges, pills, gauges

js/
  shared.js        ← nav, macro strip, timezone, modal, TradingView helpers
  signals.js       ← signal-specific logic (card rendering, filters, status tabs)
  watchlist.js     ← watchlist-specific logic (table sort, widget init)
  market.js        ← market-specific logic (heatmap, F&G gauge, pairs)
```

**Migration:** Keep `index.html` as single-file for now (it works). When adding `watchlist.html` and `market.html`, extract shared CSS/JS at that point. Don't refactor what isn't broken.

---

## TradingView Widgets Used

| Widget | Script | Page |
|--------|--------|------|
| Advanced Chart | `tv.js` | Signals (modal), Watchlist (modal) |
| Stock Heatmap | `embed-widget-stock-heatmap.js` | Market |
| Market Overview | `embed-widget-market-overview.js` | Watchlist |
| Ticker Tape | (already in macro strip) | All pages |

### Stock Heatmap Config
```javascript
{
  "exchanges": [],
  "dataSource": "SPY500",
  "grouping": "sector",
  "blockSize": "market_cap_basic",
  "blockColor": "change",
  "locale": "en",
  "symbolUrl": "",
  "colorTheme": "dark",
  "hasTopBar": true,
  "isDataSetEnabled": true,
  "isZoomEnabled": true,
  "hasSymbolTooltip": true,
  "isMonoSize": false,
  "width": "100%",
  "height": 500
}
```

### Market Overview (Watchlist) Config
```javascript
{
  "colorTheme": "dark",
  "dateRange": "12M",
  "showChart": true,
  "locale": "en",
  "width": "100%",
  "height": 600,
  "largeChartUrl": "",
  "isTransparent": true,
  "showSymbolLogo": true,
  "showFloatingTooltip": true,
  "plotLineColorGrowing": "rgba(0, 212, 170, 1)",
  "plotLineColorFalling": "rgba(255, 71, 87, 1)",
  "tabs": [
    {
      "title": "Quality Stocks",
      "symbols": [
        {"s": "NASDAQ:AAPL", "d": "Apple"},
        {"s": "NASDAQ:MSFT", "d": "Microsoft"},
        {"s": "NASDAQ:NVDA", "d": "NVIDIA"},
        {"s": "NASDAQ:GOOGL", "d": "Alphabet"},
        {"s": "NASDAQ:AMZN", "d": "Amazon"},
        {"s": "NASDAQ:META", "d": "Meta"}
      ]
    },
    {
      "title": "Sector ETFs",
      "symbols": [
        {"s": "AMEX:XLU", "d": "Utilities"},
        {"s": "AMEX:XLK", "d": "Technology"},
        {"s": "AMEX:XLE", "d": "Energy"},
        {"s": "AMEX:XLV", "d": "Healthcare"},
        {"s": "AMEX:XLF", "d": "Financials"},
        {"s": "AMEX:XLP", "d": "Staples"},
        {"s": "AMEX:XLY", "d": "Discretionary"}
      ]
    },
    {
      "title": "Macro",
      "symbols": [
        {"s": "AMEX:SPY", "d": "S&P 500"},
        {"s": "NASDAQ:QQQ", "d": "Nasdaq 100"},
        {"s": "AMEX:IWM", "d": "Russell 2000"},
        {"s": "AMEX:DIA", "d": "Dow 30"},
        {"s": "TVC:VIX", "d": "VIX"},
        {"s": "TVC:DXY", "d": "Dollar Index"}
      ]
    }
  ]
}
```

---

## Fear & Greed Index

### Data Source
CNN Fear & Greed Index — no official API, but `fear-greed-index` Python package scrapes it reliably.

```bash
pip install fear-greed-index
```

```python
from fear_greed_index import get_fgi
data = get_fgi()
# Returns: {"value": 25, "description": "Extreme Fear", "last_update": "2026-03-17T16:00:00"}
```

### Pipeline Output (`data/fear-greed.json`)
```json
{
  "current": {
    "value": 25,
    "description": "Extreme Fear",
    "updated": "2026-03-17T20:35:00Z"
  },
  "previous_close": {
    "value": 28,
    "description": "Fear"
  },
  "one_week_ago": {
    "value": 35,
    "description": "Fear"
  },
  "one_month_ago": {
    "value": 52,
    "description": "Neutral"
  }
}
```

### Rendering
Custom CSS gauge (semicircle meter with needle):
- 0-25: **Extreme Fear** (dark red)
- 25-45: **Fear** (orange)
- 45-55: **Neutral** (yellow)
- 55-75: **Greed** (light green)
- 75-100: **Extreme Greed** (bright green)

No external dependency — pure CSS/SVG gauge rendered client-side from JSON value.

---

## Implementation Order

1. **Create `watchlist.html`** — TradingView Market Overview widget + custom sortable table
2. **Create `market.html`** — Heatmap widget + F&G gauge + pair ratios
3. **Add shared nav bar** to all 3 pages
4. **Extract shared CSS/JS** when adding pages 2+3
5. **Add F&G to pipeline** (`scripts/export-dashboard-data.py`)
6. **Update `PLAN.md`** roadmap with new pages

---

_This doc supersedes the single-page assumptions in earlier specs._
