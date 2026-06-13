# AI-Trader Tom — Multi-Agent Trading Pipeline

## Why

BreakingTrades has a 296-rule Tom AI agent (`agents/tom-fxevolution/`), 76 tickers in
the watchlist, weekly Expected Move bands anchored every Friday, signals generated
in `js/pages/signals.js`, and an empirical-priors layer with backtested studies.
But all the discovery and synthesis work happens upstream and dies at the screen —
there is no closed-loop reasoning chain that takes Tom's macro/flow/sentiment read,
fuses it with the live setup scan, sizes positions properly, opens paper trades,
manages exits, and produces a track record we can grade.

We have great rules. We don't have a trader running them.

This change defines AI-Trader Tom: a multi-agent paper-trading pipeline that
treats Tom's RULES.json as a normative decision stack, the empirical-priors
studies as conditional priors, the Signals + EM pages as the setup feed, and
the existing dashboard data files as the unified state layer. It runs entirely
on the public site (no IBKR / no real money / no per-user state until tenants
exist) and produces a transparent, auditable trade ledger with real performance
metrics.

The motivation is two-fold:
1. **Forcing function for rule quality.** When 296 rules have to make decisions
   on a daily fixture instead of just being scored against historical videos,
   contradictions and dead rules surface fast.
2. **Public site has nothing to "do."** Visitors can read setups but can't
   watch them play out. AI-Trader gives the dashboard a track record — "here
   are the live ideas, here's how they're doing, here's why" — without ever
   asking a visitor to connect a broker.

The user explicitly wants Tom to "pick and choose, or maybe even find setups,
create holdings, manage positions" — i.e. an end-to-end agentic trader, not a
backtest engine.

## What Changes

- New JSON state layer `data/ai-trader/` with `holdings.json`, `decisions.jsonl`,
  `track-record.json`, `risk-state.json`, `ledger/YYYY-MM-DD.jsonl`
- New Python pipeline `scripts/ai-trader/` with five composable agents:
  - `scout.py` — scans the universe, finds candidate setups
  - `analyst.py` — Tom-RULES.json reasoning over each candidate
  - `risk.py` — Kelly-fractional position sizing + portfolio-heat enforcement
  - `executor.py` — paper-fill simulation against live prices.json
  - `manager.py` — open-position lifecycle (trail stops, exits, breaches)
- New cron stage `scripts/ai-trader/run.sh` that runs after the EOD pipeline
  every trading day at 4:30 PM ET
- New dashboard page `js/pages/ai-trader.js` (replaces the existing stub) with
  open positions, recent trades, performance curve, Tom's reasoning per trade,
  and a "why did Tom do this?" detail modal showing the rule citations
- Routing alias `#holdings` already points at the AI-Trader page (deferred since
  Phase 2A); same renderer
- Added Solution Plays for Tom: extended `tom-fxevolution/AGENT.md` with a
  "Trading Decisions" section that defines the canonical decision format
  (entry, stop, t1, t2, conviction, rule-citations) so the analyst output is
  parseable

### New Capabilities

- `ai-trader`: end-to-end multi-agent trading pipeline that converts Tom's
  rules + market state into auditable paper trades with track-record reporting
- `risk-engine`: position sizing and portfolio-heat enforcement that gates
  every entry through Kelly-fractional sizing, ATR stops, correlation checks,
  and per-account drawdown limits
- `setup-engine`: candidate setup discovery from the existing watchlist + EM +
  signals streams, producing a ranked candidate list for the analyst stage
- `paper-execution`: deterministic fill simulation against `data/prices.json`
  with slippage, partial fill, and stop/target trigger logic that mirrors how
  the live broker would behave (so the track record translates 1:1 when we
  later wire IBKR for tenants)

### Modified Capabilities

- `dashboard-ui`: AI-Trader page replaces stub with a real renderer; Holdings
  alias resolves to same renderer; new freshness feed for `ai-trader` data
- `signals-page-live-data`: signals.js exposes a `BT.signals.candidates()`
  read-only API for the scout agent

## Impact

**Affected code:**
- `agents/tom-fxevolution/AGENT.md` — adds Trading Decisions decision format
- `scripts/ai-trader/*` — new pipeline (Python, runs server-side cron)
- `data/ai-trader/*` — new state files committed nightly
- `breakingtrades-dashboard/js/pages/ai-trader.js` — page renderer
- `breakingtrades-dashboard/js/pages/stubs.js` — remove ai-trader stub
- `breakingtrades-dashboard/openspec/specs/dashboard-ui/spec.md` — MODIFIED
- `scripts/eod-update.sh` — adds AI-Trader as Step 8 (after regime, before commit)

**Dependencies:**
- Python 3.13 + existing venv (pandas, numpy, yfinance — already installed)
- No new npm dependencies on the dashboard side
- No new external APIs (yfinance/Polygon already in pipeline)

**Systems:**
- SWA deploy unaffected — pipeline is data-only
- Cron runs Mon-Fri 4:30 PM ET (5 minutes after EOD pipeline)
- Track record is git-committed; full audit trail via commit history

## Safety Impact

**This is a PAPER-TRADING system.** It must never:

- Connect to IBKR or any live broker (`AGENTS.md` Rule 11: public site has no
  per-user state until tenants exist)
- Tell a visitor to "buy this now" — output is framed as "Tom's read" and
  "paper position" with explicit disclaimer chrome on every screen
- Auto-publish trade ideas to Telegram/Twitter without explicit operator
  approval (no autonomous external posting)
- Risk more than the simulated $100,000 starting account — even though it's
  fake money, drawdown discipline matters because the track record is public
  and a 60% drawdown undermines credibility

Every entry must pass the risk-engine MUST clauses (per-trade max risk,
portfolio heat cap, correlation cap, regime gate). The risk engine is the
sole gatekeeper between analyst recommendation and executor fill — there is
no path that bypasses risk.

## Non-Goals (v1)

- **Real-money trading.** No IBKR. No per-user accounts. Single shared paper
  portfolio. Tenant work is a separate Phase 4 change.
- **Intraday trading.** End-of-day decisions only. No 1-min/5-min bars,
  no tick-level execution, no scalping. Holding periods 1d-30d.
- **Options.** Equities only at v1. Tom's options-flow rules influence the
  setup ranking (e.g. dealer gamma walls), but trades are stock-only.
- **ML models.** Pure rule-based reasoning at v1. The 296 rules in Tom's
  RULES.json are sufficient signal density. ML / RL are deferred to v3.
- **Cross-asset.** US equities + ETFs only. No FX, no futures (FX/futures
  appear in Tom's analysis but not the trade universe).
- **Live news catalysts.** Earnings/FOMC are in `economic-calendar.json` and
  `fomc-calendar.json` — analyst can read them, but news-driven entries
  (post-earnings momentum, FOMC fade) are deferred to v2.
- **Self-modifying rules.** Tom's RULES.json is read-only at v1. Rule-quality
  feedback loop (which rules paid off / which didn't) is captured in the
  ledger but does NOT auto-prune rules. Rule curation is a separate
  human-in-the-loop process via `validate-rules.py`.

## Phasing

Implementation lands in **four phases**, each independently shippable:

- **Phase 1 (this change):** Spec + scaffold + paper executor + risk engine
  + analyst stub. End state: pipeline runs nightly, generates fake trades
  on a deterministic universe, no Tom reasoning yet.
- **Phase 2:** Tom-Analyst integration. Wire RULES.json reasoning + the
  empirical-priors layer + Tom's market-regime read. End state: every paper
  trade carries rule citations + regime context + conviction score.
- **Phase 3:** Manager. Position lifecycle — trail SMA20 stops, EM-band
  exits, time-stops, drawdown management. End state: positions actually
  close with a P&L attribution.
- **Phase 4:** Tenants + IBKR (separate change `add-ai-trader-tenants`).
  Per-user accounts, real-money mode, paper/live toggle. NOT in this spec.
