# Tom Publisher — Rule Engine + Live Alerts

> Status: **Proposed** | Priority: **Critical** | Created: 2026-04-16
> Related: `ai-ready-architecture` (defines `data/tom/` schemas), `tom-chat` (consumes alerts)

## Problem

Tom Agent has a rich, auditable rule library:
- `agents/tom-fxevolution/RULES.json` — 30+ codified trading rules (R001–R030+) with priority, thresholds, source citations
- `agents/tom-fxevolution/MARKET_MEMORY.md` — Historical analogs
- `agents/tom-fxevolution/TRACK_RECORD.json` — Past calls

**But none of it runs against live data.** The rules are dormant — a book on a shelf. The dashboard only shows:
1. A static daily briefing (`data/briefing.json`, LLM-generated once per day)
2. Raw data charts (EM, watchlist, regime)

There is **no producer that evaluates Tom's rules against intraday market state** and pushes alerts to `data/tom/alerts.json` or `data/tom/ticker-notes.json` — the very files `ai-ready-architecture` spec'd months ago but left empty.

Result: Tom's voice on the dashboard is once-a-day, LLM-generated, non-deterministic, and not tied to his own rule library. When HYG/SPY breaks down (R001: "If bonds freak out, everything breaks"), nobody gets notified.

## Why This Matters

The `ai-ready-architecture` change proposed an **LLM-based** Tom publisher — one big GPT call that writes all 4 files from a prompt. That's useful for prose (briefings, narratives) but wrong for alerts:
- Non-deterministic (same input → different alert text)
- Expensive (every 30 min × $0.01 = $14.40/mo just for alerts)
- Can't be audited ("why did Tom say to exit NVDA?" — because the LLM said so)
- Can't be backtested

Tom Publisher is the **deterministic complement**: pure Python, zero LLM calls, rule-driven, auditable. Rules fire when thresholds trip. Every alert has a `ruleId` pointing back to RULES.json. Results are reproducible.

## Vision

Single script, `scripts/tom-publisher.py`, runs every 30 min during market hours (9:30 AM–4:00 PM ET) + once at 4:30 PM ET + once at 6:00 AM ET (pre-market). For each run:

1. Load current market state from existing JSONs (`prices.json`, `vix.json`, `fear-greed.json`, `breadth.json`, `expected-moves.json`, `watchlist.json`, `sector-rotation.json`)
2. Load Tom's rule library (`RULES.json`)
3. Evaluate every rule against current state
4. Write structured outputs to `data/tom/`:
   - `alerts.json` — rule fires with severity, timestamps, rule citations
   - `ticker-notes.json` — per-ticker rule-based commentary (e.g. "Below 20 MA — R006 exit signal")
   - `market-pulse.json` — regime summary from rule aggregation

No LLM. No prompts. Pure logic. ~200 lines of Python.

The LLM publisher (from `ai-ready-architecture`) still runs **daily** for narrative briefing. Tom Publisher runs **every 30 min** for tactical alerts. Two producers, one `data/tom/` namespace, clear separation.

## Architecture

### Data Flow

```
prices.json  ─┐
vix.json     ─┤
fear-greed.json ┤      ┌──────────────────┐
breadth.json ─┼──────► │  tom-publisher   │
expected-moves.json ─┤  │   (every 30m)    │
watchlist.json ─┤      └────────┬─────────┘
sector-rotation.json ─┘         │
                                │ evaluates rules
                                ▼
                     ┌────────────────────┐
                     │   RULES.json       │ ← 30+ rules w/ thresholds
                     │  (source of truth) │
                     └──────────┬─────────┘
                                │
                                ▼
                  ┌─────────────────────────────┐
                  │  data/tom/                  │
                  │    ├── alerts.json          │
                  │    ├── ticker-notes.json    │
                  │    └── market-pulse.json    │
                  └──────────┬──────────────────┘
                             │
                             ▼
                       Dashboard (SPA)
                    reads + renders Tom's voice
```

### Rule Evaluator Design

Each rule in `RULES.json` gets an evaluator function. Registry pattern:

```python
EVALUATORS = {
    "R001": evaluate_bonds_breaking,      # HYG/LQD weekly close vs SMA20
    "R002": evaluate_dark_pool_flow,      # (stub until Volume Leaders feed exists)
    "R003": evaluate_smart_dumb_money,    # (stub until SentimenTrader feed exists)
    "R006": evaluate_20ma_exit,           # per-ticker — watchlist scan
    "R007": evaluate_weekly_20ma,         # per-ticker — mean reversion zone
    "R008": evaluate_yield_curve,         # US02Y/US10Y ratio < 1.0
    "R009": evaluate_financials_canary,   # XLF breaking support
    # ... one per rule
}
```

Each evaluator returns `None` (rule doesn't fire) or an alert dict:

```python
{
    "ruleId": "R006",
    "severity": "urgent",  # from rule.priority
    "type": "alert",
    "title": "NVDA daily close below 20 MA — exit signal",
    "body": "Close $132.40 < SMA20 $135.81. Rule R006: 20 MA is king.",
    "tickers": ["NVDA"],
    "thresholds": {"sma20": 135.81, "close": 132.40, "pct_below": -2.5},
    "sources": rule["source"],
    "quote": rule.get("quote"),
    "timestamp": datetime.utcnow().isoformat() + "Z"
}
```

### Missing Data Handling

Rules that depend on data we don't have yet (dark pool flows R002, SentimenTrader R003, Volume Leaders) are registered but return `{"stub": True, "reason": "data source not wired"}`. They're tracked in `market-pulse.json.coverage` so we know which fraction of Tom's brain is live vs dormant.

Current estimate:
- **Live today (data exists):** R001 (HYG/LQD), R006 (20 MA exits), R007 (weekly 20 MA), R008 (yield curve — needs US02Y/US10Y ratio), R009 (XLF canary), R010+ (sector rotation via pair ratios already in dashboard), F&G thresholds, VIX regime
- **Stub (data missing):** R002 (dark pools), R003 (smart/dumb money), R005 (retail flow), R010 Vanda, anything X-feed-derived
- **Target Month 1:** 12–15 rules live (80% of R001–R030 critical/high-priority)

### Deduplication

Without dedup, the same alert fires every 30 min. Each evaluator includes a `dedupe_key` (e.g. `"R006:NVDA:2026-04-16"`). On write, `alerts.json` retains the first fire of the day per key. Re-fires update `count` and `last_fired` but don't duplicate the entry.

Alert expiry: alerts older than 7 days are dropped unless `pinned: true`.

### Scheduling

- **Local Mac cron:** `*/30 9-16 * * 1-5` (every 30 min, 9 AM–4 PM ET, Mon–Fri) + one-shot 16:30 + 06:00
- **GitHub Actions fallback:** same schedule, runs `python scripts/tom-publisher.py` and commits `data/tom/*.json` (if changed) with message `tom-publisher: <N> rules fired`
- **Idempotent:** running twice in same 30-min window produces identical output (dedupe_key)

## Capabilities

### New Capabilities

- `tom-publisher-script` — `scripts/tom-publisher.py`, CLI with `--dry-run`, `--rule R006`, `--verbose`, `--format json|text` flags. Reads RULES.json + market state. Writes to `data/tom/`.
- `rule-evaluators` — One Python function per live rule in RULES.json. Signature: `def evaluate_RXXX(market_state: dict, rule: dict) -> Optional[list[dict]]`. Returns list of alerts (one rule can fire on multiple tickers).
- `rule-coverage-report` — `market-pulse.json` includes `rule_coverage: {live: [...], stub: [...], total: N, live_pct: %}` so dashboard can show "14/30 Tom rules live, 16 awaiting data sources".
- `alert-deduplication` — `dedupe_key` + `count` + `first_fired` + `last_fired` fields prevent spam, preserve history.
- `alert-ttl` — Alerts auto-expire after 7 days unless `pinned`.
- `cron-tom-publisher` — Local Mac cron entry + GitHub Action `.github/workflows/tom-publisher.yml`.

### Modified Capabilities

- `data-pipeline` (from existing spec) — Tom Publisher added as post-step after prices/vix/breadth refresh. Runs after intraday data updates, before EOD pipeline.
- `ai-ready-architecture` — This change **implements** the `alerts.json`, `ticker-notes.json`, `market-pulse.json` writers that the parent spec described but never built. The existing LLM briefing script (`generate-briefing.py`) stays as the narrative producer for `briefing.json` only.

## Rule Catalogue (Phase 1 — Live Rules)

Target 12 rules live in Phase 1. Estimated LoC per evaluator: 10–30 lines.

| Rule ID | Description | Data Needed | Status |
|---|---|---|---|
| R001 | HYG/LQD breakdown → reduce equity | `prices.json` HYG + LQD, SMA20 from weekly | ✅ Have |
| R006 | Daily close < 20 MA → exit long | `prices.json` per ticker, SMA20 (compute on-the-fly from `data/<ticker>_daily.csv`) | ✅ Have |
| R007 | Weekly 20 MA = mean reversion zone | Per-ticker weekly CSV + SMA20 | ✅ Have |
| R008 | US02Y/US10Y < 1.0 = recession ahead | Yield proxies in `data/` | ✅ Have |
| R009 | XLF breaking support = canary | `prices.json` XLF + SMA50 | ✅ Have |
| R011 | VIX > 30 = start looking for longs | `vix.json` | ✅ Have |
| R012 | VIX < 15 = complacent, be cautious | `vix.json` | ✅ Have |
| R013 | F&G < 25 (Extreme Fear) = opportunity | `fear-greed.json` | ✅ Have |
| R014 | F&G > 75 (Extreme Greed) = cautious | `fear-greed.json` | ✅ Have |
| R015 | XLY/XLP rolling over = risk-off rotation | `watchlist.json` pair ratios | ✅ Have |
| R016 | HYG/SPY breakdown = credit stress | `watchlist.json` pair ratios | ✅ Have |
| R017 | Ticker close > weekly 20 MA + below 20% EM = buy zone | `expected-moves.json` + CSV | ✅ Have |

Phase 2 (data sources required first):
- R002 (dark pool) — needs Volume Leaders integration
- R003 (SentimenTrader) — needs X feed via xurl
- R005 (Vanda retail flow) — needs Vanda source
- R010 (retail positioning) — needs X feed

## Impact

### New Files
- `scripts/tom-publisher.py` — main script (~250 lines)
- `scripts/rule_evaluators.py` — evaluator functions (~400 lines, 12 rules × ~30 lines each + helpers)
- `scripts/rule_state.py` — SMA/EMA compute helpers, dedupe key logic
- `docs/TOM_PUBLISHER.md` — how to add a new rule evaluator (developer docs)
- `tests/test_tom_publisher.py` — unit tests per evaluator w/ fixture market states
- `.github/workflows/tom-publisher.yml` — GH Action (fallback scheduler)

### New Data Files (CI-generated)
- `data/tom/alerts.json` — rolling alert feed (dedupe'd, 7-day TTL)
- `data/tom/ticker-notes.json` — per-ticker commentary keyed by symbol
- `data/tom/market-pulse.json` — regime summary + rule coverage

### Modified Files
- `scripts/eod-update.sh` — call `tom-publisher.py` as step 8 (after all data refreshed)
- Crontab — add `*/30 9-16 * * 1-5` entry for intraday runs
- `openspec/INDEX.md` — add tom-publisher to Shipped Changes table
- Dashboard `js/tom-alerts.js` (already spec'd in ai-ready-architecture) — consumer side, reads alerts.json

### No Server Required
Same as all BT: static JSON, GitHub Pages / Azure SWA, CI-driven. Zero runtime deps beyond Python stdlib + `pandas` (already installed).

### Cost
$0 incremental. Pure Python, no LLM calls. Runs on existing infra.

### Risk
- **Rule false positives.** Mitigated by the 30-day track-record validation pipeline (out of scope here — separate change `track-record-validator`). Phase 1 rules with >60% false fire rate after 30 days get demoted to `priority: "low"` and hidden from primary alert banner.
- **SMA compute speed.** 222 tickers × 2 timeframes × 20-bar SMA should run in <5s. Benchmark in CI.
- **Rebase conflicts on frequent commits.** Every-30-min commits will occasionally collide with EOD pipeline. Use the same `--ours` data conflict resolver already in `eod-update.sh`.

## Success Metrics

- **Rule coverage:** 12 rules live by end of Phase 1 (from 0 today)
- **Latency:** Alert fires within 30 min of threshold breach (vs daily briefing's ~18 hr worst case)
- **Deterministic:** Same inputs → identical `alerts.json` byte-for-byte (hash test in CI)
- **Dashboard usage:** `tom-alerts` banner rendered on ≥5/7 pages (market, signals, watchlist, EM, events)
- **Audit trail:** Every alert in `alerts.json` links to `ruleId` → clickable to `RULES.json` entry
- **Zero LLM cost** for this component

## Out of Scope

- **LLM-based alerts** (covered by existing `ai-ready-architecture` for daily briefing only)
- **Track record auto-validation** — separate change `track-record-validator` (validates pending_validation outcomes weekly)
- **X feed integration** — separate change `x-feed-pipeline` (unblocks R002/R003/R005)
- **Rule mutation / auto-learning** — later change once we have 30 days of fire data
- **Tom Chat live LLM** — covered by `tom-chat` change, Phase 2

## Follow-On Changes (Sequenced)

1. **tom-publisher** (this) → makes rules live
2. **x-feed-pipeline** → unblocks dark pool + sentiment rules (R002, R003, R005)
3. **track-record-validator** → closes the feedback loop on rule quality
4. **market-memory-index** → vectorize MARKET_MEMORY.md for "rhymes with" matching in market-pulse.json
5. **tom-chat Phase 2** → live LLM on top of alerts+memory
