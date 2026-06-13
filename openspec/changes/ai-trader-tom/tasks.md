# AI-Trader Tom — Tasks

## 1. Spec Authoring + Scaffold (Phase 1)

- [x] 1.1 Author `proposal.md` covering capabilities + safety + non-goals + phasing
- [x] 1.2 Author `design.md` covering architecture + decisions + risks + open questions
- [x] 1.3 Author `tasks.md` (this file)
- [ ] 1.4 Author `specs/ai-trader/spec.md` with end-to-end pipeline requirements
- [ ] 1.5 Author `specs/risk-engine/spec.md` with sizing + heat + correlation requirements
- [ ] 1.6 Author `specs/setup-engine/spec.md` with candidate-discovery requirements
- [ ] 1.7 Author `specs/paper-execution/spec.md` with fill-simulation requirements
- [ ] 1.8 Run `openspec validate ai-trader-tom --strict` and resolve any failures
- [ ] 1.9 Update root `AGENTS.md` with cross-reference to canonical spec
- [ ] 1.10 Sign-off gate: user reviews + approves spec before implementation begins

## 2. Risk Engine (Phase 1)

- [ ] 2.1 Create `scripts/ai-trader/risk.py` skeleton with `RiskState` dataclass
- [ ] 2.2 Implement `compute_kelly_fraction(p_win, b)` per Kelly formula
- [ ] 2.3 Implement `quarter_kelly_size(equity, kelly, max_pct=0.05)` clamp
- [ ] 2.4 Implement `atr_stop_distance(price, atr, multiplier=1.5)` helper
- [ ] 2.5 Implement `position_size(equity, risk_pct, entry, stop)` formula
- [ ] 2.6 Implement `portfolio_heat()` calculation summing open-position risk
- [ ] 2.7 Implement `correlation_exposure()` per-sector aggregation
- [ ] 2.8 Implement `check_entry_eligible(rec)` returning approve/reject + reason
- [ ] 2.9 Write `risk-state.json` schema validator
- [ ] 2.10 Unit tests for each risk function with 90%+ coverage
- [ ] 2.11 End-of-section: validate that no path bypasses `check_entry_eligible`

## 3. Setup / Scout Engine (Phase 1)

- [ ] 3.1 Create `scripts/ai-trader/scout.py` skeleton
- [ ] 3.2 Read `data/watchlist.json` + `data/expected-moves.json` + `data/regime.json`
- [ ] 3.3 Read `data/signals.json` (verify exporter writes this; add if missing)
- [ ] 3.4 Filter universe: 76 watchlist + 12 macro proxies = 88 tickers
- [ ] 3.5 Compute candidate score per ticker:
  - Position-in-EM-band (lower = bullish bias)
  - Signal state (TRIGGERED > APPROACHING > WATCHING)
  - Sector rotation rank
  - Days since last trade (cooldown enforcement)
- [ ] 3.6 Rank candidates, write top 20 to `data/ai-trader/candidates.json`
- [ ] 3.7 Schema validator for candidates.json
- [ ] 3.8 Unit tests with frozen watchlist fixture

## 4. Paper Executor (Phase 1)

- [ ] 4.1 Create `scripts/ai-trader/executor.py` skeleton
- [ ] 4.2 Read `data/ai-trader/approved-orders.json` + `data/prices.json`
- [ ] 4.3 Implement `fill_market_order(order, prices)` with 5 bps slippage
- [ ] 4.4 Implement `fill_stop_order(order, daily_low, daily_high)` (gap logic)
- [ ] 4.5 Implement `fill_target_order(order, daily_low, daily_high)`
- [ ] 4.6 Append fills to `data/ai-trader/fills.jsonl`
- [ ] 4.7 Update `data/ai-trader/holdings.json` after each fill
- [ ] 4.8 Per-ticker slippage table keyed off watchlist group
- [ ] 4.9 Verify deterministic — same input → identical fills (regression test)
- [ ] 4.10 Unit tests for each fill type

## 5. Manager (Phase 3 — deferred)

- [ ] 5.1 Create `scripts/ai-trader/manager.py` skeleton
- [ ] 5.2 Implement stop-trail logic (move to entry at +1R, +1R at +2R)
- [ ] 5.3 Implement EM-band exit (>1.5σ AND held >5d)
- [ ] 5.4 Implement time-stop (30 trading days)
- [ ] 5.5 Implement regime-change exit (BULL→BEAR closes longs)
- [ ] 5.6 Append closes to `data/ai-trader/closes.jsonl` with P&L attribution
- [ ] 5.7 Update `holdings.json` after each close
- [ ] 5.8 Unit tests for each exit trigger

## 6. Tom-Analyst Integration (Phase 2 — deferred)

- [ ] 6.1 Extend `agents/tom-fxevolution/AGENT.md` with Trading Decisions section
  (canonical entry/stop/target/conviction/citations format)
- [ ] 6.2 Create `scripts/ai-trader/analyst.py` skeleton
- [ ] 6.3 Read `agents/tom-fxevolution/RULES.json` + `data/empirical-priors.json`
- [ ] 6.4 Implement decision-stack walker:
  - Macro regime check (vetoes non-aligned setups)
  - Flow check (dark pool / gamma walls / retail flow)
  - Sentiment extreme check (contrarian filter)
  - Technical setup check (SMA / EM / RSI)
  - Final synthesis: ENTER_LONG / ENTER_SHORT / PASS / AVOID
- [ ] 6.5 Compute conviction from rule-vote density + match strength
- [ ] 6.6 Find matching empirical prior (if any), inject base rate
- [ ] 6.7 Compute entry/stop/target from setup + ATR
- [ ] 6.8 Write `data/ai-trader/recommendations.json`
- [ ] 6.9 Unit tests with synthetic regime + 5 historical fixtures

## 7. Track Record + Page (Phase 1 + Phase 2)

- [ ] 7.1 Write `scripts/ai-trader/track_record.py` rollup
- [ ] 7.2 Compute equity curve, win rate, Sharpe, max drawdown
- [ ] 7.3 Per-rule attribution (which rules paid off, which didn't)
- [ ] 7.4 Per-regime attribution (perf in BULL/BEAR/RANGE)
- [ ] 7.5 Write `data/ai-trader/track-record.json`
- [ ] 7.6 Replace `js/pages/stubs.js` ai-trader stub with real renderer
- [ ] 7.7 Wire `js/pages/ai-trader.js` to read all `data/ai-trader/*.json`
- [ ] 7.8 Render equity curve via Chart.js
- [ ] 7.9 Render open positions table with click→detail modal
- [ ] 7.10 Detail modal: Tom's reasoning + rule citations + empirical prior
- [ ] 7.11 Holdings page renders same component (alias)
- [ ] 7.12 Disclaimer chrome on every screen ("Paper trades / not advice / not real money")
- [ ] 7.13 Freshness manifest entry for ai-trader

## 8. Cron Integration (Phase 1)

- [ ] 8.1 Create `scripts/ai-trader/run.sh` orchestrating all 5 stages
- [ ] 8.2 Add Step 8 to `scripts/eod-update.sh` (after Step 7, before commit)
- [ ] 8.3 Verify total pipeline runtime <60s addition
- [ ] 8.4 Test failure isolation: if AI-Trader fails, EOD still commits regular data
- [ ] 8.5 Log AI-Trader output to existing `/tmp/bt-eod-update.log`
- [ ] 8.6 Failure alert: missing ledger file → red sidebar dot + page banner

## 9. Safety + Verification

- [ ] 9.1 Verify no IBKR import / no broker connection in any AI-Trader file
- [ ] 9.2 Verify no per-user state file paths
- [ ] 9.3 Verify disclaimer present on AI-Trader page (visual screenshot test)
- [ ] 9.4 Verify drawdown circuit-breaker triggers at -15%
- [ ] 9.5 Verify cooldown blocks re-entry after stop-out (5 trading days)
- [ ] 9.6 Verify portfolio heat cap holds across 100 simulated days
- [ ] 9.7 Run end-to-end on a frozen 2026-06-09 fixture, verify reproducibility
- [ ] 9.8 Reconciliation script: cash + market value = tracked equity ±$1

## 10. Documentation + Skill Updates

- [ ] 10.1 Update `~/.hermes/skills/customer-engagement/breakingtrades` skill with AI-Trader section
- [ ] 10.2 Update root `AGENTS.md` with AI-Trader pipeline reference
- [ ] 10.3 Update `breakingtrades-dashboard/openspec/INDEX.md` with this change row
- [ ] 10.4 Author `references/kelly-fractional-sizing-notes.md` (math derivation)
- [ ] 10.5 Update `data/freshness-manifest.json` schema docs

## 11. Archive

- [ ] 11.1 After Phase 1 ships + Phase 1 tasks 1-4 + 7-9 are checked off,
  run `openspec archive ai-trader-tom --yes`
- [ ] 11.2 Confirm `openspec/specs/ai-trader/spec.md` lands as canonical
- [ ] 11.3 Phase 2 (Tom-Analyst) and Phase 3 (Manager) ship as separate
  follow-up changes against the now-canonical spec
