# OpenSpec: Global Sticky Nav — Unified Scroll Experience

**Status:** Implemented
**Date:** 2026-04-17
**Implemented:** 2026-04-17
**Priority:** High
**Author:** Kash (AI Assistant)

---

## Problem Statement

The top nav bar (`.nav-bar`) is declared `position: sticky; top: 0; z-index: var(--z-nav)` in `css/shell.css`, so it already sticks on scroll at the page level. However, several pages declare their **own** sticky table headers or sub-headers with `top: 0`, which causes them to stick against the viewport top — colliding with (and potentially being covered by) the nav bar.

Specifically:
- `css/watchlist.css:71` — `.watchlist-table th { position: sticky; top: 0; z-index: 10 }`
- `css/expected-moves.css:72` — `.em-table thead th { position: sticky; top: 0 }`

Because these have lower `z-index` (10) than the nav (100), they slide *under* the nav on scroll, but they shouldn't be trying to stick at `top: 0` in the first place — they should stick directly below the nav. The visual result today is inconsistent: on long tables the column headers visually disappear behind the nav as the user scrolls.

The watchlist refresh (2026-04-17) also introduced a `.wl-col-panel` (column picker) with `position: absolute` and no z-index — on heavily-scrolled pages this could be rendered underneath ticker-tape widgets or other `position:relative` content.

---

## Goals

1. **Single scroll experience** — Nav bar stays pinned at the top of the viewport on every page/tab, with no page breaking the pattern.
2. **No overlap** — Page-level sticky headers (table headers, sub-section headers) stick **below** the nav, not at `top: 0`.
3. **z-index stack is authoritative** — All sticky elements respect the documented layer order:

```
z-modal       200  (modal overlays, search modal)
z-dropdown    150  (search autocomplete, column picker, select menus)
z-nav         100  (nav bar — ALWAYS visible on scroll)
z-ticker-tape  90  (ticker tape — scrolls with page, lower than nav)
z-table-head   80  (per-page sticky table headers — below nav, above content)
z-content       1  (default content)
```

4. **Regression tests** — Lint script that fails if any CSS declares `position: sticky; top: 0` for a non-nav element (other than the nav bar itself).

---

## Non-Goals

- Do not change body/html scroll mechanics (scroll stays on `<body>`).
- Do not make the ticker tape sticky (it intentionally scrolls off so table headers have room).
- Do not change nav height or nav content.

---

## Architecture

### CSS variables (`css/variables.css`)

Add `--z-table-head: 80` to the z-stack. Nav stays at 100, so sticky table heads at 80 slide cleanly **below** the nav when scrolling.

Add `--sticky-top-offset: var(--nav-height)` (or `calc(var(--nav-height))`). Sub-page sticky elements reference this instead of hardcoding `top: 0`.

### Per-page fixes

| File | Old | New |
|------|-----|-----|
| `css/watchlist.css:71` | `position: sticky; top: 0; z-index: 10` | `position: sticky; top: var(--sticky-top-offset); z-index: var(--z-table-head)` |
| `css/expected-moves.css:72` | `position: sticky; top: 0` | `position: sticky; top: var(--sticky-top-offset); z-index: var(--z-table-head)` |
| `css/watchlist.css` column picker `.wl-col-panel` | `position: absolute` (no z-index) | keep `position: absolute`, add `z-index: var(--z-dropdown)` |

### Cross-tab QA

Every tab must be scrollable with nav pinned. Tabs verified:
- `#home` (dashboard)
- `#watchlist` (refactored 2026-04-17)
- `#expected-moves`
- `#events`
- `#signals`
- `#market`
- `#sector-rotation`
- `#autoresearch`

---

## Implementation Tasks

- [x] Add `--z-table-head: 80` and `--sticky-top-offset` to `css/variables.css`
- [x] Fix `.watchlist-table th` sticky offset + z-index
- [x] Fix `.em-table thead th` sticky offset + z-index
- [x] Add `z-index: var(--z-dropdown)` to `.wl-col-panel`
- [x] Add `scripts/lint-sticky.sh` — greps for `sticky.*top:\s*0` (excluding nav-bar) and fails if found
- [x] Add Jest test `tests/sticky-nav.test.js` that parses each CSS file and asserts no offending `top: 0` sticky rules
- [x] Update `openspec/INDEX.md` with link to this change
- [x] Commit + push

---

## Testing

### Unit test (`tests/sticky-nav.test.js`)
Parses `css/*.css` and asserts:
1. `.nav-bar` is the only rule with `position: sticky` + `top: 0`.
2. Every other `position: sticky` declaration uses `top: var(--sticky-top-offset)` or an explicit non-zero offset.
3. Every sticky table header rule has an explicit `z-index` value lower than `var(--z-nav)`.

### Manual QA matrix
For each tab: scroll to bottom, verify nav remains fully visible, table column headers stick below nav (not overlapping), dropdowns/modals still cover nav when activated.

### Mobile QA
iOS Safari rubber-band behavior: nav should still pin. Verify on `width <= 768px` via Chrome devtools.

---

## Rollback

Revert the commit. No data migration required.
