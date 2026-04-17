# Signals Page — Live Data Architecture

**Last updated:** 2026-04-17
**Spec:** [openspec/changes/signals-page-live-data/OPENSPEC.md](../openspec/changes/signals-page-live-data/OPENSPEC.md)

## Overview

The Signals page renders one card per watched ticker. As of April 2026, **every field on every card is driven by live data** — no hardcoded ticker arrays, no fake analysis strings, no fake sparklines.

## Data Pipeline

```
update_watchlist.py (cron)  ─┐
                             ├→ data/watchlist.json  ─┐
update_prices.py (cron)      ─┤                       │
                             └→ data/prices.json      ├→ signals.js (render)
                                                      │
scripts/update-sector-rotation.py                     │
                             └→ data/sector-risk.json ┘
```

### `data/watchlist.json` — primary source of truth

Array of ticker rows. Each row:

| Field | Type | Meaning |
|---|---|---|
| `symbol` | string | Ticker (required) |
| `name` | string | Display name |
| `sector` | string | GICS sector |
| `price` | number | Latest close (required) |
| `change` | number | Intraday % change |
| `bias` | enum | `bull` \| `bear` \| `mixed` — derived from SMA stack |
| `status` | enum | `exit` \| `triggered` \| `approaching` \| `active` \| `watching` (required) |
| `sma20`, `sma50`, `sma200`, `w20` | number | Moving averages |
| `rsi` | number | RSI(14) |
| `atr`, `atrPct` | number | Average true range + % of price |
| `volRating` | string | `Low` \| `Normal` \| `Medium` \| `High` \| `Extreme` |
| `volume`, `volumeAvg20`, `volumeRatio` | number | Volume stats |
| `high52w`, `low52w`, `pctFrom52wHigh` | number | 52-week range |
| `earningsDate`, `earningsDays` | string/number | Next earnings + days away |
| `smaCrossover`, `smaCrossoverDate` | string | Recent golden/death cross |
| `updated` | ISO timestamp | Row last updated |

### `data/prices.json` — near-real-time overlay

Provided by `bt-prices.js`. On the Signals page, intraday price + change are overlaid on top of watchlist close prices.

### `data/sector-risk.json` — sector rotation quadrant map

Keyed by sector name → `{ etf, quadrant, risk }`. Attached to each card as `t._sectorRisk` so the sector rotation badge can render a tooltip.

## Card Anatomy

```
┌─────────────────────────────────────────────┐
│ AAPL  Apple · Technology       $232.14 ▼-0.8% │   ← header
├─────────────────────────────────────────────┤
│ [WATCHING] [BULL] [RSI 72 OB] [Earnings 8d] │   ← meta badges (every badge has title=)
├─────────────────────────────────────────────┤
│  $194 ────●──────SMA200──SMA50─SMA20─── $260│   ← technical range bar (52w low → high)
├─────────────────────────────────────────────┤
│ ● SMA20 $228.1 ↑  ● SMA50 $220.5 ↑ ...      │   ← level pills
├─────────────────────────────────────────────┤
│ 📊 Vol: 52.1M (1.2x avg)  ⚡ ATR: $6.20     │   ← stats row
└─────────────────────────────────────────────┘
```

**Every badge and level pill has a `title=` tooltip** explaining what it means and why it's lit. Hover behavior is native HTML `title`, so it works without JS.

### Status Taxonomy (STATUS_CONFIG in signals.js)

| Status | Icon | Tip |
|---|---|---|
| `exit` | ⚠️ | Exit signal — stop invalidated or trend break |
| `triggered` | 🎯 | Entry trigger hit (breakout / pattern completion) |
| `approaching` | 🕐 | Price nearing an entry zone or key level |
| `active` | 📈 | Position active, price in target zone |
| `watching` | 👁 | Monitoring; no active trigger |

### Bias Taxonomy

- `bull` — price above SMA20/50/W20 (bullish stack)
- `bear` — price below SMA20/50/W20 (bearish stack)
- `mixed` — price between the MAs (transitional)

## Key Functions (signals.js)

| Function | Purpose |
|---|---|
| `mapWatchlistToSignal(w)` | Validate + shape one watchlist row → card object. Returns `null` for broken rows (missing `symbol`, `status`, or `price`). |
| `buildStatusReason(t)` | Generates the status-badge tooltip (why this status). |
| `biasTip(t)` | Generates the bias-badge tooltip. |
| `renderCard(t, idx)` | Renders the card HTML (tooltips on every badge). |
| `renderStatusTabs()` | Renders the filter tabs with counts per status. |
| `renderPairRatios(watchlist)` | Renders the pair-ratios strip from the live watchlist. |

All three helper functions (`mapWatchlistToSignal`, `buildStatusReason`, `biasTip`) are exposed on `BT.pages.signals._*` for unit testing.

## Tests

See `tests/signals.test.js` (13 tests). Covers:
- Null/broken input handling
- Canonical shape mapping
- Safe defaults for optional fields
- Status/bias tooltip strings
- **Live `watchlist.json` integration** — guards against the "EXIT + BULL + price above SMA20" contradiction that used to ship in hardcoded fake data

Run with: `cd tests && npx jest signals.test.js`

## Migration Notes

**Removed in this refactor (Apr 2026):**
- Hardcoded `TICKERS` array (~160 lines of mock data including AAPL, PFE, MSFT with made-up price/SMA/RSI values)
- Mock sparkline arrays (`sparkline:[75,72,70,...]`)
- Hardcoded `pattern` + `vol` objects per ticker
- Hardcoded `entry`/`stop`/`t1`/`t2` trade levels
- Hardcoded `analysis` prose strings
- `exitWarning` hardcoded strings

**Added:**
- `mapWatchlistToSignal()` — live data mapper
- `STATUS_CONFIG` table (was scattered ternaries)
- Technical range bar (52w range + SMA markers) — replaces fake sparkline
- `title=` tooltip on every badge/pill
- `triggered` status (new from watchlist pipeline)
- Jest test suite (`tests/signals.test.js`)

## Out of Scope (known stale areas, separate work)

- `sectorRotation` array (XLU/XLE/... RRG coordinates) is still hardcoded in signals.js. Tracked under `openspec/changes/sector-rotation-chart/`.
- Detail modal "charts/ta/pattern/range/levels/analysis" sections still use mixed sources.
