# EM History Sparkline + Triage UX — OpenSpec

> Created: 2026-05-09
> Status: **Shipped**
> Shipped: 2026-05-09 · commit `a8bfb02`
> Priority: **Medium**
> Page: `v1/expected-moves.html`
> Tracking: was Planned in INDEX.md ("EM History Sparkline — Inline table sparkline still planned")

## Problem

The Expected Moves page is a **triage tool** ("which tickers are at the bottom of their range, and which are stretched") but four pieces of data the producer already writes are unused or under-used:

1. **`history[]`** (up to 33 daily snapshots per ticker) is never rendered. The detail modal shows only the current tier cards. Traders cannot see whether a ticker's been near support for one day or four weeks straight (= losing edge).
2. **`weekly_em` and `straddle` over time** — the page has no sense of whether implied vol is expanding or contracting.
3. **`watchlist[].bias`** — used per row, but the stats row counts buy-zone tickers without breaking down by bias. A bullish-biased ticker in buy zone is the highest-conviction long setup; mixed in with bears, the count is muddied.
4. **The Risk Meter column duplicates the Position in Range column** — both render a colored bar whose width is `position%`. Dead pixel real estate.

Other ergonomics gaps:

5. **No alert-tag filter** — table can be filtered by symbol category, but not by "show me only buy zones / extended / outside EM".
6. **No useful default sort** — when no user sort is active, order is JSON insertion order (effectively `DEFAULT_TICKERS` order in the producer). Buy-zones do not float to the top.
7. **Stale-data UX is hidden** — when EM data is >48h old, only the timestamp turns red. The original Mar 27 staleness bug (writeup in `expected-moves/proposal.md`) showed users miss the timestamp; the page misled while looking authoritative.

## Goals

Make the triage faster and more credible by surfacing what's already in the data:

- **Detail modal:** add a 30-day "EM band vs realized close" chart so a click reveals whether this ticker has been respecting its EM (and where it broke).
- **Inline table:** replace the redundant Risk Meter column with an **IV Trend** indicator (▲/▼/—) computed from the history array.
- **Stats row:** break down Buy Zone and Extended counts by watchlist bias.
- **Filters:** add Buy Zone / Extended / Outside EM chips that AND with the existing category filter.
- **Default sort:** position ASC when no user sort is active (buy-zones at top).
- **Stale banner:** when data is >48h old, show a top-of-page banner — not just a red timestamp.

## Non-Goals

- No producer changes. All data already exists in `data/expected-moves.json`.
- No quarterly history work — that already shipped in v2 (`js/pages/expected-moves.js`) and is tracked under `Quarterly EM History` (2026-04-03).
- No v2 SPA changes in this PR. v1 is production; v2 will get the same treatment in a follow-up.
- No new dependencies. SVG is rendered inline (no chart library).

## Design

### 1. Detail-modal history chart

Inline `<svg>` (~360×140) inside `#em-modal-body`, between the TradingView chart and the tier cards. For each ticker:

- X axis: latest N snapshots from `history[]` (N = up to 30, fewer if history is shorter).
- Y axis: `close`. Y range = `[min(close, lower) − 1%, max(close, upper) + 1%]`.
- **Shaded band:** `<polygon>` between `close + weekly_em` (upper) and `close − weekly_em` (lower) for each snapshot — the predicted EM range as it evolved.
- **Price line:** `<polyline>` of `close`.
- **Breach markers:** `<circle r="3">` on snapshots where `close > prev.close + prev.weekly_em` or `close < prev.close − prev.weekly_em` (i.e. that day's close moved beyond the previous snapshot's predicted band). Color: red if up-breach, cyan if down-breach.
- **Caption below chart:** `Last N days · K breach(es) · IV trend ▲/▼/— X%`.

For tickers with `history.length < 2`, the section is omitted (no chart shown).

### 2. IV Trend column (replaces Risk Meter)

Computed in `buildRows()` from the same `history[]`:

```
recentEM   = mean(weekly_em over last 5 history entries) || current weekly_em
priorEM    = mean(weekly_em over the 5 entries before that) || recentEM
trendPct   = (recentEM − priorEM) / priorEM × 100
```

Display:
- `▲ +X%` red — IV expansion (≥+5%)
- `▼ −X%` green — IV contraction (≤−5%)
- `— flat` gray — between −5% and +5%
- `—` gray dim — insufficient history (< 4 entries)

Rationale: rising IV = options are pricing bigger moves than they were a week ago = expect bigger EM ranges going forward. Falling IV = consolidation. Knowing direction qualifies the static EM%.

Sortable: by `trendPct` numerically.

### 3. Bias-aware stats

Replace flat counts with `total (X bull / Y bear / Z mixed)` for Buy Zone and Extended cards. Bias source is the existing `watchlistData.find(w => w.symbol === sym).bias` already computed per row.

### 4. Alert-tag filter chips

New filter row `.alert-filter-tabs` below the existing tier+filter row, with three chips:

- 🟢 Buy Zone (`position ≤ 20`)
- 🔴 Extended (`position ≥ 85`)
- ⚡ Outside EM (`position < 0 or position > 100`)

Click toggles. Multiple chips can be active = OR (any match passes). When no chip is active, behavior is unchanged. AND-ed with the existing All / Indices / Top10 / Watchlist filter.

### 5. Smart default sort

When `sortCol === null`, sort by position ASC. The `sortRows()` change is one line. User clicks on any header still override and can return to "default sort" via the third state of the cycle (currently clears sort, after change defaults to position ASC).

### 6. Stale-data banner

If `ageHours > 48`, prepend a `.stale-banner` div above the stats row:
`⚠️ Expected Move data is X days old. Run update-expected-moves.py to refresh.`
Background red, no dismiss (returns automatically when fresh data arrives).

## File Touches

- `v1/expected-moves.html` — single file, ~120 lines added/changed (CSS + JS + markup).
- `tests/em-page-improvements.test.js` — new Jest file with unit tests for IV trend, default sort, bias-aware stats, alert-tag filter, and history-chart guard.
- `openspec/INDEX.md` — move "EM History Sparkline" row from Planned → Active, then Shipped after merge.
- `docs/EXPECTED_MOVES_PAGE.md` — added/updated to reflect new columns + filters (if file exists; created if not).

## Test Plan

- `cd tests && npx jest` — must remain at 137 + new test count, 0 failures.
- `node tests/test-em-formula.js` — must remain at the same pass count (167) with no new failures (the 42 pre-existing failures are date-based on stale data and out of scope).
- Manual smoke (browser, `python3 -m http.server`):
  - Load `v1/expected-moves.html`. Buy zones float to top.
  - Click a ticker with history. Modal shows price-vs-band chart.
  - Toggle a filter chip. Rows narrow correctly.
  - Switch tier. Default sort still applies.
  - Force `ageHours > 48` (mock `data/expected-moves.json` with old `updated`). Banner appears.

## Risk

- **Sort default change** is user-visible. Mitigation: still cycle-able, third click returns to default (position ASC). Documented in PR body.
- **Risk Meter column removal** is user-visible. Mitigation: Position in Range already shows the same information with a clearer label.
- **History rendering** must guard against missing/short history arrays — covered in tests.

## Rollout

1. Land PR on `breakingtrades/breakingtrades-dashboard:main`.
2. GitHub Pages auto-deploys.
3. Update INDEX.md row to Shipped with commit hash.
4. Open follow-up issue for v2 SPA (`js/pages/expected-moves.js`) parity.

## Out of scope (follow-ups)

- v2 SPA parity (separate PR).
- Mobile card view at ≤768px (separate PR; existing horizontal scroll is acceptable for now).
- CSV export (separate PR).
- Bias-by-tier breakdown (compare bullish-buy-zone weekly vs monthly).
- EM-breach Telegram alerts (already tracked in `em-reliability-improvements`).
