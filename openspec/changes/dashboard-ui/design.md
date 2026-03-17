## Context

The existing `index.html` (~1,350 lines) is a working prototype with 13 hardcoded tickers, a macro strip, 12 pair ratios, setup cards with a detail modal (daily+weekly TradingView charts), and a timezone selector. It needs to become data-driven — loading from JSON files produced by the data-pipeline change — and gain a full filter system, 7 card variants by status, and responsive mobile layout.

Design tokens, component specs, and wireframes are fully documented in `docs/UX_DESIGN_SPEC.md` (706 lines) and the filter system in `docs/FILTER_SYSTEM.md`. The trade lifecycle states are in `docs/TRADE_LIFECYCLE.md`.

The site is pure HTML/CSS/JS on GitHub Pages. No build tools, no frameworks, no bundler.

## Goals / Non-Goals

**Goals:**
- Data-driven rendering from `data/*.json` — zero hardcoded ticker data
- 6-dimension filter bar with URL hash sync
- 7 card variants matching the status-based design from UX_DESIGN_SPEC
- Responsive across desktop (2-col), tablet (1-col), mobile (full-width + bottom nav)
- Keyboard shortcuts for power users
- Retain existing TradingView integration with staggered chart loading

**Non-Goals:**
- Framework migration (stay vanilla JS for MVP)
- Modular JS files with bundler (single index.html for simplicity)
- Service worker / offline mode
- Tom chat widget (separate `tom-chat` change)

## Decisions

### Single-file HTML vs modular split
**Decision:** Keep single `index.html` for MVP. Extract to separate files only if it exceeds 3,000 lines.
**Rationale:** GitHub Pages serves static files. A single HTML file means zero build step, zero config, zero CORS issues with relative script paths. The coding agent can work on one file. If we outgrow this, we split — but 2,000 lines of well-structured vanilla JS is fine.

### CSS custom properties (design tokens)
**Decision:** Define all colors, spacing, font sizes as CSS custom properties in a `:root` block at the top of `<style>`. Reference `docs/UX_DESIGN_SPEC.md` §1 for exact values.
**Rationale:** Single source of truth for theming. Makes future dark/light theme toggle trivial.

### Filter state management
**Decision:** All filter state in a single `filterState` object: `{ status: 'all', bias: [], sector: [], sort: 'priority', search: '' }`. Changes to `filterState` trigger a `renderCards()` call that re-filters and re-renders the grid.
**Rationale:** Simple, predictable, easy to debug. URL hash sync reads/writes this object.

### Card rendering strategy
**Decision:** Full re-render on filter change (clear grid, re-create cards matching filter). No virtual DOM, no diffing.
**Rationale:** With 70 cards max, DOM creation is < 5ms. Over-engineering reactivity for 70 elements adds complexity for zero perceptible benefit.

### Right panel content
**Decision:** Right panel contains (top to bottom): Market Regime badge, Macro Strip (compact), Sector Strength bars, Pair Ratios grid, Daily Briefing (Tom). All loaded from JSON.
**Rationale:** Matches `docs/UX_DESIGN_SPEC.md` wireframe. Gives macro context without scrolling.

## Risks / Trade-offs

### Risk: Single-file gets unwieldy
At 2,000+ lines, a single HTML file is harder to navigate. Mitigation: Clear section comments (`/* === FILTER SYSTEM === */`), consistent naming, ready-to-split structure with functions grouped by concern.

### Risk: TradingView widget conflicts
Multiple TV widgets on the same page can conflict (WebSocket limits). Mitigation: Only 2 widgets active at a time (in modal). Destroy on modal close. Stagger loading by 1.5s.

### Risk: Mobile performance
70 cards + a macro strip + pair ratios on mobile could be heavy. Mitigation: DORMANT cards are ultra-compact (32px each). Virtualization not needed at 70 items. Lazy-load pair ratios below fold.
