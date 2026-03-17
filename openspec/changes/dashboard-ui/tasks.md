# Tasks: Dashboard UI

## Task 1: Design token CSS foundation
- [ ] Replace all hardcoded colors in `index.html` `<style>` with CSS custom properties matching `docs/UX_DESIGN_SPEC.md` §1
- [ ] Define full token set in `:root {}`: `--bg-base`, `--bg-card`, `--bg-hover`, `--border`, `--text`, `--text-dim`, `--cyan`, `--red`, `--orange`, `--green`, `--gold`, `--purple`, `--yellow`, plus chart-specific tokens
- [ ] Define font-size scale: `--text-xs` (10px) through `--text-2xl` (20px)
- [ ] Define spacing scale: `--space-1` (4px) through `--space-8` (32px)
- [ ] Define status badge colors as tokens: `--status-retest`, `--status-approaching`, `--status-active`, etc.
- [ ] Verify all existing styles reference tokens (no raw hex values outside `:root`)
- **Estimate:** 1 hour
- **Ref:** `docs/UX_DESIGN_SPEC.md` §1 (Colors, Typography, Spacing)

## Task 2: Data loading layer
- [ ] Add `async function loadDashboardData()` that fetches `data/setups.json`, `data/macro.json`, `data/pairs.json`, `data/tom/briefing.json` in parallel via `Promise.all`
- [ ] Store loaded data in global objects: `SETUPS`, `MACRO`, `PAIRS`, `BRIEFING`
- [ ] Show skeleton placeholders (pulsing dark rectangles) while loading
- [ ] Handle 404: show "Data unavailable" for affected section, render other sections normally
- [ ] Add staleness detection: if any `updated` timestamp > 4 hours old, show "⚠ Data may be stale" badge
- [ ] Replace all hardcoded `SETUPS = [...]`, `MACRO = {...}`, `PAIRS = [...]` with fetched data
- [ ] Call `renderDashboard()` after data loads
- **Estimate:** 1.5 hours
- **Ref:** `openspec/changes/dashboard-ui/specs/data-driven-rendering/spec.md`

## Task 3: Filter state management
- [ ] Create `filterState` object: `{ status: 'all', bias: [], sector: [], sort: 'priority', search: '' }`
- [ ] Create `applyFilters(setups, filterState)` → returns filtered+sorted array
- [ ] Implement status group mapping: All=all, Hot=RETEST+APPROACHING, Active=ACTIVE+TRAILING+TARGET_HIT, Alerts=EXIT_*, Watching=WATCHING, Inactive=STOPPED+DORMANT
- [ ] Implement bias filter: OR logic across selected biases
- [ ] Implement sector filter: OR logic across selected sectors
- [ ] Implement search filter: case-insensitive substring match on ticker symbol
- [ ] Implement sort options: Priority (default), Ticker A-Z, RSI Low→High, RSI High→Low, % from High
- [ ] On any filter change: call `renderCards(applyFilters(SETUPS, filterState))`
- **Estimate:** 2 hours
- **Ref:** `docs/FILTER_SYSTEM.md`, `openspec/changes/dashboard-ui/specs/filter-system/spec.md`

## Task 4: Filter bar UI
- [ ] Render status group tabs with badge counts (recalculate on each render)
- [ ] Render bias chips: BULL (green), BEAR (red), MIXED (yellow) — toggleable, multi-select
- [ ] Render sector chips: auto-generated from unique sectors in SETUPS — toggleable, multi-select
- [ ] Render search input with placeholder "Search ticker..." and `🔍` icon
- [ ] Render sort dropdown with 5 options
- [ ] Highlight active tab, active chips with filled background
- [ ] Show empty state message when filters produce zero results
- **Estimate:** 2 hours
- **Ref:** `docs/FILTER_SYSTEM.md` §2-5

## Task 5: URL hash sync
- [ ] On filter change: write `filterState` to URL hash (`#status=hot&bias=BULL,MIXED&sort=rsi_asc&q=NVD`)
- [ ] On page load: parse URL hash → set `filterState` → render with those filters active
- [ ] Use `history.replaceState` (no page reload, no history stack pollution)
- [ ] Handle empty/malformed hash gracefully (default to All tab, no filters)
- **Estimate:** 45 min
- **Ref:** `openspec/changes/dashboard-ui/specs/filter-system/spec.md` (URL hash requirement)

## Task 6: Keyboard shortcuts
- [ ] `1` through `5` → switch status tabs (1=All, 2=Hot, 3=Active, 4=Alerts, 5=Watching)
- [ ] `/` → focus search input
- [ ] `Esc` → close detail modal, clear search if focused
- [ ] Only fire when no input/textarea is focused (except Esc)
- [ ] Add keyboard shortcut hints in tooltips on tabs
- **Estimate:** 30 min
- **Ref:** `openspec/changes/dashboard-ui/specs/filter-system/spec.md` (keyboard requirement)

## Task 7: Card variant renderer
- [ ] Create `renderCard(setup)` function that returns HTML based on `setup.status`
- [ ] RETEST card: expanded, pulsing left border (cyan→orange animation), retest level chip, confidence badge, volume health indicator, confluence badge if `setup.confluence === true`
- [ ] APPROACHING card: expanded, range bar showing distance to level, distance %, target level name
- [ ] ACTIVE/TRAILING card: range bar (entry→current→target), P&L %, "OVERBOUGHT" badge if RSI > 70
- [ ] EXIT_* card: red left border, exit level prominent ("Below SMA20: $262.45"), warning banner at top
- [ ] WATCHING card: compact 2-line (ticker + bias + RSI, SMA20 + SMA50)
- [ ] STOPPED card: 60% opacity, strikethrough on ticker
- [ ] DORMANT card: single line, ticker + bias dot + price only
- [ ] All cards clickable → open detail modal
- [ ] Status badge uses exact colors from `docs/UX_DESIGN_SPEC.md` §7
- **Estimate:** 3 hours
- **Ref:** `docs/UX_DESIGN_SPEC.md` §8, `openspec/changes/dashboard-ui/specs/card-variants/spec.md`

## Task 8: Right panel (macro context + briefing)
- [ ] Render market regime badge (from `BRIEFING.regime` — color-coded: LATE_CYCLE=orange, etc.)
- [ ] Render macro strip: 8 indicators from `MACRO.indicators` with value, direction arrow, signal emoji
- [ ] Render sector strength bars: group SETUPS by sector, compute avg bias score, render horizontal bars
- [ ] Render pair ratio grid: 12 ratios from `PAIRS` with pair name, value, trend arrow, signal emoji, interpretation label
- [ ] Render daily briefing: `BRIEFING.briefing` text, top setups list, action items bullets
- [ ] Right panel scrolls independently from card grid
- [ ] On tablet (<1200px): collapse right panel into expandable section above cards
- **Estimate:** 2 hours
- **Ref:** `docs/UX_DESIGN_SPEC.md` wireframe

## Task 9: Responsive layout
- [ ] Desktop (≥1200px): 2-column grid — left ~70% (filter + cards), right ~30% (context panel)
- [ ] Tablet (768-1199px): 1-column, right panel content as collapsible section above cards
- [ ] Mobile (<768px): full-width cards, filter bar as collapsible dropdown, fixed bottom tab bar for status groups
- [ ] Mobile swipe: detect horizontal swipe on card grid to switch status tabs
- [ ] Large desktop (≥1440px): center content with max-width 1440px container
- [ ] Small mobile (≤480px): reduce font sizes by 1 step, padding to 8px
- [ ] Test all 4 breakpoints
- **Estimate:** 2 hours
- **Ref:** `openspec/changes/dashboard-ui/specs/responsive-layout/spec.md`

## Task 10: Detail modal update
- [ ] Retain existing daily+weekly TradingView chart loading (staggered 1.5s)
- [ ] Add level strip: horizontal bar with SMA20 (cyan), SMA50 (orange), W20 (purple), price (white) — labeled values
- [ ] Add Tom's Take block: fetch `data/tom/takes/{TICKER}.json`, display take text, action badge, confidence badge, key level, update timestamp
- [ ] Handle Tom's Take 404: show "Analysis not yet available"
- [ ] Mobile (<768px): full-screen modal with close button, charts stacked vertically
- [ ] Expose `openDetailModal(ticker)` as global function for tom-chat to call
- **Estimate:** 1.5 hours
- **Ref:** `openspec/changes/dashboard-ui/specs/detail-modal/spec.md`

## Task 11: Global function exports for tom-chat integration
- [ ] Expose `setFilterStatus(status)` — sets active status tab and re-renders
- [ ] Expose `setFilterSector(sector)` — sets active sector chip and re-renders
- [ ] Expose `openDetailModal(ticker)` — opens detail modal for the specified ticker
- [ ] Expose `highlightCard(ticker)` — 2-second pulsing cyan glow animation on card
- [ ] Expose `scrollToCard(ticker)` — smooth scrolls grid to bring card into viewport
- [ ] Expose `getCurrentTicker()` — returns the currently viewed ticker (from modal or last clicked card)
- **Estimate:** 30 min

## Task 12: Testing and polish
- [ ] Test data load from actual pipeline JSON output
- [ ] Test all 6 filter dimensions individually and in combination
- [ ] Test URL hash: load page with `#status=hot&bias=BULL`, verify correct filters
- [ ] Test keyboard shortcuts (1-5, /, Esc)
- [ ] Test all 7 card variants render correctly
- [ ] Test detail modal with staggered chart loading
- [ ] Test responsive at 1440, 1200, 768, 480 breakpoints
- [ ] Test empty states (filter combo producing zero results)
- [ ] Cross-browser: Chrome, Firefox, Safari
- [ ] Lighthouse audit: target > 80 accessibility
- **Estimate:** 2 hours

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

## Dependencies
- Task 2 (data loading) requires `data-pipeline` change to have produced sample JSON files
- Task 7 (card variants) depends on Task 3 (filter state, to know what status field maps to)
- Task 10 (modal) depends on Task 7 (card click handler)
- Task 11 (exports) depends on Tasks 3, 10 (functions to expose)
- All other tasks are sequential for simplicity but could parallelize

## Total Estimate: 18-22 hours
