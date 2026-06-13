# V3 — Sidebar Dashboard Architecture

## Why
The top-nav has hit its ceiling. Six items + a "More" dropdown is the maximum it can hold without UX degradation, and we want to add: AI-Trader (signal track record), Holdings (public read-only), Calendar (merged Events + Week Ahead), Research (promoted from More), an Alerts inbox, plus a settings/account surface. That's 12+ destinations across 4 functional groups (TODAY, ANALYSIS, PERFORMANCE, ACCOUNT). A horizontal nav cannot represent grouped hierarchy without a hamburger or a multi-row tab system; both regress UX.

This proposal replaces the top-nav shell with a **persistent left sidebar** and a **thin top utility bar**. Every dashboard the user trusts (Linear, Stripe, Vercel, Notion, Bloomberg Pro, Wiz, TradingView Pro) uses this exact pattern for the same reason.

## Design references (per user)
- **Wiz / Google Cloud security** — clean dark palette, soft cyan accents on dark navy, generous whitespace, tight 13px body text, monochrome inactive state with single-color highlight on hover/active.
- **TradingView** — three-zone chrome (left rail with tools/sections, top utility strip, dense data grid), color-graded freshness, mono numerics, terminal-grade information density without claustrophobia.

## What changes (high-level)
1. **Top nav goes away** as primary navigation. Becomes a thin utility strip (logo, search, market status, ticker-tape toggle, timezone, account).
2. **Left sidebar mounts** with sectioned navigation (TODAY, ANALYSIS, PERFORMANCE, ACCOUNT). Persistent, collapsible to icon-only (56px wide).
3. **Snapshot strip removed** from default render. TV ticker tape stays toggleable. The two ticker strips become mutually exclusive (one toggle button switches between off → snapshot → tape → off).
4. **Calendar consolidation:** Week Ahead + Events merge. Default landing tab = Events (catalysts), secondary tab = Week Ahead.
5. **Research promoted** out of More to top-level sidebar item.
6. **AI-Trader page added** (replaces "Hermes Trader" naming — public-friendly, doesn't telegraph stack). Reads RULES.json + TRACK_RECORD.json + a new `data/ai-trader-calls.json` for live signal feed (read-only on the public site).
7. **Holdings page added** — public read-only static snapshot of "what AI-Trader is currently positioned in." NOT connected to IBKR. Hand-curated or generated from `ai-trader-calls.json` filtered to status=ACTIVE.
8. **Freshness indicator system** — tiny inline SVG dot (cyan/amber/red) per sidebar item, color-graded by data age. Active section gets a 2px left-rail accent in the same color.
9. **More menu deleted.**

## What does NOT change (Phase 2 scope guard)
- Signal logic, EM math, trade lifecycle — ZERO changes.
- Existing JSON data contracts — unchanged. Pages still read same files.
- Page-internal renderers — `js/pages/*.js` keep their existing rendering. We're swapping the chrome around them, not the content.
- Routing — `#hash` routes still drive content. We add new routes (`#ai-trader`, `#holdings`, `#calendar`) but keep all existing ones working as aliases (`#week-ahead` → `#calendar?tab=week`, `#events` → `#calendar?tab=events`).
- Mobile — phase 2 keeps mobile working but doesn't redesign it. Sidebar collapses to a slide-in drawer behind a single hamburger button.

## Phasing
- **Phase 2A (this PR):** sidebar shell, top-bar slimmed, calendar merge, research promotion, snapshot/tape mutex, freshness dots — ALL existing content wired up. **No new pages yet.**
- **Phase 2B (follow-up):** AI-Trader page (data shape + UI).
- **Phase 2C (follow-up):** Holdings page (public snapshot, no IBKR).
- **Phase 2D (follow-up):** Alerts inbox, settings panel.

User approval requested at the boundary of each sub-phase before proceeding to the next.

## Files added / modified
- ADD `css/sidebar.css` — sidebar shell, sections, items, freshness dots, collapse states.
- ADD `css/v3-tokens.css` — extended palette + spacing tokens layered on top of `variables.css`. Wiz-inspired: deeper neutrals, refined cyan accents, softer borders.
- ADD `js/lib/sidebar.js` — render + bind, state persistence, freshness probe.
- ADD `js/lib/freshness.js` — tiny SVG dot component, reads data file mtimes from a manifest.
- ADD `data/freshness-manifest.json` — exported by `scripts/export-dashboard-data.py` listing each data file's mtime so the client can compute per-section freshness without 12 HEAD requests.
- ADD `js/pages/calendar.js` — merged Events + Week Ahead with sub-tabs.
- MOD `index.html` — chrome rewrite, top bar slimmed, sidebar mounted, mobile drawer.
- MOD `css/shell.css` — top-bar trimmed; old `.nav-bar` styles deprecated but kept under `.legacy-` prefix for one release cycle for safe rollback.
- MOD `js/shell.js` — top-bar render simplified, sidebar mount call added, snapshot/tape mutex logic.
- MOD `js/router.js` — register new routes + aliases.
- MOD `scripts/export-dashboard-data.py` — emit `freshness-manifest.json`.
- DEL `js/pages/week-ahead.js` (folded into `calendar.js`) and `js/pages/events.js` (same).
- DEL `js/lib/snapshot-strip.js` (or keep as opt-in; user choice during implementation).

## Risks & mitigations
- **R1: Chrome rewrite breaks existing pages.** Mitigation: routing + page renderers untouched. Sidebar simply replaces the nav. Each page is tested individually after migration.
- **R2: User loses muscle memory for top-nav.** Mitigation: 1-line tooltip on first load explaining the move, preference persists. Old `#hash` URLs redirect via aliases.
- **R3: Mobile regression.** Mitigation: sidebar starts in collapsed state on viewports <768px; hamburger reveals it as drawer. Desktop default = expanded.
- **R4: SWA build break.** Mitigation: deploy to `v3-sidebar-dashboard` branch and use SWA preview environments before merging to main.

## Test plan
- **Local:** `python3 scripts/serve.py 8889`, click every sidebar item, verify content matches old nav. Toggle collapse. Toggle ticker strip mutex. Resize to mobile. Check freshness dots update on stale data.
- **Tests:** add `tests/sidebar.test.js` with assertions: sidebar mounts on every page, all routes resolve, mobile drawer opens/closes, freshness dots render correct color for synthetic mtimes.
- **Browser matrix:** Chrome 149, Safari 18, Firefox 130. Mobile Safari iOS 17.
- **A11y:** sidebar items focusable in Tab order, Esc closes mobile drawer, aria-current on active item.

## Rollback
Branch is `v3-sidebar-dashboard`. If anything goes wrong post-merge, revert the merge commit on main. Old `.nav-bar` rules remain under `.legacy-` prefix for one release cycle, so a feature-flag flip (preference `v3:false`) restores the old chrome without code revert.

## Decision log
- "AI-Trader" name chosen over "Hermes Trader" per user — site is public, naming should not telegraph the underlying stack.
- Holdings page is public read-only, NOT connected to IBKR. IBKR integration deferred to a tenant-aware future phase.
- Wiz CSS adopted as primary visual reference. TradingView referenced for information-density patterns (not its TradingView-blue palette).
- Snapshot strip + TV tape made mutually exclusive (not "always one of them") — user can have neither.
