# UX/UI Design Specification — BreakingTrades Dashboard

_Visual language, layout, component library, interaction patterns, and responsive behavior._

---

## 1. Design Principles

1. **Terminal-first aesthetic** — Dark backgrounds, monospace type, minimal chrome. Feels like a Bloomberg terminal, not a consumer app.
2. **Information density over whitespace** — Traders want data, not margins. Every pixel earns its place.
3. **Color = meaning** — Green/cyan = bullish/safe. Red = bearish/danger. Orange = caution/approaching. Gold = target hit. Never decorative color.
4. **Scan → Click → Analyze** — Hierarchy: macro strip (1s scan) → card grid (5s scan) → detail modal (deep analysis).
5. **Motion = signal** — Pulse animations on RETEST/APPROACHING cards draw the eye. Everything else is still.

---

## 2. Design Tokens

### 2.1 Color Palette

```
Background
  --bg-primary:     #0a0a12    (page background)
  --bg-card:        #111122    (card surface)
  --bg-card-hover:  #161630    (card hover)
  --bg-header:      #080810    (top bar, strip backgrounds)
  --border:         #1e1e3a    (borders, dividers)

Text
  --text:           #e0e0e8    (primary text)
  --text-dim:       #8888aa    (secondary/label text)
  --text-bright:    #ffffff    (emphasis, tickers, prices)

Semantic Colors
  --cyan:           #00d4aa    (bullish, active, primary accent)
  --green-bg:       rgba(0,212,170,0.08)
  --orange:         #ffa726    (caution, approaching, SMA50)
  --orange-bg:      rgba(255,167,38,0.08)
  --red:            #ef5350    (bearish, exit, stop loss)
  --red-bg:         rgba(239,83,80,0.08)
  --gold:           #ffd700    (target hit, celebration)
  --blue:           #42a5f5    (trailing, informational)
  --purple:         #ab47bc    (weekly SMA20 on charts)
  --retest-orange:  #ff6e40    (retest pulse, highest urgency)

Chart-Specific
  --sma20:          #00d4aa    (cyan, 2px solid)
  --sma50:          #ffa726    (orange, 1px solid)
  --sma100:         #78909c    (gray, 1px)
  --sma200:         #546e7a    (dim gray, 1px)
  --chart-bg:       #0a0a12
  --chart-grid:     #1a1a2e
```

### 2.2 Typography

```
Font Stack:   'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace
Base Size:    13px
Line Height:  1.5

Scale:
  --text-xs:    9px     (chip labels, MA legend dots)
  --text-sm:    10px    (status badges, level pills, sector chips, uppercase labels)
  --text-base:  11px    (card body text, filter controls, pair ratios)
  --text-md:    12px    (briefing text, analysis body)
  --text-lg:    14px    (macro values)
  --text-xl:    16px    (card ticker, card price, logo)
  --text-2xl:   18px    (regime value)
  --text-3xl:   22px    (modal ticker)

Weight:
  400 — body text, labels
  500 — level values, section headers
  600 — badges, pill values, regime description headers
  700 — tickers, prices, logo, regime value

Letter Spacing:
  Labels/headers:   2px (uppercase)
  Badges:           0.5px
  Body:             normal
```

### 2.3 Spacing

```
Base unit: 4px

Spacing Scale:
  --sp-1:    4px
  --sp-2:    8px
  --sp-3:   12px
  --sp-4:   16px
  --sp-5:   20px
  --sp-6:   24px
  --sp-8:   32px
  --sp-10:  40px

Card:
  Padding:         14px 16px
  Gap (between):   8px
  Border radius:   8px

Modal:
  Outer padding:   40px (desktop), 10px (mobile)
  Inner padding:   20px 24px
  Header padding:  16px 24px
  Border radius:   12px

Filter bar:
  Tab padding:     4px 12px
  Chip padding:    2px 8px
  Search padding:  4px 8px
  Row gap:         8px
  Section gap:     6px (between rows)
```

### 2.4 Border Radius

```
  --radius-sm:   3px    (pills, chips, badges, bias toggles)
  --radius-md:   4px    (tabs, search input, sort select, buttons)
  --radius-lg:   8px    (cards, detail cards, count badges, chart boxes)
  --radius-xl:  12px    (modal container)
```

---

## 3. Page Layout

### 3.1 Desktop (≥ 769px)

```
┌──────────────────────────────────────────────────────────────────┐
│ BREAKING TRADES          Market: OPEN (NYSE)  🕐 ET ▾  Timestamp│  ← top-bar (sticky)
├──────────────────────────────────────────────────────────────────┤
│ S&P│VIX│DXY│10Y│OIL│COPPER│BTC│ETH│GOLD│SILVER                 │  ← macro-strip (scroll-x)
├──────────────────────────────────────────────────────────────────┤
│ XLY/XLP│HYG/SPY│RSP/SPY│XLV/SPY│IWM/SPY│...│HYG/TLT│IGV/QQQ   │  ← ratios-strip (scroll-x)
├─────────────────────────────────────────────┬────────────────────┤
│                                             │                    │
│  [All 24] [🔥Hot 5] [🟢Active 6] [⚠Alrt 8]│  📊 Market Regime  │
│  [👁Watch 5]                                │  ┌──────────────┐  │
│                                             │  │ ⚠️ LATE CYCLE │  │
│  🔍 [Search...]  [BULL][MIXED][BEAR]  Sort▾ │  │ Risk: HIGH   │  │
│  [All][Tech][HC][Energy][Util][Cons][Crypto] │  └──────────────┘  │
│                                             │                    │
│  ── 🔥 RETEST ─────────────────────── (2) ──│  📈 Sector Strength│
│  ┌─────────────────────────────────────┐    │  XLU  ████  +5.8%  │
│  │ AMZN  Amazon          $211.74 -18%  │    │  XLE  ███   +4.2%  │
│  │ 🔄 RETEST · SMA20 · HIGH CONF      │    │  XLP  █     +0.3%  │
│  │ HOLDING ✓ · Vol healthy · Confluence│    │  XLF  ██   -2.1%   │
│  │ [SMA20 $209.80] [SMA50 $198] [RSI]  │    │  XLK  ███  -5.5%   │
│  │ Analysis: Testing SMA20 support...  │    │  SMH  ████ -8.2%   │
│  └─────────────────────────────────────┘    │                    │
│  ┌─────────────────────────────────────┐    │  🎯 Daily Briefing │
│  │ PFE  Pfizer           $26.61 -1.4% │    │                    │
│  │ 🔄 RETEST · SMA50 · HIGH CONF      │    │  Late-cycle play-  │
│  │ HOLDING ✓ · Vol healthy             │    │  book is working.  │
│  │ [SMA20 $26.98] [SMA50 $26.46]      │    │  Energy and utils  │
│  └─────────────────────────────────────┘    │  leading...        │
│                                             │                    │
│  ── ⏳ APPROACHING ────────────────── (2) ──│  Action items:     │
│  ┌─────────────────────────────────────┐    │  • Trail AR stop   │
│  │ ABBV  AbbVie          $221.45 -2.1% │    │  • Watch PFE $26   │
│  │ ⏳ APPROACHING  Entry: $218-$220     │    │  • NVDA $170 line  │
│  │ ▓▓▓▓▓▓▓▓░░░░░░░ [Entry] ◉ [T1]    │    │                    │
│  └─────────────────────────────────────┘    │  "Patience, react, │
│                                             │   don't predict."  │
│  ── ✦ ACTIVE ──────────────────────── (3) ──│                    │
│  ┌─────────────────────────────────────┐    │                    │
│  │ XLU  Utilities ETF     $47.26 +0.9% │    │                    │
│  │ ✦ BULLISH STACK · BULL              │    │                    │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ ◉ [T1] [T2]  │    │                    │
│  └─────────────────────────────────────┘    │                    │
│  ...                                        │                    │
├─────────────────────────────────────────────┴────────────────────┤
│                         (footer if any)                          │
└──────────────────────────────────────────────────────────────────┘
```

**Grid:** `grid-template-columns: 1fr 380px`
- Left: watchlist panel (scrollable, filter bar + cards)
- Right: briefing panel (scrollable, sticky within viewport)

### 3.2 Mobile (< 768px)

```
┌──────────────────────────┐
│ BREAKING   Market 🕐 ET  │  ← top-bar (compact)
├──────────────────────────┤
│ S&P│VIX│DXY│10Y│OIL│... │  ← macro-strip (scroll-x)
├──────────────────────────┤
│ XLY/XLP│HYG/SPY│...     │  ← ratios-strip (scroll-x)
├──────────────────────────┤
│ [All][🔥Hot][🟢Act][⚠]  │  ← status tabs (scroll-x)
│ 🔍 [Search.........]     │  ← full width
│ [BULL][MIXED][BEAR] Sort▾│
│ [All][Tech][HC][Enrg]... │  ← sector chips (scroll-x)
├──────────────────────────┤
│ ┌────────────────────┐   │
│ │ AMZN  $211 🔄 HIGH │   │  ← compact card (no range bar)
│ │ RETEST SMA20       │   │
│ └────────────────────┘   │
│ ┌────────────────────┐   │
│ │ PFE   $26  🔄 HIGH │   │
│ └────────────────────┘   │
│ ...                      │
├──────────────────────────┤
│ 📊 Market Regime         │  ← right panel below (stacked)
│ 📈 Sector Strength       │
│ 🎯 Daily Briefing        │
└──────────────────────────┘
```

**Changes from desktop:**
- Single column layout (`grid-template-columns: 1fr`)
- Right panel moves below left panel (`border-top` replaces `border-left`)
- Status tabs: horizontal scroll
- Sector chips: horizontal scroll
- Search input: full width
- Cards: no range bar (too narrow to be useful)
- Card tap → full-screen modal (not overlay)
- Modal: `padding: 10px`, single-column chart layout
- Chart row: `grid-template-columns: 1fr` (stacked vertically)

---

## 4. Component Library

### 4.1 Status Badge

Visual representation of trade lifecycle state.

```
┌────────────────────────────────────┐
│ Component: status-badge            │
│ Height: 18px                       │
│ Padding: 2px 8px                   │
│ Border-radius: 4px                 │
│ Font: 10px, weight 600, uppercase  │
│ Letter-spacing: 0.5px              │
│ Display: inline-flex, center       │
└────────────────────────────────────┘

Variants:

  ┌──────────────────┐
  │ 🔄 RETEST        │  bg: rgba(255,110,64,0.12)  text: #ff6e40
  └──────────────────┘
  ┌──────────────────┐
  │ ⚡ TRIGGERED     │  bg: rgba(0,212,170,0.12)   text: #00d4aa  + "NEW" sub-badge
  └──────────────────┘
  ┌──────────────────┐
  │ ⏳ APPROACHING   │  bg: rgba(255,167,38,0.12)  text: #ffa726
  └──────────────────┘
  ┌──────────────────┐
  │ ✦ ACTIVE         │  bg: rgba(0,212,170,0.12)   text: #00d4aa
  └──────────────────┘
  ┌──────────────────┐
  │ 📈 TRAILING      │  bg: rgba(66,165,245,0.1)   text: #42a5f5
  └──────────────────┘
  ┌──────────────────┐
  │ 🎯 TARGET HIT    │  bg: rgba(255,215,0,0.1)    text: #ffd700
  └──────────────────┘
  ┌──────────────────┐
  │ ⚠️ EXIT SMA20    │  bg: rgba(255,167,38,0.1)   text: #ffa726
  └──────────────────┘
  ┌──────────────────┐
  │ 🛑 EXIT SMA50    │  bg: rgba(239,83,80,0.1)    text: #ef5350
  └──────────────────┘
  ┌──────────────────┐
  │ ❌ STOPPED       │  bg: rgba(239,83,80,0.1)    text: #ef5350
  └──────────────────┘
  ┌──────────────────┐
  │ 👁 WATCHING      │  bg: rgba(136,136,170,0.1)  text: #8888aa
  └──────────────────┘
  ┌──────────────────┐
  │ 💤 DORMANT       │  bg: rgba(30,30,58,0.3)     text: #555
  └──────────────────┘
```

### 4.2 Bias Badge

```
  ┌──────┐
  │ BULL │  bg: var(--green-bg)   text: var(--cyan)
  └──────┘
  ┌───────┐
  │ MIXED │  bg: var(--orange-bg)  text: var(--orange)
  └───────┘
  ┌──────┐
  │ BEAR │  bg: var(--red-bg)     text: var(--red)
  └──────┘

  Padding: 1px 6px · Radius: 3px · Font: 10px bold
```

### 4.3 Level Pill

Shows SMA/RSI levels with above/below/at indicator dot.

```
  ┌───────────────────┐
  │ ● SMA20  $26.98   │
  └───────────────────┘
  
  Dot colors:
    ● above (cyan #00d4aa)  — price is above this level
    ● below (red #ef5350)   — price is below this level
    ● at    (orange #ffa726) — price is within 1% of this level

  Padding: 2px 6px · bg: #1a1a30 · Radius: 3px
  Label: 10px dim · Value: 10px normal weight 500
```

### 4.4 Confidence Badge (RETEST cards only)

```
  HIGH confidence:    text: var(--cyan)    weight: 700
  MEDIUM confidence:  text: var(--orange)  weight: 600
  LOW confidence:     text: var(--text-dim) weight: 400
```

### 4.5 Range Bar

Visual price position between stop loss and targets.

```
  Stop         Entry         Price    T1          T2
  $24.50       $26.00        ◉        $28.00      $29.50
  ├────────────┤████████████████◉░░░░░░░░░░░░░░░░░┤
  
  Track:     h: 6px, bg: #1a1a30, radius: 3px
  Fill:      gradient from red→orange (left of price)
             or cyan→blue (active, left of price)
  Price dot: 10x10px, white fill, cyan 2px border, radius: 50%
  Markers:   9px text above bar, colored by type
             Stop: red · Entry: orange · T1: cyan · T2: gold
```

### 4.6 Exit Warning Banner

```
  ┌────────────────────────────────────────────────────────┐
  │ ⚠️ Below SMA20 ($262.45) — Daily close below = exit   │
  └────────────────────────────────────────────────────────┘

  bg: var(--red-bg) · Radius: 4px · Padding: 4px 8px
  Font: 10px bold · Color: var(--red)
```

### 4.7 Analysis Block ("Tom's Take")

```
  ┌─────────────────────────────────────────────────────┐
  │ ANALYSIS                                            │
  │                                                     │
  │ Healthcare holding relative strength. PFE testing   │
  │ SMA50 support at $26.46. If it holds and reclaims   │
  │ SMA20 ($26.98), that's the entry.                   │
  └─────────────────────────────────────────────────────┘

  Border-left: 2px solid rgba(0,212,170,0.3)
  bg: rgba(0,212,170,0.04) · Radius: 0 4px 4px 0
  Header: 9px uppercase, letter-spacing 1px, cyan, weight 600
  Body: 11px, line-height 1.5
  Padding: 8px 10px
```

---

## 5. Card Variants by Status

### 5.1 RETEST Card (Expanded) — Highest Priority

```
┌─ #ff6e40 3px ──────────────────────────────────────────┐
│ AMZN                                    $211.74  -18%  │  ← card-top
│ Amazon · Technology                                    │
│                                                        │
│ [🔄 RETEST]  [MIXED]                                  │  ← badges
│                                                        │
│ Retesting: SMA 20 at $209.80 — 0.9% away              │  ← retest detail
│ [HOLDING ✓] [Vol: Healthy] [HIGH CONF]                │  ← retest chips
│ ⭐ CONFLUENCE: SMA20 + SMA50 within 2%                │  ← confluence (if applicable)
│                                                        │
│ [● SMA20 $209.80] [● SMA50 $198] [● W20 $203] [RSI]  │  ← level pills
│                                                        │
│ ┌ ANALYSIS ─────────────────────────────────────────┐  │
│ │ Testing SMA20 support after breakout...           │  │  ← tom's take
│ └───────────────────────────────────────────────────┘  │
│                                                        │
│ ~~~~~~~~~~~~~ pulse animation (box-shadow) ~~~~~~~~~~  │
└────────────────────────────────────────────────────────┘

Animation: retestPulse 2.5s ease-in-out infinite
  0%/100%: box-shadow none
  50%: 0 0 16px 3px rgba(255,110,64,0.2)
```

### 5.2 APPROACHING Card (Expanded)

```
┌─ orange 3px ───────────────────────────────────────────┐
│ PFE                                     $26.61  -1.4% │
│ Pfizer · Healthcare                                    │
│                                                        │
│ [⏳ APPROACHING]  [MIXED]                              │
│ Entry zone: $25.80–$26.20 — 1.6% away                 │
│                                                        │
│ $24.50     $26.00        ◉     $28.00     $29.50       │  ← range bar
│ ├──────────┤████████████████◉░░░░░░░░░░░░░░┤           │
│                                                        │
│ [● SMA20 $26.98] [● SMA50 $26.46] [● W20 $26.06]     │
│                                                        │
│ ┌ ANALYSIS ─────────────────────────────────────────┐  │
│ │ Healthcare holding relative strength...           │  │
│ └───────────────────────────────────────────────────┘  │
│                                                        │
│ ~~~~~~~~~ gentle pulse animation ~~~~~~~~~~~~~~~~~~~~  │
└────────────────────────────────────────────────────────┘
```

### 5.3 ACTIVE / TRAILING Card

```
┌─ cyan/blue 3px ────────────────────────────────────────┐
│ XLU                                     $47.26  +0.9% │
│ Utilities Select Sector · ETF                          │
│                                                        │
│ [✦ BULLISH STACK]  [BULL]                              │
│                                                        │
│ $44.50     $45.50           ◉     $47.75     $49.00    │
│ ├──────────┤████████████████████████◉░░░░░░░░░┤        │
│                                                        │
│ [● SMA20 $46.82] [● SMA50 $44.68] [● W20 $44.50]     │
│                                                        │
│ ┌ ANALYSIS ─────────────────────────────────────────┐  │
│ │ Perfect bullish stack...                          │  │
│ └───────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘

TRAILING variant: blue border + "📈 TRAILING — Raise Stop" badge
  If RSI > 70: exit warning banner below level pills
```

### 5.4 EXIT_SMA20 / EXIT_SMA50 / EXIT_W20 Card

```
┌─ red/orange 3px ───────────────────────────────────────┐
│ AAPL                                   $252.82 -12.4% │
│ Apple · Technology                                     │
│                                                        │
│ [⚠️ EXIT SIGNAL]  [MIXED]                              │
│                                                        │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ⚠️ Below SMA20 ($262.45) — Daily close = exit    │   │  ← exit warning (prominent)
│ └──────────────────────────────────────────────────┘   │
│                                                        │
│ [● SMA20 $262.45] [● SMA50 $262.26] [● W20 $266.25]  │
└────────────────────────────────────────────────────────┘

No range bar, no analysis — just the warning + levels.
EXIT_SMA50/W20: red border (more severe than SMA20 orange).
```

### 5.5 WATCHING Card (Compact)

```
┌─ dim 3px ──────────────────────────────────────────────┐
│ COIN  Coinbase              $203.32 +10.3%             │
│ [👁 WATCHING]  [MIXED]  Above SMA20/50, below W20     │
└────────────────────────────────────────────────────────┘

Two lines max. No range bar, no analysis, no level pills.
Just: ticker, name, price, change, badge, bias, one-line context.
```

### 5.6 STOPPED Card

Same as WATCHING but:
- Red left border
- 60% opacity on entire card
- Badge: `❌ STOPPED`

### 5.7 DORMANT Card (Ultra-Compact)

```
┌─ very dim 3px ─────────────────────────────────────────┐
│ ARM  Arm Holdings  $121.70 -33.6%  [💤 DORMANT]       │
└────────────────────────────────────────────────────────┘

Single line. 50% opacity. Smallest possible footprint.
```

---

## 6. Filter Bar Components

### 6.1 Status Tabs

```
┌───────────────────────────────────────────────────────────────┐
│ [All 24]  [🔥 Hot 5]  [🟢 Active 6]  [⚠️ Alerts 8]  [👁 Watch 5] │
└───────────────────────────────────────────────────────────────┘

States:
  Default:  bg: transparent, border: var(--border), text: var(--text-dim)
  Hover:    border: var(--cyan), text: var(--text)
  Active:   bg: rgba(0,212,170,0.15), border: var(--cyan), text: var(--cyan)

Badge (count): bg: var(--border), radius: 6px, font: 10px
Active badge: bg: rgba(0,212,170,0.3)

Behavior: mutually exclusive (radio), keyboard 1-5
Mobile: horizontal scroll (overflow-x: auto)
```

### 6.2 Controls Row

```
┌───────────────────────────────────────────────────────────────┐
│ 🔍 [Search ticker or name...]  [BULL][MIXED][BEAR]  Sort: [▾]│
└───────────────────────────────────────────────────────────────┘

Search input:
  Width: 160px (desktop), 100% (mobile)
  Placeholder: "🔍 Search..." (dim gray)
  Focus: border → cyan
  Behavior: debounced 150ms, matches symbol or name (case-insensitive)
  Keyboard: / to focus, Escape to clear + blur

Bias toggles:
  Three buttons, all ON by default
  ON: colored border + bg (green/orange/red by type)
  OFF: dim border, gray text (#444)
  Toggle: click flips individual. All off = show all (treat as all on).
  Keyboard: B/M/R to toggle

Sort dropdown:
  Options: Priority (default) · % Change · RSI · Alphabetical
  Keyboard: S to cycle
```

### 6.3 Sector Chips

```
┌───────────────────────────────────────────────────────────────┐
│ [All] [Technology] [Healthcare] [Energy] [Utilities]          │
│ [Consumer] [Financials] [Crypto] [ETF] [Materials]            │
└───────────────────────────────────────────────────────────────┘

Behavior:
  "All" is default active. Clicking "All" deselects all others.
  Clicking a sector: deselects "All", toggles that sector.
  Multiple sectors can be active simultaneously.
  If all individual sectors deselected → "All" reactivates.

States:
  Default:  border: var(--border), text: var(--text-dim)
  Hover:    border: var(--cyan), text: var(--text)
  Active:   bg: rgba(0,212,170,0.12), border: var(--cyan), text: var(--cyan)

Mobile: horizontal scroll
```

---

## 7. Detail Modal

### 7.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│ PFE  Pfizer · Healthcare  [⏳ APPROACHING] [MIXED]      [✕] │  ← modal header
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────── DAILY ──────────┐ ┌────── WEEKLY ────────┐ │
│ │ [SMA20 ━━] [SMA50 ┅┅]         │ │ [20][50][100][200]    │ │
│ │                                │ │                       │ │
│ │    ┌─╲  ╱──╲                   │ │  ╱──────╲             │ │
│ │   ╱   ╲╱    ╲──╱╲             │ │ ╱        ╲───         │ │  ← TradingView widgets
│ │  ╱              ╲             │ │╱                      │ │     (400px height each)
│ │ ╱                             │ │                       │ │
│ │                                │ │                       │ │
│ │ [RSI ▓▓▓▓▓░░░░ 43.2]         │ │ [Volume bars]         │ │
│ └────────────────────────────────┘ └───────────────────────┘ │
│                                                              │
│ ┌──── SETUP LEVELS ──────────┐ ┌──── TECHNICAL LEVELS ────┐ │
│ │ Entry Zone  $25.80–$26.20  │ │ SMA 20      $26.98       │ │
│ │ Stop Loss   $24.50         │ │ SMA 50      $26.46       │ │
│ │ Target 1    $28.00         │ │ Weekly 20   $26.06       │ │  ← detail grid
│ │ Target 2    $29.50         │ │ 6mo High    $27.93       │ │     (2 columns)
│ │ Risk/Reward 1:2.3          │ │ RSI (14)    43.2         │ │
│ └────────────────────────────┘ └──────────────────────────┘ │
│                                                              │
│ ┌─ ANALYSIS — PFE ──────────────────────────────────────────┐│
│ │ Healthcare holding relative strength...                   ││  ← full analysis
│ │ The play: Wait for dip into $25.80–$26.20 entry zone...  ││
│ │ What would invalidate: Daily close below $24.50...        ││
│ └───────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘

Overlay: rgba(0,0,0,0.8)
Close: ✕ button (top right) + Escape key + click outside
Open animation: none (instant)
Close: instant
```

### 7.2 Mobile Modal

```
┌──────────────────────────┐
│ PFE  Pfizer        [✕]  │
│ [⏳ APPROACHING] [MIXED] │
├──────────────────────────┤
│ ┌─── DAILY ──────────┐  │
│ │ (full-width chart)  │  │  ← charts stacked vertically
│ │ 400px height        │  │
│ └─────────────────────┘  │
│ ┌─── WEEKLY ─────────┐  │
│ │ (full-width chart)  │  │
│ │ 400px height        │  │
│ └─────────────────────┘  │
│ ┌─── LEVELS ─────────┐  │  ← detail grid stacked
│ └─────────────────────┘  │
│ ┌─── ANALYSIS ───────┐  │
│ └─────────────────────┘  │
└──────────────────────────┘

Padding: 10px
Charts: single column
Detail grid: single column
```

---

## 8. Interaction States

### 8.1 Card Hover
- Background: `--bg-card` → `--bg-card-hover`
- Border: `--border` → `#2a2a50`
- Transform: `translateY(-1px)` (subtle lift)
- Transition: `all 0.15s ease`

### 8.2 Card Click → Modal Open
- Instant modal appear (no animation delay)
- Daily chart loads immediately
- Weekly chart loads after 1.5s delay (TradingView race condition fix)
- "Loading weekly chart…" placeholder shown during delay

### 8.3 Filter Changes → Card Re-render
- Cards that match: visible
- Cards that don't match: `display: none` (instant, no animation)
- Badge counts update immediately
- Group headers regenerate based on visible cards
- If no cards match: show empty state with "Clear all filters" button
- URL hash updates (debounced 300ms)

### 8.4 Timezone Change
- Timestamp updates instantly
- If modal open: close → reopen with new TZ (100ms delay)
- Selection saved to localStorage

---

## 9. Animations

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| RETEST card | `retestPulse` box-shadow | 2.5s | ease-in-out, infinite |
| APPROACHING card | `approachPulse` box-shadow | 3s | ease-in-out, infinite |
| Card hover lift | `translateY(-1px)` | 0.15s | ease |
| Card bg transition | `background-color` | 0.15s | ease |
| Filter tab transition | `all` | 0.2s | ease |
| Sector chip transition | `all` | 0.15s | ease |

No page transitions, no card enter/exit animations (performance on 70+ cards).

---

## 10. Accessibility

- All interactive elements are keyboard-accessible
- Status badges use emoji + text (not color-only signaling)
- Focus outline: 2px cyan on :focus-visible
- Color contrast: all text meets WCAG AA against dark backgrounds
- Modal traps focus while open
- Escape closes modal
- Tab order: filters → cards → right panel

---

## 11. Data-Driven Architecture

No hardcoded card HTML. All cards rendered from `SETUPS[]` array.

```
Page Load → Parse URL hash → Set filter state → Render cards
User action → Update filter state → Re-render cards → Update URL hash
Timezone change → Update display → Reload charts if modal open
```

See `FILTER_SYSTEM.md` for the complete data model and rendering pipeline.
See `TRADE_LIFECYCLE.md` for status definitions and transitions.
See `DATA_ARCHITECTURE.md` for the Python pipeline that generates the JSON data.
