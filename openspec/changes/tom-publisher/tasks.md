# Tom Publisher — Task Breakdown

## Phase 1: Scaffolding (Day 1, ~2 hrs)

### Task 1.1: Directory + stubs
**Est:** 15 min
- Create `scripts/tom-publisher.py` (entry point, arg parsing, main loop)
- Create `scripts/rule_evaluators.py` (empty registry + 12 stub functions)
- Create `scripts/rule_state.py` (market-state loader)
- Create `data/tom/` if not exists
- Seed `data/tom/alerts.json` as `[]`
- Seed `data/tom/ticker-notes.json` as `{}`
- Seed `data/tom/market-pulse.json` with default structure

### Task 1.2: Market state loader
**Est:** 45 min
- `rule_state.load_market_state()` reads:
  - `data/prices.json` → canonical prices dict
  - `data/vix.json` → current VIX
  - `data/fear-greed.json` → current F&G
  - `data/breadth.json` → breadth snapshot
  - `data/expected-moves.json` → EM ranges
  - `data/watchlist.json` → pair ratios + SMA50s
  - `data/sector-rotation.json` → phase labels
  - For per-ticker SMAs: read `../data/<ticker>_daily.csv` (parent BT repo), compute SMA20/SMA50
- Returns unified `MarketState` dataclass
- Unit tested with fixture JSONs

### Task 1.3: Rule loader + registry
**Est:** 30 min
- `rule_evaluators.load_rules()` reads parent `agents/tom-fxevolution/RULES.json`
- `rule_evaluators.EVALUATORS` dict maps rule_id → function
- Dispatch: `evaluate_all(state, rules) -> list[Alert]`
- Rules without registered evaluator → logged as stub, recorded in coverage
- Dedupe key generator: `f"{rule_id}:{ticker}:{date}"`

### Task 1.4: Output writers
**Est:** 30 min
- `write_alerts(new_alerts, path)` — load existing, merge dedupe keys, drop >7d, sort newest first
- `write_ticker_notes(notes, path)` — per-ticker latest commentary
- `write_market_pulse(pulse, path)` — regime + coverage snapshot
- Atomic writes (temp file + rename)

---

## Phase 2: Rule Evaluators (Day 2–3, ~6 hrs)

### Task 2.1: Sentiment rules (simplest — single inputs)
**Est:** 45 min
- R011 `vix_fear` — VIX > 30
- R012 `vix_complacent` — VIX < 15
- R013 `fg_extreme_fear` — F&G < 25
- R014 `fg_extreme_greed` — F&G > 75
- Each: ~15 lines. Unit test each.

### Task 2.2: Pair ratio rules
**Est:** 1 hr
- R015 `xly_xlp_rollover` — XLY/XLP current < SMA50
- R016 `hyg_spy_breakdown` — HYG/SPY current < SMA50 by >1%
- Read from `watchlist.json` pair ratios (already computed daily)
- Unit test with before/after crossover fixtures

### Task 2.3: Macro rules
**Est:** 1 hr
- R001 `bonds_breaking` — HYG weekly close < weekly SMA20 (compute from CSV)
- R008 `yield_curve_uninvert` — US02Y/US10Y ratio < 1.0 (need ratio CSV or compute)
- R009 `xlf_canary` — XLF daily close < SMA50

### Task 2.4: Per-ticker 20 MA rules
**Est:** 1.5 hr
- R006 `twenty_ma_exit` — iterate watchlist, flag any ticker with daily close < SMA20
  - Input: watchlist tickers, daily CSVs, current prices
  - Output: one alert per ticker, severity=urgent
  - This will produce the MOST alerts — test dedup rigorously
- R007 `weekly_20ma_zone` — flag tickers near weekly SMA20 (within 2%)
- R017 `em_buy_zone` — ticker > weekly SMA20 AND current position in weekly EM < 20%

### Task 2.5: Coverage reporter
**Est:** 30 min
- `market-pulse.json` gets `rule_coverage: {live: [R001, R006, ...], stub: [R002, R003, ...], live_count: 12, stub_count: 18, total: 30}`
- Also regime summary: `{regime: "cautious|defensive|constructive|bullish", vix_band, fg_band, pair_ratio_signals, top_alerts}`

---

## Phase 3: Scheduling + CI (Day 4, ~2 hrs)

### Task 3.1: Local cron
**Est:** 20 min
- Add to crontab: `*/30 9-16 * * 1-5 cd ~/projects/breakingtrades/breakingtrades-dashboard && python scripts/tom-publisher.py >> logs/tom-publisher.log 2>&1`
- Pre-market run: `0 6 * * 1-5`
- Post-close run: `30 16 * * 1-5`
- Log rotation via `logs/tom-publisher.log` with size cap

### Task 3.2: GitHub Action
**Est:** 45 min
- `.github/workflows/tom-publisher.yml`
- Same schedule: `cron: "*/30 13-20 * * 1-5"` (UTC — adjust for ET)
- Steps: checkout → setup Python → install deps (pandas) → run script → commit changes → push with retry
- Use same smart conflict resolver as `eod-update.sh` (ours for `data/`, theirs for fear-greed)

### Task 3.3: eod-update.sh integration
**Est:** 15 min
- Add as Step 8 (after all data refreshed): `python scripts/tom-publisher.py --verbose`
- Fails-open: if Tom Publisher fails, EOD pipeline continues

### Task 3.4: CLI polish
**Est:** 20 min
- `--dry-run` — print what would fire, don't write files
- `--rule R006` — evaluate only one rule
- `--verbose` — log every rule evaluation (hit or miss)
- `--format text` — human-readable output (for cron logs)
- `--since HH:MM` — only alerts after this time

---

## Phase 4: Dashboard Wiring (Day 5, ~2 hrs)

**Note:** `ai-ready-architecture` already specs `js/tom-alerts.js`. This phase connects publisher output to that consumer.

### Task 4.1: Verify consumer compatibility
**Est:** 20 min
- Check `js/tom-alerts.js` spec (in `ai-ready-architecture`) matches our `alerts.json` schema
- If drift, update one side (prefer publisher side since consumer isn't built yet)

### Task 4.2: Coverage banner
**Est:** 30 min
- Add small pill to market page: "Tom's rule engine: 12/30 live" → click → modal shows coverage list
- Tooltip on stub rules: "Requires X data source"

### Task 4.3: Alert badge count
**Est:** 20 min
- FAB or nav badge: # of unread urgent alerts from last 24h
- Reset on open

### Task 4.4: Per-ticker rule citations in detail modal
**Est:** 30 min
- When user opens NVDA detail modal, if `ticker-notes.json["NVDA"]` has entries, render them with rule citations (R006 → popover → rule text from RULES.json)

---

## Phase 5: Tests + Docs (Day 6, ~3 hrs)

### Task 5.1: Fixture-based evaluator tests
**Est:** 1.5 hr
- `tests/test_tom_publisher.py` — one test per evaluator
- Each test: crafted market state → expected alert (or None)
- Run in CI on every PR
- Target: 25+ test cases across 12 rules (fire, no-fire, edge, dedup)

### Task 5.2: Deterministic output test
**Est:** 30 min
- Golden-file test: run publisher twice on same fixture → assert byte-identical output
- Catches any nondeterminism (timestamp in dedupe keys, dict ordering)

### Task 5.3: Coverage test
**Est:** 20 min
- Count `EVALUATORS` vs `RULES.json` entries
- Assert ≥12 live in Phase 1
- Print diff: "18 rules stubbed: R002, R003, R005, ..."

### Task 5.4: Developer docs
**Est:** 40 min
- `docs/TOM_PUBLISHER.md`:
  - How to add a new rule evaluator (5-step guide)
  - How to test locally (`--dry-run --rule R006 --verbose`)
  - How to read alerts.json schema
  - How to handle data source additions

---

## Phase 6: Monitor + Tune (Week 2+, ongoing)

### Task 6.1: Log analysis
**Est:** 1 hr/week
- Review `logs/tom-publisher.log` daily for first 2 weeks
- Catch: false fires, missed fires, performance issues

### Task 6.2: Rule hit-rate tracking
**Est:** separate change (`track-record-validator`)
- Out of scope here — will be its own openspec

### Task 6.3: Backfill stub rules as data sources land
**Est:** 30 min per rule
- R002 when Volume Leaders feed exists
- R003/R005 when X feed via xurl is wired
- Each new evaluator = update `EVALUATORS` dict, add tests, bump coverage

---

## Rollout Plan

**Day 1:** Scaffolding + market state loader merged behind feature flag (doesn't write to `data/tom/` yet)
**Day 2–3:** Evaluators shipped one at a time, each with tests
**Day 4:** Scheduling live, `--dry-run` first for 24 hrs to observe alerts
**Day 5:** Remove `--dry-run`, dashboard wiring
**Day 6:** Tests locked in, docs shipped
**Week 2+:** Monitor, tune thresholds, add stubbed rules as data lands

## Done Criteria

- [ ] 12 rules live, tested, firing in production
- [ ] Cron + GH Action both running without error for 7 consecutive days
- [ ] `data/tom/alerts.json` populated with real alert history
- [ ] `data/tom/ticker-notes.json` shows per-ticker commentary on ≥20 watchlist tickers
- [ ] Dashboard renders coverage pill on market page
- [ ] INDEX.md updated with tom-publisher entry
- [ ] Zero LLM costs logged to this component
