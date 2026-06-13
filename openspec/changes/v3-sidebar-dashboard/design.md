# V3 — Visual + Interaction Design

## Palette (extends `css/variables.css`)

```
/* New tokens — `css/v3-tokens.css` */
:root {
  /* Refined neutrals (Wiz-inspired deeper navy) */
  --v3-bg-deep:      #07070d;   /* page bg, deeper than current 0a0a12 */
  --v3-bg-surface:   #0e0e18;   /* sidebar + cards */
  --v3-bg-elevated:  #15152a;   /* hover state */
  --v3-bg-active:    #1a1a36;   /* selected nav item */

  /* Refined borders — softer, less geometric */
  --v3-border-soft:  rgba(255,255,255,0.06);
  --v3-border-mid:   rgba(255,255,255,0.10);
  --v3-border-hard:  rgba(255,255,255,0.14);

  /* Cyan refined — Wiz uses a slightly desaturated teal-cyan vs ours */
  --v3-cyan:         #2DD4BF;   /* primary accent */
  --v3-cyan-dim:     #14B8A6;   /* hover */
  --v3-cyan-glow:    rgba(45, 212, 191, 0.18);

  /* Freshness states */
  --v3-fresh-ok:     #2DD4BF;   /* <5min */
  --v3-fresh-warn:   #F59E0B;   /* 5-30min */
  --v3-fresh-stale:  #DC2626;   /* >30min or broken */
  --v3-fresh-idle:   #4B5563;   /* no data expected (e.g. weekend) */

  /* Layout */
  --v3-sidebar-width: 240px;
  --v3-sidebar-collapsed: 56px;
  --v3-topbar-height: 44px;
}
```

## Sidebar layout (expanded state)

```
┌────────────────────┐
│  ◐ BREAKINGTRADES  │ ← logo, 44px header
├────────────────────┤
│  ⌕ Search...       │ ← optional inline search
├────────────────────┤
│  TODAY             │ ← section label, 11px uppercase, dim
│  ◉ Market       ●  │ ← active item, left accent rail + freshness dot
│  ◯ Watchlist    ●  │
│  ◯ Signals      ◐  │ ← amber dot = stale
│  ◯ Alerts       3  │ ← badge if unread
│                    │
│  ANALYSIS          │
│  ◯ Expected Mvs ●  │
│  ◯ Calendar     ●  │
│  ◯ Research     ●  │
│                    │
│  PERFORMANCE       │
│  ◯ AI-Trader    ●  │
│  ◯ Holdings     ●  │
│                    │
│  ACCOUNT           │ ← bottom-anchored
│  ◯ Settings        │
│  ◯ About           │
├────────────────────┤
│  ⊟ Collapse        │ ← bottom button
└────────────────────┘
```

## Sidebar layout (collapsed state, 56px)

```
┌────┐
│ ◐  │
├────┤
│ ⌕  │
├────┤
│ ▤  │ ← Market icon (active gets cyan rail + glow)
│ ▥  │ ← Watchlist
│ ▦  │ ← Signals
│ ◐  │ ← Alerts (badge floats top-right corner)
│    │
│ ▧  │
│ ▨  │
│ ▩  │
│    │
│ ◌  │
│ ◔  │
│    │
│ ⚙  │
│ ⓘ  │
├────┤
│ ⊟  │
└────┘
```

Tooltip on hover shows full label + freshness timestamp.

## Top utility bar (44px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [⌘K Search ticker]                    Market: ● OPEN  ⏱ Tape  ET ▾  │
└──────────────────────────────────────────────────────────────────────┘
```

- Left: cmd-K search opens a centered modal (cmdbar pattern, like Linear)
- Right: market session pill + ticker-tape toggle (single button, three-state) + tz + account avatar

## Item state spec

| State | Background | Text | Left rail | Icon |
|---|---|---|---|---|
| default | transparent | `--text-dim` | none | dim cyan stroke |
| hover | `--v3-bg-elevated` | `--text` | none | full cyan stroke |
| active | `--v3-bg-active` | `--text-bright` | 2px `--v3-cyan` | cyan filled |
| disabled | transparent | `--text-dim 40%` | none | gray |

Transition: `background 120ms ease, color 120ms ease`. No bouncy springs — Wiz/Linear style.

## Freshness dot SVG

```html
<svg width="6" height="6" viewBox="0 0 6 6" class="freshness-dot">
  <circle cx="3" cy="3" r="3" fill="currentColor"/>
</svg>
```

CSS:
```css
.freshness-dot { color: var(--v3-fresh-ok); }
.freshness-dot.warn { color: var(--v3-fresh-warn); }
.freshness-dot.stale { color: var(--v3-fresh-stale); animation: pulse-stale 2s ease-in-out infinite; }
.freshness-dot.idle { color: var(--v3-fresh-idle); }

@keyframes pulse-stale {
  0%,100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

Manifest reads `data/freshness-manifest.json`:
```json
{
  "generated_at": "2026-06-13T04:35:00Z",
  "feeds": {
    "market":         { "file": "data/sectors-snapshot.json",   "ttl_seconds": 300 },
    "watchlist":      { "file": "data/watchlist.json",          "ttl_seconds": 300 },
    "signals":        { "file": "data/signals.json",            "ttl_seconds": 300 },
    "expected-moves": { "file": "data/em-weekly.json",          "ttl_seconds": 86400 },
    "calendar":       { "file": "data/events.json",             "ttl_seconds": 3600 },
    "research":       { "file": "data/empirical-priors.json",   "ttl_seconds": 86400 },
    "ai-trader":      { "file": "data/ai-trader-calls.json",    "ttl_seconds": 600 },
    "holdings":       { "file": "data/ai-trader-holdings.json", "ttl_seconds": 86400 }
  }
}
```

Each entry includes `last_modified` (ISO) and `age_seconds`. Sidebar computes:
- `age < ttl` → ok (cyan)
- `age < ttl × 6` → warn (amber)
- `age >= ttl × 6` → stale (red, pulsing)
- weekend market hours where data is intentionally not refreshed → idle (gray)

## Mobile (≤768px)

- Sidebar starts collapsed off-screen at `transform: translateX(-100%)`
- Hamburger button in top utility bar reveals it as drawer with backdrop
- Esc / backdrop click / item click closes drawer
- Touch swipe-from-left edge opens drawer (~30px gutter)

## Accessibility

- `<nav aria-label="Primary">` wraps sidebar
- Section labels are `<h2>` visually-hidden for screen readers, `role="presentation"` aria-hidden visually
- Items use `aria-current="page"` on active route
- Collapse button has `aria-expanded="true|false"` and `aria-controls="sidebar"`
- Mobile drawer is `role="dialog" aria-modal="true"` when open

## Animations
- Item hover: 120ms color/bg
- Sidebar collapse: 200ms width + label fade
- Freshness pulse: 2s on stale only
- No layout shift on freshness state change

## Print
- `@media print { .v3-sidebar { display: none; } }`

## RTL
- Sidebar swap to right side via `dir="rtl"` on body. All paddings/margins use logical properties (`padding-inline-start` instead of `padding-left`).

## Reference visual specs

Wiz dark mode (from product screenshots):
- Sidebar bg: ~#0B0E14 (very deep blue-black)
- Active item: ~#1F2937 with 2px left teal accent
- Body text: ~#E5E7EB
- Dim text: ~#9CA3AF
- Accent teal: ~#14B8A6 → #2DD4BF range
- Generous 12px vertical padding per item
- 14px body text in nav, 11px uppercase labels for sections

TradingView Pro dark mode:
- Sidebar bg: ~#131722
- Active highlight: full-row #2A2E39
- Sidebar items 32px tall, very tight vertical rhythm
- Icons monochrome cyan, slightly thicker stroke than Wiz
- We borrow the **information density** but keep Wiz's softer borders + better whitespace.
