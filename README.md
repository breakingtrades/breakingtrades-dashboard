# BreakingTrades Dashboard

Professional trading intelligence dashboard with real-time setup tracking, regime intelligence, expected-moves heatmap, and interactive TradingView charts.

**Live:** [breakingtrades.github.io/breakingtrades-dashboard](https://breakingtrades.github.io/breakingtrades-dashboard/)

## Architecture

**Single-page app (v2)** — one `index.html` shell, hash router, vanilla JS, zero build step. Routes:

| Route | Page | Purpose |
|-------|------|---------|
| `#market` | Market | Sector heatmap, RRG, Fear & Greed, VIX, pairs, sector rankings |
| `#signals` | Signals | Trade setups with lifecycle tracking, detail modals, pair ratios |
| `#watchlist` | Watchlist | 74-symbol tracker with table view, detail modals, EM banner |
| `#expected-moves` | Expected Moves | Options-based risk heatmap with stale-data detection |
| `#airesearcher` | **AI Researcher** | **Regime Intelligence — 7 market regimes, 15 weighted signals, transition conditions, business cycle, history** |

Legacy `#autoresearch` redirects to `#airesearcher`. v1 archived to `v1/`.

## Data Pipeline

Python scripts produce JSON files consumed by the UI. Two update cadences:

- **Intraday** (GH Actions, market hours): `update-prices.py`, `update-expected-moves.py`
- **End of day** (local cron via `scripts/eod-update.sh`): breadth, VIX, fear-greed, regime intelligence, validator

```
yfinance / IB / CNN  →  scripts/update-*.py  →  data/*.json  →  SPA
                              ↓
                   scripts/validate-regime.py  (sanity gate)
```

### Core data files

| File | Producer | Consumer |
|------|----------|----------|
| `data/prices.json` | `update-prices.py` | all regime/breadth/EM scripts |
| `data/regime.json` | `update-regime.py` | AI Researcher page |
| `data/regime-history.jsonl` | `update-regime.py` | Researcher history chart |
| `data/expected-moves.json` | `update-expected-moves.py` | Expected Moves + Watchlist banner |
| `data/fear-greed.json` | `update-fear-greed.py` | Market page + Researcher |
| `data/breadth.json` | `update-breadth.py` | Market page + regime input |
| `data/vix.json` | `update-vix.py` | Market page + regime input |
| `data/futures.json` | `update_futures.py` | Futures strip |
| `data/autoresearch-summary.json` | manual/tuning-runs | Researcher recap card |

## Data Integrity (enforced)

Every data producer follows the [data-integrity spec](../../.openclaw/workspace/skills/uxui/openspec/specs/data-integrity/spec.md) after a class of silent-failure bugs was discovered Apr 16. Rules:

1. **Never overwrite good data with empty data.** Producers refuse zero-row writes, flag partial fetches.
2. **Carry forward on sentinels.** `no_data` / `no_sma` paths preserve the prior value and stamp `stale: true`.
3. **UI distinguishes stale from zero.** Stale conditions render dashed + dimmed + labeled "Stale" — never mistaken for a real unmet reading.
4. **Every write is validated.** `scripts/validate-regime.py` runs after each EOD cycle + as a CI gate.
5. **Every producer has tests.** Empty/partial/recovery paths covered.

See [docs/AI-RESEARCHER-POSTMORTEM.md](docs/AI-RESEARCHER-POSTMORTEM.md) for the full story.

## Tests

```bash
python -m pytest tests/ -v
```

**34 tests** across 4 files:

| File | Count | Covers |
|------|-------|--------|
| `tests/test_update_prices.py` | 3 | Empty/partial/full yfinance paths |
| `tests/test_update_regime.py` | 12 | `compute_sp_vs_d200` math + `assign_signal` carry-forward |
| `tests/test_transition_signals.py` | 9 | `cond()` stale handling + accounting |
| `tests/test_validate_regime.py` | 10 | Runtime validator including the Apr 16 silent-zero canary |

CI runs on every push touching `scripts/` or `tests/` — see `.github/workflows/pipeline-tests.yml`.

## Key Features

- **AI Researcher** — 7-regime model (Crisis → Bear → Correction → Neutral → Bull → Strong Bull → Euphoria), 15 weighted signals, transition conditions showing distance to next regime, business cycle phase, regime history timeline with duration
- **Trade Lifecycle** — 9-state status tracking: Watching → Approaching → Retest → Active → Exit
- **Expected Moves** — ATM straddle × 0.85 ranges (daily/weekly/monthly/quarterly) with risk heatmap + staleness guard
- **Futures Strip** — Pre-market/live data for 14 instruments: ES, NQ, RTY, YM, CL, NG, GC, SI, HG, US10Y, DXY, VIX, BTC, ETH
- **Global Ticker Search** — Tracked symbols get enriched data, external get TradingView widgets
- **Sector Rotation (RRG)** — 4-quadrant regime classification + risk badges
- **Market Status** — Real-time open/closed/pre/after with holiday awareness
- **12 Pair Ratios** — XLY/XLP, RSP/SPY, HYG/SPY, IWM/SPY, and more
- **Fear & Greed** — CNN index with history tracking (JSONL + CSV)
- **Tom's Take** — AI trading assistant analysis per ticker (Phase 4)

## Running Locally

```bash
# Dashboard server (static files + Yahoo search proxy)
python scripts/serve.py

# One-shot data refresh
python scripts/update-prices.py
python scripts/update-regime.py
python scripts/validate-regime.py   # confirm integrity

# Full EOD pipeline
bash scripts/eod-update.sh
```

## Project Status

- **Phase 0: Foundation** ✅ — Repo, org, OpenSpec, design system, TV embed guide
- **Phase 1: Signals MVP** ✅ — Live dashboard with setup cards, charts, filters
- **Phase 2: Multi-Page** ✅ — Watchlist, Expected Moves, Market pages
- **Phase 3: SPA Rewrite** ✅ — Vanilla JS SPA, hash router, AI Researcher page
- **Phase 4: Data Integrity** ✅ — Carry-forward guards, validator, CI gate, 34 tests
- **Phase 5: Tom Agent** ⏳ — AI analysis, cached takes, chat widget

## Docs

| Doc | Description |
|-----|-------------|
| [AI-RESEARCHER-POSTMORTEM.md](docs/AI-RESEARCHER-POSTMORTEM.md) | Apr 16 silent-failure postmortem + defense-in-depth runbook |
| [TESTING.md](docs/TESTING.md) | Test suite reference + coverage breakdown |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) | Data delivery + file formats |
| [MULTI_PAGE_ARCHITECTURE.md](docs/MULTI_PAGE_ARCHITECTURE.md) | SPA routing + page shell |
| [TRADE_LIFECYCLE.md](docs/TRADE_LIFECYCLE.md) | 9-state trade status system |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Colors, typography, spacing tokens |
| [FILTER_SYSTEM.md](docs/FILTER_SYSTEM.md) | Filter bar, tabs, search, timezone |
| [PAIR_RATIOS.md](docs/PAIR_RATIOS.md) | 12 pair ratios reference |
| [TOM_CHAT_SPEC.md](docs/TOM_CHAT_SPEC.md) | Tom chat widget 3-tier architecture |
| [DECISIONS.md](docs/DECISIONS.md) | Design decisions log |
| [PLAN.md](docs/PLAN.md) | Project plan & phased roadmap |

## OpenSpec

See [openspec/INDEX.md](openspec/INDEX.md) for the full change log with commit references. Cross-cutting specs (design tokens, data integrity) inherited from [`~/.openclaw/workspace/skills/uxui/openspec/`](../../.openclaw/workspace/skills/uxui/openspec/).

## Org

[github.com/breakingtrades](https://github.com/breakingtrades)
