## Context

The BreakingTrades dashboard needs a Python data pipeline that computes trading signals from 958 local CSV files (downloaded from IB/yfinance), classifies trade lifecycle states, and exports static JSON for GitHub Pages. The pipeline runs on a local Mac via cron (9:35 AM + 4:00 PM ET weekdays). The dashboard is a static HTML site — no server, no API, no database. All computed data is committed to git as JSON files.

CSV data lives at `~/projects/breakingtrades/data/{ticker}_{timeframe}.csv` with columns: Date, Open, High, Low, Close, Volume. Some CSVs have parsing errors (extra fields). The watchlist has 70 symbols across 5 sections (stocks, ETFs, pair ratio components, macro proxies, community ideas).

Tom's analysis generation requires LLM calls using Tom's agent context at `~/projects/breakingtrades/agents/tom-fxevolution/` (AGENT.md, SOUL.md, RULES.json, MARKET_MEMORY.md — 1,442 lines total).

## Goals / Non-Goals

**Goals:**
- Single Python script that computes all signals, lifecycle states, ratios, macro data, and Tom analysis
- Output matches the JSON schemas consumed by the dashboard-ui change
- Runs in < 5 minutes for full 70-symbol watchlist including LLM calls
- Handles missing/malformed CSVs gracefully (skip, log, continue)
- Cron-compatible (no prompts, env var auth, exit codes)

**Non-Goals:**
- Real-time data streaming (batch only)
- Downloading/updating CSV data (handled by separate `update_data.py`)
- Serving data via API (static JSON only)
- GitHub Actions CI/CD (local cron for now; can add later)

## Decisions

### Single-file vs modular pipeline
**Decision:** Single file (`scripts/export-dashboard-data.py`) with clearly separated functions/classes for each stage.
**Rationale:** For a 70-symbol pipeline running locally, a single file with good function separation is easier to debug, deploy via cron, and hand to a coding agent. Module imports add complexity for minimal benefit at this scale.

### Pandas for signal computation
**Decision:** Use pandas for SMA, RSI, and ratio calculations.
**Rationale:** Already a dependency (yfinance requires it). Vectorized operations on 958 CSVs are fast. Wilder's RSI is well-supported via `ewm()`.

### LLM provider for Tom analysis
**Decision:** Support both Azure OpenAI and Anthropic via environment variable (`LLM_PROVIDER=azure|anthropic`). Default to Azure OpenAI since the endpoint already exists (`openai-dev-nt6mukageprxm`).
**Rationale:** Flexibility. Azure OpenAI is available and free (MSFT employee benefit). Anthropic is a fallback.

### System prompt token budget
**Decision:** Tom's system prompt is compressed to ~3,500 tokens (identity 200, top 10 rules 400, decision stack summary 500, communication rules 200, response format 100). Per-ticker context adds ~800 tokens. Total per call: ~5K in, ~300 out.
**Rationale:** Keeps cost ~$0.01/call for GPT-4.1. 70 tickers × $0.01 = $0.70/run. 2 runs/day × 20 days/month = $28/month. Acceptable.

### JSON output schema aligned with frontend
**Decision:** Output schemas are defined in `docs/TOM_CHAT_SPEC.md` §6. The pipeline MUST produce JSON that exactly matches these schemas — the frontend does no transformation.

### Retest detection lookback window
**Decision:** Lookback 3-10 sessions for "was above" check. Retest zone: -1.5% to +2.0% of the MA level. Volume health: compare average volume in pullback window to breakout window.
**Rationale:** Per `docs/TRADE_LIFECYCLE.md`. Too short (1-2 days) catches noise. Too long (>10 days) catches old breakouts. The -1.5% to +2.0% asymmetry accounts for pullbacks slightly below the level (acceptable) vs too far above (not really retesting).

## Risks / Trade-offs

### Risk: LLM output inconsistency
Tom's takes may vary in quality/format between runs. Mitigation: Strong system prompt with output schema enforcement, post-generation validation, fallback template for failed calls.

### Risk: CSV data gaps
Some watchlist tickers may lack CSVs entirely (D, ADM, NEE, TGT, etc. noted as missing). Mitigation: Skip and log. Add to a "missing data" section in the pipeline summary.

### Risk: Rate limiting on LLM API
70 sequential calls with 1s delay = 70s minimum. If rate limited, could extend to 3-5 minutes. Mitigation: Configurable delay, retry with exponential backoff, `--skip-tom` flag for data-only runs.

### Trade-off: Stale data between cron runs
Data refreshes at 9:35 AM and 4:00 PM only. Intraday movements are invisible. Acceptable for a daily-timeframe methodology where Tom says "daily close below SMA20 = exit" — intraday doesn't matter.
