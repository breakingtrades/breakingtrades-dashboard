# OpenSpec: Watchlist Refresh
**Status:** Implemented  
**Date:** 2026-04-17  
**Implemented:** 2026-04-17  
**Priority:** High  
**Author:** Kash (AI Assistant)

---

## Problem Statement

The current watchlist (`#watchlist`) is a basic sortable table with 9 columns, no filtering, no grouping, and no sector lens. With 80 symbols across 20 sectors and 10 groups, it's impossible to slice the list by sector, bias, setup status, or any meaningful trading criteria. There's value in the data that isn't surfaced — RSI extremes, Bollinger squeezes, earnings proximity, volume alerts — but none of it is scannable at a glance.

A professional watchlist should feel like a Bloomberg/Koyfin terminal — fast, filterable, information-dense, and actionable.

---

## Goals

1. **Filter bar** — Quick-filter by sector, group, bias (bull/bear/mixed), status (watching/approaching/active/exit), and signal alerts
2. **Sorting** — Multi-column sort on all numeric fields (price, change, RSI, ATR%, volume ratio, SMA dist, 52w pos)
3. **Grouping** — Toggle table grouping by sector OR by group (Tom's watchlist sections)
4. **Sector summary cards** — Aggregate stats per sector (avg bias, count, % bull) shown as a mini scorecard above the table
5. **Search** — Live ticker/name search (already exists in nav; add inline table filter too)
6. **Alert badges** — Inline signal indicators: 🟡 earnings, ⚡ volume spike, 🔵 BB squeeze, ↑↓ RSI extremes
7. **Column selector** — Show/hide optional columns (RSI, ATR, BB width, earnings)
8. **Stat bar** — Summary row above table: total symbols, # bull/bear/mixed, # approaching, # active

---

## Non-Goals

- No new data pipeline changes — all data already in `watchlist.json` and `expected-moves.json`
- No new backend scripts
- No layout changes to the detail modal (it's good)
- No changes to v1 (`watchlist.html`)

---

## Architecture

### Files Modified

| File | Change |
|------|--------|
| `js/pages/watchlist.js` | Major — filter/group/sort engine, stat bar, sector cards, alert badges |
| `css/watchlist.css` | Add filter bar, sector card, stat bar, column toggle, alert badge styles |

### No new files required.

---

## Feature Specs

### 1. Filter Bar

**Layout:** Horizontal strip between page header and table. Pill-style filter groups.

**Filter groups (in order):**
1. **Bias** — All | Bull | Bear | Mixed
2. **Status** — All | Watching | Approaching | Active | Exit
3. **Sector** — All | [each unique sector from data]  
   — Collapsed into dropdown after 5 items (to prevent wrapping)
4. **Group** — All | [each unique group from data]
5. **Alerts** — All | Earnings ≤14d | RSI Overbought | RSI Oversold | BB Squeeze | Volume Spike | Death Cross | Golden Cross

**Behavior:**
- Filters are AND-logic (all active filters must match)
- Filter state persists in `BT.preferences` (localStorage) — key: `watchlist.filters`
- Active filter count shown in header: "Watchlist — 42 / 80 Symbols"
- Reset button when any filter is active

**Implementation:** Pure JS filter against in-memory `watchlist` array. No re-fetch. Re-renders table on each filter change.

---

### 2. Sorting

**Current:** 3-state sort (asc/desc/none) on 9 columns.

**New columns added (sortable):**
- RSI
- ATR%
- Volume Ratio
- BB Width Percentile  
- % from 52w High
- Earnings Days

**Column headers:** Show sort indicator (▲▼ active, gray when inactive). Active sort column highlighted in header.

---

### 3. Grouping Toggle

**Trigger:** Button in page header — "Group by Sector" / "Group by Section" / "No Grouping"

**Group by Sector:**
- Table rows grouped under collapsible sector headers
- Sector header shows: sector name, count, % bull, avg change%

**Group by Section (Tom's groups):**
- Groups: Quality Stocks, Growth Stocks, Semiconductors, Sector ETFs, Macro/Index, Community Ideas, Healthcare, Energy & Commodities, Cyber Security

**No Grouping (default):**
- Flat table, all sort/filter active

**State persists** in `BT.preferences` — key: `watchlist.grouping`

---

### 4. Sector Summary Cards

**Layout:** 2-row scroller above the table (shown only in "No Grouping" or hidden when grouping is active). Scrollable horizontally on mobile.

**Card per sector (showing only sectors present after filtering):**
```
┌─────────────────────────┐
│ Technology          (12) │
│ ███████░░░░  68% bull   │
│ avg +1.4%    RSI 58     │
└─────────────────────────┘
```

- Progress bar = % bull in sector
- Average daily change%
- Average RSI
- Click card = apply sector filter

**Hidden** when sector filter is active (redundant).

---

### 5. Inline Search (Table Filter)

In addition to the nav-level search, add a text input in the filter bar that live-filters by `symbol` or `name`. Clears on filter reset.

---

### 6. Alert Badges

**In table rows** — after the ticker symbol cell, show compact icon badges:

| Badge | Trigger | Icon | Color |
|-------|---------|------|-------|
| Earnings | `earningsDays <= 14` | calendar | orange |
| Earnings | `earningsDays <= 7` | calendar | red |
| RSI OB | `rsi > 70` | triangle-alert | red |
| RSI OS | `rsi < 30` | trending-up | cyan |
| BB Squeeze | `bbWidthPercentile < 15` | zap | orange |
| Vol Spike | `volumeRatio > 2.0` | flame | cyan |
| Death Cross | `smaCrossover === 'death_cross'` | skull | red dim |
| Golden Cross | `smaCrossover === 'golden_cross'` | star | cyan dim |

Badges shown inline in ticker cell (not tooltip — visible at a glance).

---

### 7. Column Selector

Button in page header (gear icon). Dropdown checklist of optional columns:
- [x] RSI
- [x] ATR%  
- [ ] BB Width Pct
- [x] Volume Ratio
- [x] Earnings
- [ ] 52w Position

Visible columns persist in `BT.preferences` — key: `watchlist.columns`.

---

### 8. Stat Bar

**Layout:** Single horizontal strip between filter bar and table.

```
80 symbols  |  42 Bull ▲  |  28 Bear ▼  |  10 Mixed  |  5 Approaching  |  3 Active  |  12 Earnings ≤14d
```

Updates reactively with filtered set. All counts are of the currently visible (filtered) rows.

---

## Column Layout (Final)

| # | Column | Default | Sortable | Optional |
|---|--------|---------|----------|---------|
| 1 | Ticker + badges | Always | ✓ | |
| 2 | Name | Always | ✓ | |
| 3 | Sector | Always | ✓ | |
| 4 | Price | Always | ✓ | |
| 5 | Change % | Always | ✓ | |
| 6 | SMA20 dist | Always | ✓ | |
| 7 | SMA50 dist | Always | ✓ | |
| 8 | RSI | Default on | ✓ | ✓ |
| 9 | ATR% | Default on | ✓ | ✓ |
| 10 | Vol Ratio | Default on | ✓ | ✓ |
| 11 | Earnings | Default on | ✓ | ✓ |
| 12 | Bias | Always | ✓ | |
| 13 | Status | Always | ✓ | |

---

## Visual Design

### Color Palette (existing tokens)
```
--cyan:   #00d4aa  (bull, positive)
--red:    #ef5350  (bear, negative, alert)
--orange: #ffa726  (warning, approaching)
--gold:   #ffd54f  (neutral, mixed)
--text-dim: #6b7280
--bg-card: #0f0f1a
```

### Filter Bar
- Pill buttons, same style as existing EM tier tabs
- Selected = cyan background with dark text
- Unselected = transparent with dim border
- Sector dropdown: custom `<select>` styled or JS dropdown panel

### Sector Cards
- Dark card background with 1px border
- Progress bar: cyan fill on dark track
- Text: monospaced numbers

### Alert Badges
- 16×16px Lucide icons
- Tooltip on hover with full signal text
- Stacked horizontally, max 4 visible (overflow hidden with `+N` indicator)

---

## Tests

### New test file: `tests/watchlist.test.js`

**Coverage:**
1. **Filter engine** — AND-logic across bias/status/sector/group/alert combinations
2. **Alert badge logic** — Correct signal triggers for each badge type
3. **Sector aggregation** — Correct count, % bull, avg change computation
4. **Sort stability** — Secondary sort preserves row order for equal values
5. **Stat bar counts** — Bull/bear/mixed/approaching/active/earnings counts match filtered data
6. **Filter persistence** — `BT.preferences` read/write for filter state
7. **Column visibility** — Hidden columns excluded from rendered HTML

**Test framework:** Jest (existing in `tests/package.json`)  
**Run:** `cd tests && npx jest watchlist.test.js`

---

## Documentation Updates

- Update `docs/FILTER_SYSTEM.md` — Add watchlist filter architecture section
- Update `openspec/INDEX.md` — Add this change to Shipped Changes table after completion

---

## Tasks

### Phase 1 — Filter Engine (JS)
- [ ] Add `activeFilters` state object to `watchlist.js`
- [ ] Implement `applyFilters(watchlist)` → returns filtered array
- [ ] Add alert signal classification function `classifyAlerts(ticker)` → `string[]`
- [ ] Wire filters to `renderTable()` 
- [ ] Persist filter state via `BT.preferences`

### Phase 2 — Filter Bar UI (JS + CSS)
- [ ] Render filter bar HTML in `render()` function
- [ ] Bias pills
- [ ] Status pills  
- [ ] Sector dropdown
- [ ] Group dropdown
- [ ] Alert filter pills
- [ ] Inline search input
- [ ] Reset button (shown when any filter active)
- [ ] Add CSS for filter bar in `css/watchlist.css`

### Phase 3 — Stat Bar
- [ ] Render stat bar HTML (between filter bar and table)
- [ ] Update counts on every filter change
- [ ] Add CSS for stat bar

### Phase 4 — Alert Badges
- [ ] Add badge rendering to ticker cell in `renderTable()`
- [ ] Add CSS for badges
- [ ] Add tooltip behavior (title attribute — no JS needed)

### Phase 5 — Column Selector
- [ ] Column visibility state in `BT.preferences`
- [ ] Gear button + dropdown UI
- [ ] Hide/show `<th>` and `<td>` columns by CSS class toggle
- [ ] Add CSS for column selector dropdown

### Phase 6 — Grouping
- [ ] Add grouping state toggle button
- [ ] Implement `renderGrouped(groupKey)` — sector or group-based rendering
- [ ] Collapsible group headers with stats
- [ ] Persist grouping state

### Phase 7 — Sector Summary Cards
- [ ] Compute sector aggregates from filtered watchlist
- [ ] Render card strip above table
- [ ] Card click → apply sector filter
- [ ] Hide when sector filter active or grouping active
- [ ] Add CSS for sector cards

### Phase 8 — Tests
- [ ] Create `tests/watchlist.test.js`
- [ ] Write all 7 test groups
- [ ] Ensure `npx jest` passes

### Phase 9 — Docs
- [ ] Update `docs/FILTER_SYSTEM.md`
- [ ] Update `openspec/INDEX.md`
- [ ] Commit and push

---

## Success Criteria

- [ ] Filter bar renders with all groups (bias, status, sector, group, alerts)
- [ ] Filtering reduces table rows correctly with AND-logic
- [ ] Stat bar counts update reactively
- [ ] Alert badges visible inline in table
- [ ] Column selector works (show/hide columns)
- [ ] Grouping by sector and group both work
- [ ] Sector summary cards render and filter on click
- [ ] All states persist in localStorage
- [ ] `npx jest watchlist.test.js` passes (≥ 40 assertions)
- [ ] No regression on existing watchlist functionality (sorting, modal, hash routing, TV widget)

---

## Implementation Notes

- All new JS stays in `js/pages/watchlist.js` (IIFE pattern, no new files)
- CSS classes follow existing BEM-lite naming: `.wl-*`
- Lucide icons for all new iconography (no emoji)
- Mobile-responsive: filter bar scrolls horizontally, sector cards stack vertically
- Filter bar should be `position: sticky; top: [nav height]` so it stays visible while scrolling
