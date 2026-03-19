# BreakingTrades Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions (Cron)                         │
│                     Daily @ 9:35 AM ET (weekdays)                    │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │   Scrape      │   │   Compute    │   │   Generate Briefing   │    │
│  │   Watchlist   │──▶│   Signals    │──▶│   (Tom Agent)         │    │
│  └──────────────┘   └──────────────┘   └──────────────────────┘    │
│         │                   │                      │                 │
│         ▼                   ▼                      ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              data/output/ (JSON files)                       │    │
│  │  watchlist.json  │  setups.json  │  tom-briefing.json       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │  git commit   │                                                   │
│  │  + push       │                                                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub Pages (Static Host)                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Dashboard Frontend                         │   │
│  │                                                               │   │
│  │  index.html ─────── Watchlist Grid                           │   │
│  │  ticker.html ────── Ticker Detail + Charts                   │   │
│  │                                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │Watchlist  │  │TradingView│  │ Tom's    │  │ Macro      │  │   │
│  │  │Grid Cards │  │Chart     │  │ Take     │  │ Context    │  │   │
│  │  │           │  │Embeds    │  │ Cards    │  │ Panel      │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  data/output/watchlist.json                                   │   │
│  │  data/output/setups.json                                      │   │
│  │  data/output/tom-briefing.json                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline

### Flow

```
TradingView Watchlist URL
        │
        ▼
scrape_watchlist.py ──── Parse symbols + sections
        │
        ▼
compute_signals.py ───── yfinance OHLCV → EMA 8/21/50, RSI 14, bias
        │
        ▼
generate_setups.py ───── Filter → entry/stop/target/R:R
        │
        ▼
generate_briefing.py ─── LLM call → macro briefing + per-ticker takes
        │
        ▼
data/output/*.json ───── Committed to repo → served by GitHub Pages
```

### Data Files

| File | Size (est.) | Contents |
|------|------------|----------|
| `watchlist.json` | ~50 KB | 70 symbols with all computed fields |
| `setups.json` | ~20 KB | 25-35 active trade setups |
| `tom-briefing.json` | ~30 KB | Daily briefing + per-ticker analysis |

### Python Dependencies

```
yfinance>=0.2.31
pandas>=2.0
numpy>=1.24
requests>=2.31
beautifulsoup4>=4.12
```

---

## Frontend Structure

```
src/
├── index.html              ← Watchlist grid (landing page)
├── ticker.html             ← Ticker detail (query param ?s=TICKER)
├── css/
│   ├── tokens.css          ← Design system CSS custom properties
│   ├── layout.css          ← Grid, sidebar, responsive breakpoints
│   ├── components.css      ← Cards, badges, range bars, dots
│   └── tradingview.css     ← Widget container overrides
├── js/
│   ├── app.js              ← Data fetch, routing, init
│   ├── watchlist.js        ← Grid rendering, sort, filter
│   ├── ticker-detail.js    ← Detail page logic
│   ├── tradingview.js      ← Widget factory functions
│   ├── futures-strip.js    ← Pre-market futures/macro strip renderer
│   ├── ticker-search.js    ← Global search + TradingView detail overlay
│   ├── macro-context.js    ← Macro context strip (SPY, QQQ, VIX, F&G)
│   ├── market-status.js    ← Market open/closed/pre/after indicator
│   ├── icons.js            ← SVG icon library
│   └── utils.js            ← Formatters, helpers
├── scripts/
│   ├── serve.py            ← Dashboard server (static + /api/search proxy)
│   └── update_futures.py   ← Yahoo v8 futures data fetcher → data/futures.json
└── assets/
    └── logo.svg            ← BreakingTrades logo
```

### Page Architecture

**index.html (Watchlist)**
- Ticker tape (fixed top)
- Section-grouped card grid
- Each card: ticker, name, price, change %, bias badge, RSI, mini chart
- Sort/filter controls
- "Tom's Daily Briefing" summary card

**ticker.html (Detail)**
- Ticker tape (fixed top)
- Sidebar: ticker info, bias badge, section navigation
- Key levels strip (6 columns)
- EMA alignment status (colored dots)
- TradingView Daily chart (Advanced Chart widget, 600px)
- TradingView 4H chart (Advanced Chart widget, 600px)
- Technical analysis gauge + symbol overview (2-col grid)
- Trade setup range bar + stats
- Tom's Take card

### Data Fetching

```javascript
// All data loaded from static JSON on the same origin
const watchlist = await fetch('data/output/watchlist.json').then(r => r.json());
const setups = await fetch('data/output/setups.json').then(r => r.json());
const briefing = await fetch('data/output/tom-briefing.json').then(r => r.json());
```

No CORS issues — same-origin static files on GitHub Pages.

---

## GitHub Actions

### `refresh-data.yml` — Daily Data Pipeline

```yaml
name: Refresh Data
on:
  schedule:
    - cron: '35 13 * * 1-5'  # 9:35 AM ET, weekdays
  workflow_dispatch: {}

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r data/pipeline/requirements.txt
      - run: python data/pipeline/run_pipeline.py
        env:
          WATCHLIST_URL: ${{ secrets.WATCHLIST_URL }}
      - run: python data/pipeline/generate_briefing.py
        env:
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
      - name: Commit and push
        run: |
          git config user.name "BreakingTrades Bot"
          git config user.email "bot@breakingtrades.com"
          git add data/output/
          git diff --staged --quiet || git commit -m "data: refresh $(date -u +%Y-%m-%d)"
          git push
```

### `deploy.yml` — GitHub Pages

```yaml
name: Deploy
on:
  push:
    branches: [main]
    paths: ['src/**', 'data/output/**']

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Build site
        run: |
          mkdir -p _site
          cp -r src/* _site/
          cp -r data/output _site/data/output
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## GitHub Pages Deployment

- **URL:** `https://breakingtrades.github.io/breakingtrades-dashboard/`
- **Source:** GitHub Actions artifact (from `_site/` directory)
- **Triggers:** Push to `main` that changes `src/` or `data/output/`
- **Custom domain:** Optional — configure via repo settings later

### Deploy Flow

```
Push to main
    │
    ▼
GitHub Actions: deploy.yml
    │
    ├── Copy src/* → _site/
    ├── Copy data/output/* → _site/data/output/
    │
    ▼
Upload _site/ as Pages artifact
    │
    ▼
GitHub Pages serves at breakingtrades.github.io
```

---

## Security

| Concern | Mitigation |
|---------|-----------|
| API keys | Stored as GitHub Secrets, never in code |
| Watchlist URL | Stored as secret (avoid scraping abuse) |
| No auth for MVP | Public dashboard, no sensitive user data |
| LLM prompt injection | Tom system prompt is server-side, not exposed to frontend |
| Rate limiting | yfinance free tier, standard usage within limits |

---

## Future Architecture (Phase 3+)

```
                    ┌─────────────────┐
                    │  Cloudflare      │
                    │  Worker / Azure  │
                    │  Function        │
                    │                  │
                    │  POST /ask-tom   │
User ──────────────▶│  - System prompt │
  (chat widget)     │  - Methodology   │
                    │  - Context JSON  │
                    │  - LLM API call  │
                    │  - Stream resp   │
                    └─────────────────┘
```

- Live chat requires a serverless function for LLM API calls
- Frontend chat widget sends POST, receives SSE stream
- System prompt + methodology loaded at function cold start
- Context (watchlist + macro) refreshed from latest JSON

---

_Last updated: 2026-03-17_
