# BreakingTrades Dashboard — Project Plan

## Vision

A professional trading intelligence dashboard that consolidates:
- **Live watchlists** with EMA bias, key levels, and trade setups
- **Interactive charts** (TradingView embeds) across multiple timeframes
- **AI trading assistant** ("Tom") for market analysis, Q&A, and setup validation
- **Community trade ideas** with crowd-sourced conviction tracking
- **Technical analysis** — automated EMA alignment, RSI, sector rotation signals
- **Macro context** — yields, DXY, VIX, commodities overlay

No mention of external sources — all content is BreakingTrades branded.

---

## Architecture Decision: Do We Need OpenSpec?

### What OpenSpec Does
- Lightweight spec-driven development (SDD) framework for AI coding assistants
- Each feature gets: `proposal.md` → `specs/` → `design.md` → `tasks.md`
- Slash commands (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`) drive the workflow
- Works with Copilot CLI, Claude Code, Cursor, etc.
- YC-backed, actively maintained, Node.js CLI

### Recommendation: **YES — Install OpenSpec**

**Why it fits this project:**
1. We're building a multi-feature dashboard — each feature (charts, watchlist, Tom agent, trade setup cards) is a natural "change" unit
2. AI agents (Copilot CLI with Gemini 3 Pro) will do most of the coding — OpenSpec keeps them aligned with specs
3. Prevents the "chat history drift" problem — specs persist in repo, not in conversation
4. Lightweight enough for a 1-person project, structured enough to keep quality high
5. Similar to HCA DR&I model: spec first → design → implement → verify

**Setup:**
```bash
npm install -g @fission-ai/openspec@latest
cd ~/projects/breakingtrades/breakingtrades-dashboard
openspec init
```

---

## Core Modules

### 1. Watchlist Engine
- **Input:** TradingView shared watchlist (auto-scraped), manual additions
- **Processing:** yfinance/tvDatafeed → EMA 8/21/50 alignment, RSI, % from highs
- **Output:** JSON data feed consumed by dashboard
- **Sections:** Quality Stocks, Community Trades, Pending Setups, Sectors
- **Update frequency:** Daily at market open + on-demand

### 2. Chart System
- **TradingView embeddable widgets** (free, no API key)
  - Advanced charts (tv.js) — Daily, Weekly, 4H, 1H
  - Technical analysis gauges
  - Symbol overview / comparison
  - Ticker tape
  - Mini charts for watchlist cards
- **Custom overlays:** EMA zones, entry/stop/target levels (canvas or annotation layer)
- **Responsive:** Full-width on detail view, compact on watchlist

### 3. Trade Setup Cards
- Per-ticker cards with:
  - Bias badge (Bull/Bear/Mixed)
  - Key levels (EMAs, support/resistance, 6mo range)
  - Entry zone, stop loss, targets, R:R ratio
  - Visual range bar
  - Thesis summary (AI-generated)
- **Source:** Combination of automated analysis + curated setups

### 4. Tom — AI Trading Assistant
- **What it is:** An embedded chatbot persona trained on macro framework, EMA methodology, pair ratios, and historical analysis
- **Capabilities:**
  - "What do you think about D?" → Returns analysis based on methodology
  - "What's the macro setup?" → Current regime assessment
  - "Any new setups today?" → Scans watchlist for triggered entries
  - "Sector rotation?" → XLU/XLK/XLE/XLF relative strength
- **Implementation options:**
  - **Option A: Static pre-generated analysis** — Run Tom agent nightly, cache responses as JSON, display as "Tom's Take" cards. Cheapest, no real-time.
  - **Option B: API-backed chat widget** — Frontend sends question to backend → LLM with Tom system prompt + context → streams response. Real-time but needs API/hosting.
  - **Option C: Hybrid** — Pre-generated daily briefing + live Q&A for on-demand questions. Best UX.
- **Data context fed to Tom:**
  - Current watchlist with levels/EMAs
  - Macro indicators (VIX, DXY, yields, sector ETFs)
  - Recent trade setups and outcomes
  - Methodology rules (6-layer decision stack)
  - Historical analysis patterns from video transcripts

### 5. Technical Analysis Engine
- **Automated signals:**
  - EMA alignment scan (Bull/Bear/Mixed)
  - RSI overbought/oversold
  - Volume anomaly detection
  - Bollinger Band compression (squeeze detector)
  - Expected move (options-derived, from IB when available)
- **Sector rotation matrix:** Heatmap of sector ETF relative strength
- **Macro dashboard:** Yields, DXY, VIX, commodities with trend direction

### 6. Macro Context Panel
- Yield curve (2Y/10Y spread)
- DXY trend
- VIX regime (complacency / fear / panic)
- Commodity signals (crude, copper, gold)
- Crypto pulse (BTC, ETH)
- All with EMA alignment indicators

---

## Tech Stack (Proposed)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14+ (App Router) | React, SSR, file-based routing, Vercel deploy |
| **UI** | shadcn/ui + Tailwind | Dark theme native, component library, responsive |
| **Charts** | TradingView embeds | Free, professional, interactive, no API key |
| **Data** | Python scripts → JSON/API | Existing yfinance/tvDatafeed pipeline |
| **Tom Agent** | Azure OpenAI / Anthropic API | System prompt + RAG over methodology docs |
| **Chat Widget** | Custom React component | Stream responses, markdown rendering |
| **Hosting** | Vercel (free tier) | Fast deploys, edge functions for API routes |
| **DB (optional)** | Supabase or JSON files | Watchlist state, setup history, user prefs |

### Alternative: Static HTML + vanilla JS
- Simpler, faster to ship
- No build step, works anywhere
- TradingView widgets are already vanilla JS
- Tom agent would need a separate API endpoint
- **Good for MVP**, upgrade to Next.js later if needed

---

## Data Flow

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ TradingView      │     │ yfinance /   │     │ Tom Agent       │
│ Watchlist Scrape │     │ tvDatafeed   │     │ (LLM + context) │
└────────┬────────┘     └──────┬───────┘     └────────┬────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Pipeline (Python)                     │
│  - Scrape watchlist → parse sections                         │
│  - Fetch OHLCV → compute EMAs, RSI, signals                 │
│  - Generate trade setup JSON                                 │
│  - Run Tom analysis → cache responses                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  JSON / API   │
                    │  data layer   │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Dashboard Frontend    │
              │  - Watchlist grid       │
              │  - Chart panels         │
              │  - Setup cards          │
              │  - Tom chat widget      │
              │  - Macro sidebar        │
              └────────────────────────┘
```

---

## Phased Roadmap

### Phase 0: Foundation (Week 1)
- [x] Create repo
- [ ] Install OpenSpec, init project
- [ ] Set up AGENTS.md / copilot-instructions
- [ ] Define initial specs via OpenSpec
- [ ] Choose tech stack (static vs Next.js)
- [ ] Design system: colors, typography, component tokens

### Phase 1: Watchlist MVP (Week 1-2)
- [ ] Data pipeline: scrape → compute → JSON
- [ ] Watchlist grid view with EMA bias badges
- [ ] Ticker detail page with TradingView charts
- [ ] Key levels + trade setup cards
- [ ] Responsive dark theme

### Phase 2: Charts & Analysis (Week 2-3)
- [ ] Multi-timeframe chart layout (Daily + 4H + Weekly)
- [ ] Technical analysis gauges
- [ ] Sector comparison widgets
- [ ] Macro context panel
- [ ] Sector rotation heatmap

### Phase 3: Tom Agent (Week 3-4)
- [ ] Tom system prompt + methodology context
- [ ] Daily briefing generation (cached)
- [ ] Chat widget UI
- [ ] API endpoint for live Q&A
- [ ] "Tom's Take" cards on each ticker

### Phase 4: Polish & Deploy (Week 4-5)
- [ ] Animations, transitions, loading states
- [ ] Mobile optimization
- [ ] PWA support
- [ ] Deploy to Vercel or GitHub Pages
- [ ] Automated data refresh (cron/GitHub Actions)

---

## Key Decisions (Locked)

1. **GitHub Pages deployment** via `breakingtrades` org — static site, no server
2. **No traditional database** — JSON files generated by Python pipeline, committed to repo or served as static assets. GitHub Pages = free hosting, no backend.
3. **Tom agent** — pre-generated analysis cached as JSON (Phase 1). Live chat requires a separate API endpoint (Phase 3 — Azure Function or Cloudflare Worker, lightweight).
4. **No auth for MVP** — public dashboard. Private features (portfolio tracking, alerts) can come later with GitHub OAuth or similar.
5. **No containers** — overkill for a static site. Data pipeline runs locally or via GitHub Actions cron.
6. **Alerts** — Telegram bot (existing BreakingTrades infra) for push notifications when setups trigger.

### Why No Database?

The data is small and structured:
- Watchlist: ~70 symbols × daily snapshot = tiny JSON
- Trade setups: ~35 active at any time = tiny JSON
- Tom's analysis: ~35 cached responses = small JSON
- Historical setups: append-only JSONL, rotate after 90 days

**GitHub Pages serves static JSON files.** The Python pipeline runs on cron (local Mac or GitHub Actions), generates JSON, commits, pushes. Dashboard fetches JSON at load time. Zero hosting cost, zero ops.

If we ever need real-time data or user state, we add a lightweight API (Azure Function / Cloudflare Worker) — but not for MVP.

### Org & Repo Structure

- **Org:** `github.com/breakingtrades`
- **Dashboard repo:** `breakingtrades/breakingtrades-dashboard`
- **GitHub Pages:** `breakingtrades.github.io/breakingtrades-dashboard/` (or custom domain later)
- **Data pipeline:** lives in `data/pipeline/` within the same repo
- **Tom agent config:** lives in `tom/` within the same repo

---

## File Structure (Proposed)

```
breakingtrades-dashboard/
├── AGENTS.md                  ← AI assistant instructions
├── README.md
├── openspec/                  ← OpenSpec specs & changes
│   ├── specs/
│   └── changes/
├── docs/
│   ├── PLAN.md               ← THIS FILE
│   ├── ARCHITECTURE.md
│   └── DESIGN_SYSTEM.md
├── data/
│   ├── pipeline/             ← Python scripts
│   │   ├── scrape_watchlist.py
│   │   ├── compute_signals.py
│   │   └── generate_setups.py
│   └── output/               ← Generated JSON
│       ├── watchlist.json
│       ├── setups.json
│       └── tom-briefing.json
├── src/                       ← Frontend
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── components/
├── tom/                       ← Tom agent config
│   ├── system-prompt.md
│   ├── methodology.md
│   └── context/
└── scripts/
    ├── refresh-data.sh
    └── deploy.sh
```

---

_Last updated: 2026-03-17_
