# Change: Autoresearch Durable Run Ledger

**Status:** ✅ Implemented (2026-05-31) — local commit `8ee2db2`, not yet pushed
**Author:** Idan + assistant
**Related:** `autoresearch/runner.sh`, `autoresearch/summarize.py` (ci-data-pipeline), `data/autoresearch-results.json`

## Why

The autoresearch optimizer has run weekly for two months, but **cross-run memory was being silently destroyed every run**. `runner.sh` wrote `data/autoresearch-results.json` with a hardcoded `'history': []` (line 235 region) — overwriting the previous run's record on every invocation. The only durable trace of past runs was git commit messages, which is fragile and unqueryable.

Consequences:
- No way for the agent to notice run-over-run drift (is the strategy improving, or is the *market* changing under a fixed strategy?).
- The all-time-peak May-22 run (composite 0.6673) left only an orphaned `history.json` entry; its winning config was never committed and is now unrecoverable.
- Anomaly detection (regime decay, score plateaus) was impossible because nothing stored per-run state.

The ledger is primarily an **agent memory / anomaly-detection tool**, not a tuning log — it lets the agent reason about how the market is shifting across runs, not just track config changes.

## What Changes

**Add** an append-only run ledger at `data/autoresearch-history.json` and **fix** `runner.sh` to append to it on every run instead of clobbering results.

### New data artifact — `data/autoresearch-history.json`

Append-only. One entry per `runner.sh` invocation. Top-level keys: `_schema`, `_note`, `_source`, `last_updated`, `runs`.

Per-run entry keys (current):
`date`, `timestamp`, `best_score`, `best_commit`, `improved_commits`, `source`, `baseline_score`, `best_config`, `experiments`, `improved_count`.

### Backfill

Reconstructed **10 historical runs** (2026-03-29 → 2026-05-31) by clustering git commits (same day + ≤1hr gap) and folding in the orphaned May-22 `history.json` entry. Scores before 2026-04-24 use an earlier evaluator/ticker universe and are flagged as **not comparable** to later runs.

### runner.sh fix

`runner.sh` now reads the existing ledger (tolerating the legacy bare-list shape), appends the current run, stamps `last_updated`, and writes back with `indent=2`. `results.json` stays last-run-only; the ledger is the durable cross-run record.

## Requirements

### Requirement: Ledger is append-only and survives every run
- `runner.sh` MUST append, never overwrite, `data/autoresearch-history.json`.
- A legacy bare-list ledger MUST be migrated to `{runs: [...]}` on first append, not discarded.
- `results.json` retains its last-run-only role; the two artifacts are not merged.

### Requirement: Each run entry is self-describing
- Every entry carries date, timestamp, best/baseline composite, best_commit, experiments run, and improved_count.
- Pre-2026-04-24 entries are marked as predating the evaluator change (not score-comparable).

### Requirement: Graceful on missing/corrupt ledger
- If the ledger file is missing, `runner.sh` creates it with schema headers.
- If it is malformed, the run still completes and writes results.json (ledger append is best-effort, non-fatal).

## Known Gap (follow-up)

The ledger stores **composite + baseline only**, not per-regime scores. Composite is confounded by the April evaluator change, so the real market signal lives in the per-regime breakdown (`selloff_spring25`, `bull_summer25`, `chop_winter25`, `selloff_spring26`), which the ledger does **not** capture. Extending the runner append to snapshot `best_config`'s `regime_scores` (plus None / trade-count flags) would turn the ledger into a true market-regime monitor. Tracked as a proposed follow-up — **not yet implemented**.

## Non-Goals (this change)

- No regime_scores in the ledger yet (follow-up above).
- No dashboard surfacing of the ledger — `summarize.py` is not yet wired to read it (`#airesearcher` still reads results.json last-run-only).
- No automated anomaly alerting off the ledger.

## Rollout

1. ✅ Diagnosed the `history: []` clobber in `runner.sh`.
2. ✅ Reconstructed 10 runs from git history + orphaned May-22 entry.
3. ✅ Wrote `data/autoresearch-history.json` (durable, backfilled).
4. ✅ Patched `runner.sh` to append per run.
5. ✅ Verified append on the 2026-05-31 run (baseline 0.6597 → best 0.6627, ema_short 8→10).
6. ✅ Committed locally `8ee2db2`.
7. ⏳ Pending: push (dashboard rule 6 — explicit approval required).
8. ⏳ Follow-up: snapshot regime_scores; wire `summarize.py` to surface ledger on `#airesearcher`.

## Files touched

- `autoresearch/runner.sh` (append-to-ledger block, ~+44 lines)
- `data/autoresearch-history.json` (new, 10 backfilled runs)
