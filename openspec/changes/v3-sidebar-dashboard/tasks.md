# V3 — Implementation Tasks

## Phase 2A — Sidebar shell + chrome migration (this PR)

### Setup
- [x] Branch `v3-sidebar-dashboard` created off main
- [x] OpenSpec proposal + design + tasks written
- [ ] Build `css/v3-tokens.css` with Wiz-inspired palette
- [ ] Build `css/sidebar.css` with sidebar shell, sections, items, dots
- [ ] Build `js/lib/sidebar.js` — render + bind + state persistence
- [ ] Build `js/lib/freshness.js` — SVG dot component + manifest fetch

### Chrome rewrite
- [ ] `index.html` — wrap content in `.v3-shell` flex layout: sidebar + main
- [ ] `index.html` — slim top bar to 44px utility strip (logo + cmdbar + market status + tape toggle + tz + avatar)
- [ ] `js/shell.js` — drop top-nav render, replace with `sidebar.mount()` call
- [ ] `js/shell.js` — replace ticker-tape + snapshot toggles with single 3-state button (off → snapshot → tape → off)
- [ ] Move logo + branding to sidebar header
- [ ] Move ticker search into cmdbar component (cmd-K shortcut)

### Routing aliases
- [ ] `js/router.js` — register `#calendar` route → `js/pages/calendar.js`
- [ ] `js/router.js` — alias `#week-ahead` → `#calendar?tab=week`
- [ ] `js/router.js` — alias `#events` → `#calendar?tab=events`
- [ ] Verify all existing `#hash` routes still resolve

### Calendar merge
- [ ] Build `js/pages/calendar.js` — sub-tab Events (default) + Week Ahead
- [ ] Migrate existing `js/pages/events.js` rendering as Events tab
- [ ] Migrate existing `js/pages/week-ahead.js` rendering as Week Ahead tab
- [ ] Sub-tab state in URL query (`?tab=events|week`)
- [ ] Delete old page files after rename

### Freshness manifest
- [ ] Modify `scripts/export-dashboard-data.py` to emit `data/freshness-manifest.json`
- [ ] Each feed entry includes `file`, `last_modified`, `age_seconds`, `ttl_seconds`
- [ ] Sidebar polls manifest every 60s when visible
- [ ] Initial render uses cached manifest from preferences for instant first paint

### Mobile
- [ ] Drawer open/close behavior
- [ ] Backdrop click closes
- [ ] Esc key closes
- [ ] Touch swipe from left edge opens
- [ ] Hamburger button in top bar (only visible <768px)

### A11y
- [ ] `<nav aria-label="Primary">` wraps sidebar
- [ ] `aria-current="page"` on active item
- [ ] Collapse button `aria-expanded` + `aria-controls`
- [ ] Drawer `role="dialog" aria-modal="true"`
- [ ] Tab order through nav items
- [ ] Tooltip on collapsed-state hover with full label

### Tests
- [ ] `tests/sidebar.test.js` — sidebar mounts on every page
- [ ] All routes resolve (existing + new aliases)
- [ ] Mobile drawer toggles
- [ ] Freshness dots render correct color for synthetic mtimes
- [ ] `python3 scripts/serve.py 8889` — manual click-through every item

### Deploy
- [ ] Merge `v3-sidebar-dashboard` → main when user approves
- [ ] Verify Azure SWA deploy succeeds
- [ ] Smoke-test brave-glacier production URL

## Phase 2B — AI-Trader page (next PR, gated on user OK)

- [ ] Define `data/ai-trader-calls.json` schema
- [ ] Define `data/ai-trader-track-record.json` aggregated metrics
- [ ] Build `js/pages/ai-trader.js`
- [ ] Equity curve chart, recent calls, by-category breakdown, vs-Tom comparison
- [ ] Decide call-emission contract (manual? auto from rule triggers?)

## Phase 2C — Holdings page (next PR, gated)

- [ ] Define `data/ai-trader-holdings.json` schema (public, no IBKR)
- [ ] Build `js/pages/holdings.js`
- [ ] Position cards: ticker, entry, current, P/L, source rule, conviction
- [ ] Filter: active / closed / all

## Phase 2D — Alerts inbox + settings (next PR, gated)

- [ ] Define alert source (where do alerts come from?)
- [ ] Build alerts page, mark-read/dismiss UI
- [ ] Build settings panel (theme, density, default landing page, freshness thresholds)

## Done criteria for Phase 2A
- All existing pages reachable from sidebar
- No regression in any existing page renderer
- Mobile drawer works
- Freshness dots show correct state for at least 3 feeds
- Snapshot strip is gone from default render (or merged into mutex toggle)
- More menu deleted, all its destinations have homes
- Tests pass
- Production smoke-test green
