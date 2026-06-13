# AI-Trader Tom — Design

## Context

BreakingTrades' existing pipeline produces a rich stream of analytical signals:

- **Tom-FXEvolution agent** (`agents/tom-fxevolution/`) — 296 hand-curated rules
  organized in a 5-layer decision stack (macro regime → flow → sentiment →
  technicals → trade). Each rule has provenance (video source + quote).
  Track-record file logs Tom's calls historically with outcomes.
- **Empirical Priors layer** (`data/empirical-priors.json`) — backtested
  conditional studies (e.g. "QQQ -5% 1d → 1m forward returns by regime").
  Currently 2 studies, designed to grow.
- **Expected Move bands** (`data/expected-moves.json`) — weekly ±1σ implied
  volatility ranges for 92 tickers, anchored every Friday.
- **Signals page** (`js/pages/signals.js`) — generates per-ticker setup cards
  with trigger states (TRIGGERED/APPROACHING/ACTIVE/EXIT/WATCHING) based on
  SMA20/SMA50/RSI/breakouts.
- **Watchlist** (`data/watchlist.json`) — 76 tickers across 7 groups (Quality,
  Speculative, Sectors, IPOs, etc.) with earnings dates + sectors.
- **Regime intelligence** (`data/regime.json`) — daily output of Tom's
  macro-regime classifier (BULL/BEAR/RANGE × cycle phase).

What's missing is the **trader** — the integrating agent that reads all of
these, picks setups consistent with the regime, sizes positions for risk,
opens paper trades, and manages them through to exit.

The TradingAgents framework literature (multi-agent LLM trading systems) +
TradersPost position-sizing analysis + Kelly criterion math + the agent-based
architecture pitfalls write-ups (Aguilera 2025) all converge on the same
five-component shape:

1. **Scout** — universe scan + setup discovery
2. **Analyst** — apply rules + priors to each candidate, produce conviction
3. **Risk** — gate on sizing, heat, correlation, regime
4. **Executor** — fill the trade (paper or live)
5. **Manager** — lifecycle: stops, targets, exits

This is exactly the shape the architecture below adopts — with one BT-specific
twist: the **Analyst IS Tom**. We're not building a generic LLM-driven analyst;
we're routing every candidate through Tom's existing rule database and
decision stack, with empirical-priors as the conditional layer.

## Goals / Non-Goals

**Goals:**

1. End-to-end paper-trading pipeline with deterministic, reproducible trades
   from market state alone (same input → same trades on rerun).
2. Every entry carries Tom rule citations + regime + conviction score in the
   ledger so the public can audit "why".
3. Risk engine is the sole gatekeeper — no path bypasses position sizing,
   portfolio heat, or correlation checks.
4. Track record published nightly. Equity curve, win rate, Sharpe, max
   drawdown, per-rule attribution, per-regime attribution all visible on
   the public AI-Trader page.
5. Shared paper portfolio at $100K starting equity. No per-user state.
6. Pipeline runs as a Step 8 of `eod-update.sh` — adds <60s to total runtime.

**Non-Goals:**

1. Live money. IBKR. Real broker. (Deferred to Phase 4 + tenants.)
2. Intraday signals. (1d bars only at v1.)
3. Options. (Equities only.)
4. ML models / RL agents. (Rule-based v1; ML deferred to v3.)
5. Self-modifying rules. (Tom's RULES.json read-only.)
6. Autonomous external posting. (Track record is read-only on the dashboard
   until operator approves an alert/Twitter/Telegram broadcast.)

## Decisions

### 1. Five-agent pipeline, not monolithic

Decision: Implement as five independent Python modules under `scripts/ai-trader/`
with clean data-file boundaries between them. Each agent reads input JSON,
writes output JSON, and is replaceable independently.

Pipeline shape:

```
data/watchlist.json ─┐
data/expected-moves.json ─┐
data/signals.json ─┐
data/regime.json ─┐         ┌─→ candidates.json
data/empirical-priors.json ─┴─→ [scout.py] ─┘
                                              │
                                              ↓
                            [analyst.py] ─→ recommendations.json
                            (Tom rules +  
                             empirical priors)
                                              │
                                              ↓
                            [risk.py] ─→ approved-orders.json
                            (Kelly sizing +
                             portfolio heat)
                                              │
                                              ↓
                            [executor.py] ─→ fills.jsonl + holdings.json
                            (paper fills vs
                             prices.json)
                                              │
                                              ↓
                            [manager.py] ─→ updated holdings.json + closes.jsonl
                            (trail stops,
                             exit triggers)
                                              │
                                              ↓
                            track-record.json (rolled up nightly)
```

Rationale:
- **Modularity** beats monolithic per the Aguilera write-up: each agent can
  be backtested, replaced, A/B-tested independently.
- **Auditable**: every decision step writes its inputs + outputs to JSON,
  so a public "why did Tom buy NVDA on 2026-06-13" trace is just a sequence
  of file reads.
- **No new infrastructure**: each agent is just a Python script invoked from
  bash, like the existing exporters in `scripts/`. No queues, no workers,
  no LLM calls (Tom's RULES.json is data, not an LLM prompt).

### 2. Tom IS the analyst, not a separate agent

Decision: The analyst stage applies Tom's RULES.json directly as a
deterministic rule engine. We do NOT call out to an LLM at the analyst step.

Rationale:
- Tom's rules are already structured (id, category, rule, priority, source,
  quote). They map cleanly to a deterministic decision tree.
- LLM calls would introduce non-determinism, latency, and API costs —
  unacceptable for a nightly pipeline.
- The 296 rules are sufficient signal density. Empirical evidence: when we
  hand-traced 5 historical setups through the decision stack manually,
  they all produced unambiguous BUY/PASS/AVOID classifications.
- Rule application uses the same Tom-FXEvolution skill / agent that already
  lives in `agents/tom-fxevolution/` — no new "Tom 2.0" build.

The analyst output schema:

```json
{
  "ticker": "NVDA",
  "decision": "ENTER_LONG" | "ENTER_SHORT" | "PASS" | "AVOID",
  "conviction": 0.72,
  "entry_price": 145.50,
  "stop_price": 138.20,
  "target_1": 152.80,
  "target_2": 160.10,
  "rule_citations": ["R001", "R013", "R244"],
  "regime_context": "BULL/late-cycle/MOVE-collapsing",
  "empirical_prior": {
    "study_id": "qqq-5pct-1d-since-1999",
    "match_strength": 0.85,
    "expected_return_30d": 0.043
  },
  "tom_quote": "If bonds freak out, everything breaks",
  "blockers": []   // rules that VETOED — empty when decision is ENTER
}
```

### 3. Kelly-fractional sizing + ATR stops + portfolio heat cap

Decision: Position sizing follows a deterministic three-step formula:

1. **Edge calculation.** From the empirical prior + Tom's conviction:
   `p_win = base_rate × conviction_multiplier`
   `b = expected_target_distance / expected_stop_distance`
   `kelly_full = p_win - (1 - p_win) / b`
2. **Quarter-Kelly cap.** `kelly_used = min(kelly_full × 0.25, 0.05)` —
   max 5% account risk per trade. Quarter-Kelly is the empirically-validated
   "captures 75% of optimal growth, 50% of drawdown" point per Kelly
   literature.
3. **ATR stop sizing.** Stop distance = `1.5 × ATR(20)` from entry. Position
   size in shares = `(account_equity × kelly_used) / (entry - stop)`.

Portfolio heat cap: total open-position risk (sum of `(equity at risk)` per
position) MUST NOT exceed 12% of account equity. New entries that would push
heat over 12% are sized down (or rejected if undersizing falls below 0.5%
risk per trade).

Correlation cap: positions in the same sector cluster (XLK, XLF, etc.) MUST
NOT exceed 35% of account equity in aggregate. Tracked via `data/sector-rotation.json`.

Rationale:
- **TradersPost research:** standard institutional risk-per-trade is 0.5-2%.
  Quarter-Kelly typically lands in this range when conviction is moderate.
- **Anti-leverage:** even at 100% Kelly with 0.6 win rate × 1.5:1 reward, the
  trader would risk 40% per trade — catastrophic for a public-facing track
  record. Quarter-Kelly + 5% cap is conservative-but-real.
- **ATR-based stops:** Tom's rules implicitly use SMA20 as a trail stop. ATR
  stops adapt to current volatility (per the volatility-adjusted sizing
  literature), so a $400 NVDA stock with $8 ATR gets a $12 stop, not a
  $4 one.

### 4. Paper executor with realistic slippage

Decision: Fills are simulated against `data/prices.json` close prices with
deterministic friction:

- Slippage: 5 bps on entry, 5 bps on exit. (Conservative for liquid US
  equities; realistic for the small/mid caps in the watchlist.)
- Stop trigger: when daily LOW <= stop_price, fill at `stop_price - 5 bps`
  (gap-down assumption). When daily HIGH >= stop on reversal, fill at stop.
- Target trigger: same logic against daily HIGH.
- No partial fills at v1. Order is either fully filled or rejected.
- No after-hours fills. Open at open, close at close.

Rationale:
- The track record needs to translate 1:1 when we later wire IBKR for
  tenants. If we paper-fill at perfect mid-price, the live results will
  diverge dramatically.
- Deterministic slippage means rerunning the pipeline produces identical
  trades. Random slippage would break reproducibility.
- 5 bps is the lower end of typical retail slippage; we can scale per-ticker
  later based on observed bid-ask spreads.

### 5. Position lifecycle: SMA20 trail + EM-band exits + time stop

Decision: Manager applies four exit triggers in priority order:

1. **Stop hit:** stock <= stop_price → close at stop (5 bps slippage).
2. **Target hit:** stock >= target_2 → close at target (no slippage; target
   limit orders fill at limit). Optional: trim half at target_1, trail
   second half.
3. **EM band exit:** if ticker breaches the upper EM band by >1.5σ AND has
   been open >5 trading days → close (mean-reversion exit, per Tom's
   "extension is exhaustion" rule).
4. **Time stop:** if no trigger fires for 30 trading days → close at close.
   (Prevents stale positions from anchoring portfolio heat indefinitely.)
5. **Regime change:** if regime flips from BULL to BEAR (or vice versa for
   shorts) → close all open positions of that direction next session.
   Tom's macro layer is normative.

Trail stop: at +1×R unrealized profit (1×ATR move in your favor), stop
moves to entry. At +2×R, stop moves to +1×R. Standard trend-following
stop progression.

Rationale:
- **Trail stops eliminate "give-back"** — the #1 retail trader killer
  per Tom's rule R042 ("don't give back gains").
- **EM band exits codify mean-reversion** — Tom's rule R187 ("extension is
  exhaustion") wants you out at the upper band even if the trend is intact.
- **Time stops cap holding period** — bounded holding period bounds the
  hypothesis. No "I'll just hold this for a year" trades.
- **Regime change override** — Tom's macro layer is the safety net.

### 6. Single shared paper portfolio at $100K, no per-user state

Decision: One global `data/ai-trader/holdings.json` owned by the system.
Public, read-only on the dashboard. No login. No accounts. No tenant
isolation.

Rationale:
- AGENTS.md Rule 11 (public site = no per-user state until tenants).
- Single portfolio is the cleanest demo: visitors see the same numbers we
  see, no confusion about whose money is being tracked.
- $100K is large enough to size meaningfully (a 1% trade = $1000, real
  enough that fractional-share quirks don't dominate); small enough to
  be relatable to retail users.

### 7. State files all in `data/ai-trader/`

Decision: All AI-Trader state lives under one folder, each file with a
clear schema:

- `holdings.json` — current open positions (1 record per ticker)
- `decisions.jsonl` — append-only log of every analyst decision (entry +
  pass + avoid)
- `track-record.json` — rolled-up performance metrics (equity curve, win
  rate, Sharpe, drawdown, per-rule attribution)
- `risk-state.json` — current account equity, portfolio heat, correlation
  exposure, available risk budget
- `ledger/YYYY-MM-DD.jsonl` — daily snapshot of pipeline run (one file per
  trading day)

The `ledger/` directory is the audit trail. Every run writes a new file;
nothing in `ledger/` is ever modified or deleted. This is the public's
"how do we know Tom didn't cheat" answer.

### 8. Cron timing: Step 8 of eod-update.sh, 4:30 PM ET

Decision: Pipeline runs in `scripts/eod-update.sh` after Step 7 (Quarterly
EM History) and before the git commit step. Order:

```
1-7. Existing pipeline (prices, F&G, VIX, breadth, EM, sectors, regime)
 8.  AI-Trader pipeline:
       a. scout.py → candidates
       b. analyst.py → recommendations
       c. risk.py → approved orders
       d. executor.py → fills + holdings
       e. manager.py → lifecycle updates
       f. track-record rollup
9.   Git commit + push (existing)
```

Total added time: target <60s. Bottleneck is the analyst stage if we ever
add LLM calls; v1 is pure rule application + numerical scoring, should be
<5s.

Rationale:
- Runs after all data is fresh. Decisions made on stale data are worthless.
- Runs before commit so the day's trades land in the same git commit as
  the day's data. Atomicity simplifies the "what did the system know when
  it traded?" question.
- 4:30 PM ET (the existing EOD slot) means we trade on the official close.
  No overnight gap risk, no after-hours funny business.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **Rule contradictions when 296 rules vote on the same setup** | Decision stack is hierarchical. Macro layer vetoes flow layer; flow vetoes sentiment; etc. Tom's existing AGENT.md decision priority survives. Tied votes default to PASS (not enter). |
| **Empirical priors layer is sparse (2 studies)** | Use NULL prior when no study matches. Conviction defaults to 0.5 (neutral). Add studies opportunistically — Phase 2 deliverable is 8 studies covering common Tom-rule trigger conditions. |
| **Quarter-Kelly is too conservative for high-conviction setups** | Override path: if conviction > 0.85 AND empirical match_strength > 0.9, scale to half-Kelly (still capped at 5% account). Documented in AGENT.md. |
| **Public track record bombing destroys credibility** | Drawdown circuit-breaker: if account equity drops >15% from peak, pipeline pauses entries for 7 trading days. Public banner shows "AI-Trader recovering — entries paused". Manager continues to manage open positions normally. |
| **Slippage assumption is wrong on small caps** | Per-ticker slippage table in `risk.py` keyed off `data/watchlist.json` group. Speculative group gets 15 bps; Quality 5 bps; Mega cap 3 bps. Configurable. |
| **Pipeline failure silently skips a trading day** | EOD log monitoring: if `data/ai-trader/ledger/YYYY-MM-DD.jsonl` is missing for a trading day, the dashboard's freshness sidebar dot turns red and the AI-Trader page shows a banner. |
| **Position-tracking drift over time** | Reconcile job: monthly script verifies `holdings.json` cash + position market value = `track-record.json` reported equity within $1. Drift triggers an alert. |
| **Same setup gets retraded after a stop-out, churning** | Cooldown: after a stop-out on a ticker, that ticker is blocked from new entries for 5 trading days. Prevents revenge trading. |
| **Manager closes positions visibly bad timing** | Each close writes a P&L attribution. Public can see "Tom exited NVDA at $145 because regime flipped; NVDA went to $160 next week" — that's part of the honesty contract, not a bug. |

## Open Questions

1. **Should the analyst be allowed to add tickers OUTSIDE the 76-ticker
   watchlist?** Recommended: YES if the empirical priors layer matches a
   condition that names a different ticker. Default: NO at v1 (universe =
   watchlist + 12 macro proxies = SPY/QQQ/IWM/DIA/TLT/HYG/GLD/DXY/VIX/XLE
   /XLF/XLK).

2. **Short selling — allowed in v1?** Recommended: YES with hard cap of
   25% of portfolio in shorts. Tom has bear-side rules (R042-R067) and
   removing the short side leaves half his decision stack inert. Risk
   engine treats shorts identically (Kelly + ATR + heat).

3. **What's the maximum number of open positions?** Recommended: 12.
   With $100K and 1-2% risk per trade, 12 positions × 1.5% avg = 18%
   heat which is above our 12% cap — so naturally bounded by heat
   already. 12 is just a sanity check.

4. **Telegram broadcast of AI-Trader entries?** OUT OF SCOPE for this
   change. Operator-approved push to the BreakingTrades Telegram bot
   would be a separate `add-ai-trader-broadcast` change (Phase 5).

5. **What about overnight entries — does the analyst run pre-open or
   post-close?** Recommended: post-close (current EOD slot). Entries
   fill at next session's open with 5 bps slippage. Pre-open variant is
   a future option.

6. **Per-rule attribution table — how granular?** Recommended: every
   closed trade attributes its P&L to up to 3 rules (the rule citations
   on the entry). Rolled up monthly: "R001 contributed +$2,340 across
   12 trades, win rate 67%". This is the rule-quality feedback loop.
   Drives manual rule curation.

## See Also

- Parent agent: `agents/tom-fxevolution/AGENT.md` — Tom's decision stack
- Empirical priors layer: `openspec/changes/archive/2026-06-06-autoresearch-empirical-priors/`
- Risk literature: `references/kelly-fractional-sizing-notes.md` (Phase 1
  deliverable, captures the math derivation + worked examples)
- Multi-agent architecture: Aguilera 2025 (Medium), TradingAgents framework
  (DigitalOcean), TradersPost position-sizing guide
