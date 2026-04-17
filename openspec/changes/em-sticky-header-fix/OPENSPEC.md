# EM Page — Sticky Header Overlaps First Row (SPY hidden)

**Status:** Implemented
**Owner:** Idan
**Date:** 2026-04-17

## Why

On `v1/expected-moves.html`, the SPY row (first data row) was visually hidden — covered by the sticky table header. Screenshot showed the thead occupying the space where SPY should render, with only a sliver of SPY's yellow risk-meter leaking through the top of the header row.

## Root Cause

Two stylesheets define `thead th` for the EM table:

- `css/expected-moves.css` (v2 SPA page) — **correct**: `top: var(--sticky-top-offset)` (= `--nav-height` = 48px). Header stops below the sticky nav.
- Inline `<style>` in `v1/expected-moves.html` (static v1 page) — **wrong**: `top: 0;`. Header pins to viewport y=0, *underneath* the 48px top nav. Nav paints over header; first tbody row (SPY) sits in the overlap zone and gets visually tucked under the sticky header when the page scrolls.

Additionally, neither stylesheet gave the thead a `box-shadow` to create visual separation from the first row, and the first `<tr>` had no extra top padding — so even without the offset bug, the first row hugged the header line.

## Fix

1. **`v1/expected-moves.html`** inline `<style>` — `thead th { top: var(--nav-height, 48px); z-index: 5; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }` and `tbody tr:first-child td { padding-top: 12px; }`.
2. **`css/expected-moves.css`** (for v2 SPA) — added the same `box-shadow` + first-row `padding-top: 12px` for consistency, even though the offset was already correct there.

## Acceptance

- [x] SPY renders as the first data row on a hard-reload of `v1/expected-moves.html`.
- [x] Sticky header stops below the top nav when scrolled (not under it).
- [x] First row has visible breathing room from the header edge.

## Scope

Low-risk CSS-only change. No JS, no data pipeline changes.
