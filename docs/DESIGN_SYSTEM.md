# BreakingTrades Design System

> Dark trading terminal aesthetic. All UI follows this system. No light mode.

---

## Color Tokens

### Core Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#0a0a0f` | Page background |
| `--bg-elevated` | `#0d0d14` | Sidebar, ticker tape, elevated surfaces |
| `--card` | `#12121a` | Card backgrounds |
| `--border` | `#1e1e2e` | Borders, dividers, grid lines |
| `--border-hover` | `rgba(0,212,170,0.3)` | Card hover border glow |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#00d4aa` | Primary accent — bullish signals, active states, links |
| `--accent-dim` | `#00b894` | Secondary accent — less emphasis |
| `--accent-bg` | `rgba(0,212,170,0.12)` | Accent background (badges, highlights) |
| `--accent-border` | `rgba(0,212,170,0.3)` | Accent borders (badges, hover states) |
| `--accent-glow` | `rgba(0,212,170,0.5)` | Box shadow glow on accent elements |

### Signal Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bull` | `#00d4aa` | Bullish bias, positive change, uptrend |
| `--bear` | `#ef5350` | Bearish bias, negative change, downtrend |
| `--bear-glow` | `rgba(239,83,80,0.5)` | Bear dot glow |
| `--mixed` | `#ffa726` | Mixed/neutral bias, warnings |
| `--stop-zone` | `rgba(239,83,80,0.4)` | Range bar stop loss zone |
| `--entry-zone` | `rgba(0,212,170,0.3)` | Range bar entry zone |
| `--target-zone` | `rgba(0,184,148,0.2)` | Range bar target zone |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--text` | `#e0e0e0` | Primary text |
| `--text-bright` | `#ffffff` | Emphasized text, ticker names, prices |
| `--muted` | `#6b7280` | Secondary text, labels, timestamps |

### Surface Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--surface-subtle` | `rgba(255,255,255,0.02)` | Subtle background for stat boxes |
| `--surface-hover` | `rgba(0,212,170,0.05)` | Sidebar link hover background |

---

## Typography

### Font Stack

```css
font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
```

### Type Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| `--text-xxl` | 22px | 700 | Ticker name (sidebar), hero numbers |
| `--text-xl` | 18px | 700 | Stat values, key level prices |
| `--text-lg` | 15px | 600 | Section titles |
| `--text-md` | 13px | 500-600 | Nav links, EMA dot values, body |
| `--text-sm` | 12px | 600 | Card headers, sub-labels |
| `--text-xs` | 11px | 600 | Range bar markers, timestamps, footer |
| `--text-xxs` | 10px | 400 | Level item labels, stat labels |

### Text Transforms

- Section titles: `uppercase`, `letter-spacing: 1.5px`
- Card headers: `uppercase`, `letter-spacing: 0.8px`
- Bias badges: `uppercase`, `letter-spacing: 1px`
- Level labels: `uppercase`, `letter-spacing: 0.8px`

---

## Spacing

### Base Scale (4px grid)

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |

### Component Spacing

| Context | Padding | Gap |
|---------|---------|-----|
| Page content | 24px | — |
| Card head | 12px 16px | — |
| Card body | 24px | — |
| Sidebar | 20px horizontal | — |
| Grid (2-col, 3-col) | — | 24px |
| Levels grid | 24px | 16px |
| Setup stats grid | — | 16px |
| EMA status bar | 16px 20px | 24px |
| Section margin-bottom | 32px | — |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Range bars, small elements |
| `--radius-md` | 8px | Stat boxes, inner cards |
| `--radius-lg` | 12px | Cards, main containers |
| `--radius-pill` | 20px | Badges, pills |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 4px 20px rgba(0,0,0,0.3)` | Card elevation |
| `--shadow-glow-accent` | `0 0 8px rgba(0,212,170,0.5)` | Bullish dot glow |
| `--shadow-glow-bear` | `0 0 8px rgba(239,83,80,0.5)` | Bearish dot glow |

---

## Component Tokens

### Cards
```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
.card:hover {
  border-color: var(--border-hover);
}
```

### Bias Badges
```css
.badge-bull {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.badge-bear {
  background: rgba(239,83,80,0.12);
  color: var(--bear);
  border: 1px solid rgba(239,83,80,0.3);
}
.badge-mixed {
  background: rgba(255,167,38,0.12);
  color: var(--mixed);
  border: 1px solid rgba(255,167,38,0.3);
}
```

### Sidebar Navigation
```css
.sidebar-link {
  padding: 10px 20px;
  color: var(--muted);
  font-size: var(--text-md);
  font-weight: 500;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}
.sidebar-link:hover,
.sidebar-link.active {
  color: var(--accent);
  background: var(--surface-hover);
  border-left-color: var(--accent);
}
```

### EMA Alignment Dots
```css
.ema-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.ema-dot.bull {
  background: var(--accent);
  box-shadow: var(--shadow-glow-accent);
}
.ema-dot.bear {
  background: var(--bear);
  box-shadow: var(--shadow-glow-bear);
}
.ema-connector {
  width: 24px;
  height: 2px;
  background: var(--accent);
  opacity: 0.4;
}
```

### Range Bar (Trade Setup)
```css
.range-bar {
  height: 8px;
  background: var(--border);
  border-radius: var(--radius-sm);
}
.range-zone.stop   { background: var(--stop-zone); }
.range-zone.entry  { background: var(--entry-zone); }
.range-zone.target { background: var(--target-zone); }
```

---

## Animations

### Fade In Up (Card Entrance)
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.card {
  animation: fadeInUp 0.4s ease-out both;
}
/* Stagger: nth-child(2) delay 0.1s, nth-child(3) delay 0.2s */
```

### Live Pulse (Price Dot)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  animation: pulse 2s infinite;
}
```

### Hover Transitions
- All interactive elements: `transition: all 0.2s ease`
- Border color changes: `transition: border-color 0.3s ease`

---

## Responsive Breakpoints

| Name | Width | Layout Changes |
|------|-------|---------------|
| Desktop XL | ≥ 1440px | 4-column grid, full sidebar |
| Desktop | 1024–1439px | 3-column grid, sidebar visible |
| Tablet | 768–1023px | 2-column grid, sidebar hidden |
| Mobile | < 768px | 1-column grid, sidebar hidden, stacked levels |

### Mobile Overrides
- Sidebar: `display: none` below 1024px
- Levels grid: 3 columns (from 6) below 1024px
- Setup stats: 2 columns (from 4) below 1024px

---

## TradingView Widget Theme

All TradingView embeds use:
```javascript
{
  "colorTheme": "dark",
  "isTransparent": true,
  "backgroundColor": "rgba(18, 18, 26, 1)",  // matches --card
  "gridColor": "rgba(30, 30, 46, 0.5)"        // matches --border
}
```

---

_Reference: `prototype/tv-report-D.html` for working implementation of these tokens._
_Last updated: 2026-03-17_
