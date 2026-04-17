# EM Page — Sticky Header Overlaps First Row (SPY hidden / glow bug)

**Status:** Implemented
**Owner:** Idan
**Date:** 2026-04-17
**Implemented commits:** `21e76ef` (v1 offset + padding), `0c23edb` (row stacking bandaid), `<pending>` (proper isolate fix)

## Why

On the EM page, the SPY row (first data row) was visually broken in two distinct ways across the two deployed versions:

1. **v1 (`v1/expected-moves.html`, GitHub Pages)** — SPY completely hidden. The sticky thead pinned to `top: 0` instead of below the 48px top nav, overlapping the first tbody row.
2. **v2 (SPA, Azure SWA)** — SPY rendered correctly at scroll=0, but when the user scrolled, SPY's gold `em-pos-marker` (absolute, `top: -3px`) painted as a yellow/gold glow *above* the sticky thead, making it look like a ghost row was pinned above the header.

Both symptoms share a single architectural cause: **the sticky thead's z-index was fighting descendants of tbody rows that escaped into the page's root stacking context.**

## Root Cause

### v1 — sticky offset wrong
Inline `<style>` in `v1/expected-moves.html` had `thead th { top: 0; }`. The global top nav is also `position: sticky; top: 0`, so when scrolled, the header pinned *underneath* the nav (z-order: nav on top, thead hidden, SPY also under both).

### v2 — stacking context leak
`.em-table thead th` has `position: sticky; top: 48px; z-index: 80`. But z-index only works relative to a stacking context. Without an explicit stacking context on `.em-table-wrap`, the sticky th's z:80 was compared against elements in the **root stacking context**. Meanwhile:

- `.em-pos-marker` is `position: absolute; top: -3px; height: 14px` (gold dot that intentionally overflows its `.em-pos-bar` parent by 3px on top/bottom)
- `.em-pos-bar` is `position: relative` (not a stacking context — no z-index, no transform, no opacity < 1)
- `<td>` and `<tr>` are non-positioned
- Therefore the absolute marker's paint layer bubbled up to the **root stacking context** at `z-index: auto`

In the root stacking context, paint order for `z: auto` positioned elements is DOM order (later wins). tbody comes after thead in DOM, so the marker could paint on top of thead — EXCEPT thead's th has an explicit `z: 80`, which creates its own stacking context that should always win over `z: auto`.

The remaining bug was subtler: **`position: sticky` + `overflow-x: auto` on the wrapper has a known quirk** where the sticky element's stacking context can be bypassed by descendants of siblings that escape the wrapper's clipping. Without `isolation: isolate` on `.em-table-wrap`, the sticky header's z-index was not guaranteed to scope properly.

## Fix

### Layer 1 — v1 offset (commit `21e76ef`)
`v1/expected-moves.html` inline `<style>`:
```css
thead th {
  position: sticky;
  top: var(--nav-height, 48px);  /* was: top: 0 */
  z-index: 5;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
tbody tr:first-child td { padding-top: 12px; }
```

### Layer 2 — v2 cosmetic (commit `21e76ef`)
`css/expected-moves.css` (v2 SPA) got the same `box-shadow` + first-row `padding-top: 12px` for visual consistency.

### Layer 3 — proper architectural fix (pending commit)
Both stylesheets now use `isolation: isolate` on the table wrapper to establish a clean stacking context boundary. This scopes the sticky thead's `z-index: 80` to the wrapper, guaranteeing it always paints above any tbody descendant regardless of their DOM order or stacking escape quirks.

```css
.em-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  isolation: isolate;  /* scope sticky thead's z-index to this wrapper */
}
```

Additionally, `.em-table tbody tr { position: relative; z-index: 0 }` remains as a belt-and-suspenders defense: it contains each row's absolutely-positioned descendants (pos-marker, pos-fill, risk-fill) within the row's own stacking context, so they can never paint outside their row's layer. This is safe because the alert row `border-left: 3px solid` still renders correctly (borders are part of the box model, not absolute overlays).

## Why `isolation: isolate` is the right primitive

- **Explicit over implicit.** It makes "this wrapper owns its own z-index space" a stated intent, not an accident of `position: relative + z-index: N`.
- **No side effects.** Unlike `transform: translateZ(0)` or `will-change: transform`, `isolation: isolate` creates a stacking context without triggering GPU layer promotion or changing paint behavior in any other way.
- **Future-proof.** Any new sticky/absolute element added inside `.em-table-wrap` will respect its scope. No more "why is my dropdown rendering behind the row" debugging later.

## Acceptance

- [x] SPY renders as the first data row on a hard-reload of both `v1/expected-moves.html` and the v2 SPA (`#expected-moves`).
- [x] Sticky header stops below the top nav when scrolled (v1 offset fixed).
- [x] No gold/yellow "glow" sliver appears above the thead when scrolling through rows on v2.
- [x] `elementFromPoint()` at any overlap zone returns `TH`, never a tbody descendant.
- [x] Alert rows (`tr.alert-buy`, `tr.alert-sell`) still render their `border-left: 3px solid` accent.
- [x] First row has 12px top padding for visual breathing room.

## Scope

CSS-only. No JS, no HTML structure changes, no data pipeline changes. Ships to both v1 and v2.

## Tests

Manual verification via `browser act` (CDP):
- Navigate to `/#expected-moves`, scroll to various Y offsets (0, 380, 800)
- For each offset, assert `elementFromPoint(marker_x, thead_top + 1) === TH`
- Assert first tbody row's symbol is `SPY` at scroll=0

Automated CSS presence check added to `tests/signals.test.js`-style suite is out of scope here (CSS rendering requires a real browser; we rely on devtools verification + visual QA).

## References

- MDN: [`isolation`](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation)
- MDN: [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)
- CSS Containment Module Level 3: `isolation: isolate` creates a new stacking context without other side effects
