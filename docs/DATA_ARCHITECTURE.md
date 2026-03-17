# Architecture Analysis: Data & Interaction on a Static Site

## The Core Problem

GitHub Pages = static files only. No server, no API routes, no runtime.

Three questions:
1. How does the frontend get fresh data?
2. How can users interact with Tom (AI chat)?
3. What's the simplest path that actually works?

---

## Question 1: How Does the Frontend Get Data?

### Option A: Static JSON committed to repo ✅ RECOMMENDED FOR MVP
```
Local Mac (cron) → export script → JSON files → git commit+push → GitHub Pages serves them
Frontend: fetch('/data/watchlist.json')
```
**Pros:** Zero cost, zero infra, dead simple, works offline  
**Cons:** Data staleness (updates only when cron runs — e.g. 9:35 AM + 4 PM weekdays)  
**Latency:** ~2 min from cron trigger to live on GitHub Pages  

For a daily/twice-daily trading dashboard, this is perfect. You don't need real-time ticks — you need morning analysis and EOD updates.

### Option B: Azure Static Web Apps (free tier) with Azure Functions API
```
Frontend hosted on Azure SWA → calls /api/watchlist → Azure Function reads from... what?
```
**Pros:** Free tier includes managed Azure Functions, custom domain, SSL  
**Cons:** Still needs a data source. Functions can't read local CSVs. Would need to either:
- Push JSON to Azure Blob Storage (another moving part)
- Or just... commit JSON to repo (back to Option A)

**Verdict:** Adds complexity for no benefit at this stage. Option A is simpler.

### Option C: Cloudflare Workers + KV/R2
Same problem as B — where does the data come from? You'd still need to push JSON somewhere.

### Option D: Client-side yfinance alternative (Yahoo Finance API direct)
```
Frontend: fetch('https://query1.finance.yahoo.com/v8/finance/chart/D?interval=1d')
```
**Pros:** Real-time data, no export script needed  
**Cons:** CORS blocked from browser. Yahoo Finance API requires proxy or server-side call. Unreliable. Against Yahoo TOS.  
**Verdict:** Not viable.

### Option E: TradingView widgets for charts + static JSON for analysis
```
Charts:    TradingView embed widgets (live, free, no data needed)
Analysis:  Static JSON committed to repo (bias, levels, setups, Tom's takes)
```
**This is the winning combo.** TradingView widgets give you live interactive charts with real-time data FOR FREE. You don't need to serve OHLCV data at all. The JSON only carries computed analysis (bias, levels, setup status, Tom's take).

**WINNER: Option E — TV widgets for live charts + static JSON for computed analysis**

---

## Question 2: TradingView Widget Capabilities

### What's FREE (Advanced Chart embed widget):
- ✅ Live candlestick/line charts with real-time data
- ✅ Multiple timeframes (1H, 4H, D, W, M)
- ✅ Built-in studies: SMA, EMA, RSI, MACD, Bollinger, Volume
- ✅ Custom study configuration: `{"id":"MASimple@tv-basicstudies","inputs":{"length":20}}`
- ✅ Study overrides for colors and line width:
  ```javascript
  "studies_overrides": {
    "moving average.ma.color": "#00d4aa",
    "moving average.ma.linewidth": 2,
    "moving average_1.ma.color": "#ffa726",
    "moving average_1.ma.linewidth": 1
  }
  ```
- ✅ Dark theme, custom background/grid colors
- ✅ Symbol change within widget
- ✅ Drawing tools (user can draw on charts)
- ✅ Date range selection

### What's NOT possible with free embeds:
- ❌ Cross-timeframe overlays (can't show Weekly SMA 20 on daily chart)
- ❌ Custom indicators (Pine Script only works in TradingView app)
- ❌ Programmatic data overlay (can't add your own price lines)
- ❌ Full control over colors of individual MA instances (studies_overrides uses index-based naming)

### TradingView Lightweight Charts (alternative):
- ✅ Open-source Apache 2.0 (45KB)
- ✅ Full styling control (any color, line style, width)
- ✅ Can overlay custom data (Weekly SMA 20 as horizontal line)
- ✅ Can draw price levels (entry, stop, targets)
- ❌ YOU must supply OHLCV data (no built-in data feed)
- ❌ No built-in studies (must compute SMA/RSI yourself)
- ❌ No drawing tools

### Recommendation: HYBRID
- **TradingView embeds** for the main interactive charts (free live data, studies, drawing tools)
- **Lightweight Charts** (optional, later) for custom overlays where we need full control (e.g., setup range bars with entry/stop/target lines)
- **Side-by-side daily + weekly charts** to solve the cross-TF MA problem (MVP approach)

---

## Question 3: How Can Users Interact with Tom?

### The Chat Problem
Tom-as-chatbot needs a server to:
1. Receive user question
2. Load Tom's context (AGENT.md, RULES.json, market data)
3. Call LLM API (Azure OpenAI / Anthropic / etc.)
4. Stream response back

Static site can't do this. Options:

### Option A: No Chat, Just Pre-Generated "Tom's Take" Cards ✅ MVP
```
Export script → feeds context to LLM → caches Tom's analysis as JSON
Frontend shows: "Tom's Take" card per ticker + daily briefing
```
**Pros:** Zero server, zero cost, works on static site  
**Cons:** Not interactive. Users can't ask questions.  
**But:** For MVP, a well-crafted daily briefing + per-ticker analysis is more valuable than a chatbot. Quality > interactivity.

Tom's Take per ticker:
```json
{
  "symbol": "D",
  "take": "Bullish SMA stack forming. Price reclaimed SMA20 ($63.14) — that's the line in the sand. Weekly 20 at $62.50 holding as support. Utilities showing relative strength (XLU/SPY rising). Entry on any dip to SMA20. Stop below SMA50 at $61.50.",
  "action": "WATCH_FOR_PULLBACK",
  "key_level": 63.14,
  "confidence": "MEDIUM",
  "updated": "2026-03-17T09:35:00Z"
}
```

### Option B: Cloudflare Worker as Tom Chat Proxy
```
Frontend → POST /api/tom/chat → Cloudflare Worker → Azure OpenAI API → response
Worker loads Tom's system prompt + relevant JSON context
```
**Pros:** Free tier 100K requests/day, serverless, fast  
**Cons:** Need to set up Cloudflare account, deploy worker, manage API keys in CF secrets, handle rate limiting  
**Cost:** ~$0 (free tier) + Azure OpenAI token costs (~$0.01-0.05 per conversation)  
**Verdict:** Good for Phase 2. Not needed for MVP.

### Option C: Azure Static Web Apps + Azure Function
```
Frontend → POST /api/tom/chat → Azure Function → Azure OpenAI → response
```
**Pros:** You already have Azure resources (Azure OpenAI endpoint: openai-dev-nt6mukageprxm)  
**Cons:** More setup than Cloudflare, Azure SWA free tier has limits  
**Verdict:** Also good for Phase 2. Natural fit given existing Azure resources.

### Option D: Client-side LLM call (expose API key to browser)
**DO NOT DO THIS.** API keys in client-side JS = instant abuse.

### Recommendation:
- **Phase 1 (MVP):** Tom's Take as pre-generated JSON cards. No chat.
- **Phase 2:** Cloudflare Worker OR Azure Function for live Tom chat. Lean toward Cloudflare for simplicity, Azure if you want to demo Azure OpenAI to customers.

---

## Final Architecture for MVP

```
┌─────────────────────────────────────────────────────────────┐
│                     GITHUB PAGES (static)                    │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │  TradingView     │  │  Static JSON (/data/)             │  │
│  │  Embed Widgets   │  │    watchlist.json                  │  │
│  │  (LIVE charts,   │  │    setups.json                     │  │
│  │   free data,     │  │    macro.json                      │  │
│  │   SMA 20/50,     │  │    tom/briefing.json               │  │
│  │   RSI, Volume)   │  │    tom/takes/{TICKER}.json         │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
│           │                        ↑                         │
│      Live from TV           fetch() at page load             │
│      servers (free)                                          │
└─────────────────────────────────────────────────────────────┘
                                     ↑
                              git commit + push
                                     │
┌─────────────────────────────────────────────────────────────┐
│              LOCAL MAC (cron: 9:35 AM + 4:00 PM ET)          │
│                                                              │
│  1. update_data.py        → refresh CSVs from IB/yfinance   │
│  2. scrape_tv_watchlist.sh → latest watchlist snapshot        │
│  3. export-dashboard-data.py:                                │
│     a. Read CSVs → compute SMA 20/50/100/200, RSI, bias     │
│     b. Read watchlist → map sections                         │
│     c. Compute setup status (WATCHING/APPROACHING/etc.)      │
│     d. Run Tom agent → daily briefing + per-ticker takes     │
│     e. Write JSON → data/*.json                              │
│  4. git commit + push → GitHub Pages auto-deploys            │
└─────────────────────────────────────────────────────────────┘
```

### What This Means:
- **Charts are always live** — TradingView handles real-time data
- **Analysis updates 2x/day** — morning open + afternoon close
- **No server needed** — entirely static
- **No data duplication** — CSVs stay local, only computed JSON goes to GH Pages
- **Tom is pre-computed** — quality daily analysis, not a laggy chatbot
- **Phase 2 adds chat** — via Cloudflare Worker or Azure Function when ready

---

## TradingView Widget Config (Updated for Tom's MAs)

```javascript
// Daily chart — Tom's primary setup
function createDailyChart(containerId, symbol) {
  return new TradingView.widget({
    autosize: true,
    symbol: symbol,
    interval: "D",
    timezone: "America/New_York",
    theme: "dark",
    style: "1",
    locale: "en",
    hide_top_toolbar: false,
    hide_legend: false,
    allow_symbol_change: false,
    save_image: true,
    container_id: containerId,
    height: 600,
    width: "100%",
    backgroundColor: "#0a0a12",
    gridColor: "#1a1a2e",
    studies: [
      {id: "MASimple@tv-basicstudies", inputs: {length: 20}},   // SMA 20 — Tom's primary
      {id: "MASimple@tv-basicstudies", inputs: {length: 50}},   // SMA 50 — trend
      "RSI@tv-basicstudies",
      "Volume@tv-basicstudies"
    ],
    studies_overrides: {
      "moving average.ma.color": "#00d4aa",         // SMA 20 — cyan
      "moving average.ma.linewidth": 2,
      "moving average_1.ma.color": "#ffa726",       // SMA 50 — orange
      "moving average_1.ma.linewidth": 1
    },
    range: "6M"
  });
}

// Weekly chart — full MA stack
function createWeeklyChart(containerId, symbol) {
  return new TradingView.widget({
    autosize: true,
    symbol: symbol,
    interval: "W",
    timezone: "America/New_York",
    theme: "dark",
    style: "1",
    locale: "en",
    hide_top_toolbar: false,
    hide_legend: false,
    allow_symbol_change: false,
    container_id: containerId,
    height: 500,
    width: "100%",
    backgroundColor: "#0a0a12",
    gridColor: "#1a1a2e",
    studies: [
      {id: "MASimple@tv-basicstudies", inputs: {length: 20}},   // Weekly 20 — THE level
      {id: "MASimple@tv-basicstudies", inputs: {length: 50}},   // Weekly 50
      {id: "MASimple@tv-basicstudies", inputs: {length: 100}},  // Weekly 100
      {id: "MASimple@tv-basicstudies", inputs: {length: 200}},  // Weekly 200
      "Volume@tv-basicstudies"
    ],
    studies_overrides: {
      "moving average.ma.color": "#00d4aa",         // W20 — cyan
      "moving average.ma.linewidth": 2,
      "moving average_1.ma.color": "#ffa726",       // W50 — orange
      "moving average_1.ma.linewidth": 1,
      "moving average_2.ma.color": "#78909c",       // W100 — gray
      "moving average_2.ma.linewidth": 1,
      "moving average_3.ma.color": "#546e7a",       // W200 — dim gray
      "moving average_3.ma.linewidth": 1
    },
    range: "3Y"
  });
}
```
