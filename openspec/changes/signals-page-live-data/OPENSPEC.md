# Signals Page — Live Data + Badge Rethink

**Status:** Implemented
**Owner:** Idan
**Date:** 2026-04-17
**Implemented commit:** `21e76ef`
**Related:** `watchlist-page`, `data-integrity-guards`

## Why

The Signals page (`v1/signals.html` + `js/pages/signals.js`) is showing **stale, contradictory data**. Example: MSFT renders "EXIT SIGNAL + BULL + Bear Flag + Medium vol" at $411.22 — because:

- `TICKERS` is a **hardcoded 13-entry array** baked into `js/pages/signals.js`. Price/SMA/RSI are patched from `watchlist.json` at render time, but `status`, `statusLabel`, `pattern`, `analysis`, `exitWarning`, and `sparkline` are **never refreshed**.
- Only **13** of **80** watchlist tickers are shown.
- The "green line graph" on each card is a 30-point **fake** `sparkline` array hardcoded in the source file — not real price history.
- Cards display up to **5 badges** (status, bias, pattern, volatility, sector-risk) with **no tooltips** explaining what any of them mean.
- The `stop | entry | T1 | T2` progress bar is also hardcoded per-ticker and has no hover explanation.

This violates the core rule: **dashboards must reflect live data**. It also fails UX: a trader can't tell which badge matters, what the colored line is, or whether any of it is current.

## What Changes

### 1. Remove hardcoded `TICKERS` — data comes from `watchlist.json`
- Delete the 13-entry `TICKERS` literal.
- At `init()`, fetch `watchlist.json` and build the ticker list **entirely** from live data.
- Map watchlist fields → card fields:
  - `status` (from export-dashboard-data: `exit | triggered | approaching | active | watching`)
  - `bias`, `price`, `change`, `sma20`, `sma50`, `sma200`, `w20`, `rsi`, `atr`, `atrPct`, `volRating`, `volume`, `volumeRatio`, `earningsDate`, `pctFrom52wHigh`
- Drop per-ticker `pattern`, `analysis`, `exitWarning` hardcoded strings. Pattern is **optional** and only shown when the data pipeline provides it (future).
- Drop hardcoded `stop/entry/t1/t2` price targets. The progress bar is replaced (see §4).

### 2. Status taxonomy — one source of truth
Canonical statuses (from `scripts/export-dashboard-data.py`):
- `exit` — crossed below SMA20 today (actionable risk)
- `triggered` — crossed above a key MA today (actionable entry)
- `approaching` — within 2% of SMA20 or SMA50
- `active` — >5% extended above SMA20 in a bull stack
- `watching` — none of the above

All UI labels, icons, colors, filter tabs must map 1:1 to this enum. No more `TRAILING — Raise Stop` unless the pipeline emits it.

### 3. Badge rethink — fewer, clearer, always with tooltips
**Reduce from 5 badges → 2 primary + 1 contextual, each with a `title` attribute explaining the meaning and current computed value.**

Primary badges (always shown):
- **Status** badge — `<status>` (exit/triggered/approaching/active/watching) with `title="Why: <reason string computed from live data>"`
- **Bias** badge — `BULL | BEAR | MIXED` with `title="Price vs SMA20/50/W20: <stack summary>"`

Contextual badges (shown only when relevant):
- **RSI** badge — only when RSI > 70 (OB) or RSI < 30 (OS); `title="RSI 72.4 — overbought"`
- **Earnings** badge — only when `earningsDays <= 14`; `title="Earnings in 5 days — 2026-04-29"`
- **Sector risk** badge — keep (already has title), improve copy.

Drop from the card header row:
- Pattern badge (move to optional analysis section, only when pipeline provides it)
- Volatility rating badge (redundant with ATR% shown in stats row)

### 4. "Green line graph" → real sparkline OR removed
The current fake sparkline is worse than nothing. Options, in order of preference:
1. **If `watchlist.json` grows a `history` / `sparkline` field** (30-day closes) → render it truthfully with axes-less but with a `title` tooltip showing "30-day price, $min – $max, trend <up/down/flat>".
2. **Interim:** remove the sparkline until real data is wired. A misleading chart is a bug, not a feature.

This spec **chooses option 2 for now** (remove) and opens a follow-up (`signals-sparkline-real`) to add real 30-day history to `watchlist.json`.

### 5. Price progress bar → "Technical Range" bar with hover
The stop/entry/T1/T2 bar was based on hardcoded per-ticker targets that don't exist in live data. Replace with a **Technical Range bar** built from live numbers:

- Left anchor: **52-week low** (`low52w`)
- Right anchor: **52-week high** (`high52w`)
- Markers on the bar:
  - SMA200 (if in range)
  - SMA50
  - SMA20
  - Current price (dot)
- Hover (`title`) on each marker: label + value + distance from price.
- Hover on the whole bar: `"$low52w – $high52w, currently X% off high, Y% off low"`.

This replaces speculative trade targets (which weren't real) with an objective "where is this stock in its annual range?" visual. Intuitive without needing a key.

### 6. Tooltips everywhere
Every interactive element gets a `title` attribute. No bare icons, no bare badges. Acceptance criterion: open the page, hover any glyph, get a human-readable explanation.

### 7. Hide tickers missing required fields
If `watchlist.json` has `status: null` for a ticker (6 currently do), skip it rather than rendering a broken card. Log the count in dev mode.

## Out of Scope

- Adding a `pattern` detection pipeline (separate spec later).
- Adding `analysis` narratives per ticker (Tom publisher or future LLM step — separate spec).
- Real 30-day sparkline data (follow-up spec `signals-sparkline-real`).
- Changing the right-rail (Fear/Greed, sector rotation, briefing) — untouched.

## Acceptance Criteria

- [x] `js/pages/signals.js` no longer contains a hardcoded `TICKERS` literal.
- [x] All cards render from `data/watchlist.json` (+ `bt-prices.js` live overlay + `sector-risk.json`).
- [x] MSFT at $411.22 shows `status=watching`, `bias=bull`, no "EXIT SIGNAL", no "Bear Flag" (verified by `tests/signals.test.js` live-data test).
- [x] Up to 80 tickers renderable; filters match live `status` enum (`exit | triggered | approaching | active | watching`).
- [x] Every badge has a `title` attribute with a data-grounded explanation.
- [x] Fake sparkline removed (no green/red line of random numbers).
- [x] New Technical Range bar renders 52w low → 52w high with SMA20/50/200 markers and hover text.
- [x] Tests: `tests/signals.test.js` — 13 Jest tests covering `mapWatchlistToSignal()` (status/bias mapping, null filtering) + live `watchlist.json` MSFT integration.
- [x] Docs: `docs/SIGNALS.md` explains data flow + badge semantics.

## Commit Plan

1. ✅ Spec (this file)
2. ✅ Implement `mapWatchlistToSignal()` + refactor `renderCard()` to consume mapped object.
3. ✅ Delete `TICKERS` literal. (`sectorRotation` still hardcoded — tracked under `sector-rotation-chart` change.)
4. ✅ Replace fake sparkline with Technical Range bar (52w low → high + SMA markers).
5. ✅ Add `title=` tooltips to every badge + range-bar marker + level pill.
6. ✅ Add tests: `tests/signals.test.js` (13 tests, all passing, runs in full `npx jest` suite: 136 passed).
7. ✅ Write `docs/SIGNALS.md`.
8. ✅ Mark spec `Implemented` + commit hash in git log.
