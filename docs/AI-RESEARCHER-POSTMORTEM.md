# AI Researcher — Data Integrity Postmortem & Hardening

> **Date:** 2026-04-17
> **Status:** Resolved + hardened
> **Page affected:** `#airesearcher` (AI Researcher / Regime Intelligence)
> **Severity:** Correctness — users shown plausible-looking wrong data

---

## TL;DR

A condition on the AI Researcher page displayed `S&P > 5% above D200: 0.00 → 5.00 unmet` while the real value was +5.95% (already met). Root cause was a **three-layer silent-failure stack**: the upstream price producer, the regime compute script, and the UI all treated "missing data" the same way they treat "measured zero." We fixed all three layers, added 34 tests, a runtime validator, openspec requirements, and a UI treatment that makes stale data visually distinct from real data.

---

## 1 · Culprits — ranked by distance from the user

### Culprit #1 (user-visible symptom) — UI didn't distinguish stale from zero
- **File:** `js/pages/autoresearch.js` (`renderTransition()`)
- **Behavior:** Rendered `c.current`, `c.target`, `c.met` straight to DOM. No concept of "this value is stale / carry-forward / no_data."
- **Result:** A sentinel value looked identical to a real unmet condition.
- **Fix:** Added `.tx-card.stale` styling (dashed border, 55% opacity, muted icon, tooltip), a `tx-hero-stale` badge showing "N stale" in the hero progress, `gapText = 'Stale'` instead of "X to go."

### Culprit #2 (first-level data lie) — `cond()` compared raw values
- **File:** `scripts/update-regime.py` (`get_transition_signals()`)
- **Original:** `val = c.get(key, {}).get('value', 0)` then `met = val > target`.
- **Problem:** If a component was stale/no_data, `cond()` still compared its value against the threshold. A stale value could flip met → True (false positive) OR pin met → False (false negative, what we saw Apr 16).
- **Fix:** `cond()` now inspects `comp.get('stale')` and `comp.get('signal')`. If sentinel or stale, it short-circuits: `met=False, stale=True`. The `conditions_met` count automatically excludes stale because they're `met=False`.

### Culprit #3 (second-level data lie) — `assign_signal()` wrote zeros on sentinels
- **File:** `scripts/update-regime.py` (`assign_signal()`)
- **Original:** When a `compute_*` function returned a `no_data` / `no_sma` sentinel (which pairs the label with `value=0`, `score=0`), `assign_signal()` wrote those zeros into `regime.json`.
- **Problem:** Next run of `cond()` saw `value=0`, labeled it with the *prior-run* signal name (e.g. `'above'`), and the zero became "real."
- **Fix:** `assign_signal()` now carries forward the prior component's `value`, `score`, and `signal` fields whenever the new compute returns a sentinel AND a valid prior exists. It stamps `stale: true` so every downstream consumer can see it. Recovery (fresh success) clears the flag.

### Culprit #4 (root cause) — `prices.json` could be overwritten with `{}`
- **File:** `scripts/update-prices.py`
- **Original:** yfinance returns zero rows → script happily wrote `prices.json = {}` → every downstream `compute_*` fell to `no_data` → every signal was stale → the cascade above kicked in.
- **Problem:** A single transient yfinance blip silently nuked the Research page.
- **Fix:** If yfinance returns zero rows, the script refuses to write and logs `[warn] refusing to overwrite prices.json`. If it returns <50% of expected tickers, it merges the partial result over the prior file and flags `"source": "yfinance+carryforward"`.

### Culprit #5 (observability gap) — no validator, no tests, no alert
- **Problem:** None of the above would have been caught before a user saw wrong numbers. There was no pytest coverage on the pipeline and no post-write sanity check.
- **Fix:** Added `scripts/validate-regime.py` + `tests/test_validate_regime.py` + 24 more tests across the compute/carry-forward/transition path. Wired validator into `eod-update.sh` and CI (`.github/workflows/pipeline-tests.yml`).

---

## 2 · Fix layers (in data-flow order)

```
yfinance
   │
   │ (outage / zero rows)
   ▼
scripts/update-prices.py  ◄── FIX 4: refuse empty write + flag partial
   │
   ▼
data/prices.json
   │
   ▼
scripts/update-regime.py
   ├─ compute_sp_vs_d200()    ◄── returns (50, 0, 'no_data') sentinel on miss
   ├─ assign_signal()         ◄── FIX 3: carry forward prior value, stamp stale:true
   └─ get_transition_signals()
         └─ cond()            ◄── FIX 2: stale/sentinel → met=False always
   │
   ▼
data/regime.json
   │
   ▼
scripts/validate-regime.py   ◄── FIX 5: 6 sanity checks, CI gate, cron gate
   │
   ▼
js/pages/autoresearch.js
   └─ renderTransition()      ◄── FIX 1: dashed border, opacity 0.55, "Stale" label
```

---

## 3 · What the validator catches

Run: `python scripts/validate-regime.py`

| # | Check | Catches |
|---|-------|---------|
| 1 | All 15 expected components present | Dropped signal without noticing |
| 2 | No `value=0` with non-sentinel signal | **The Apr 16 bug exactly** |
| 3 | `conditions_met` == count(met AND NOT stale) | Stale double-counted as met |
| 4 | `regime` in known set | Typo or downstream bug |
| 5 | Stale components with zero value + non-sentinel label | Bad carry-forward state |
| 6 | File age ≤ 24h | Pipeline stall detector |

Exit 0 = valid. Non-zero = prints violations, leaves file alone, logs to `eod-update.log`.

---

## 4 · Test coverage (34 tests)

| Test file | Count | Covers |
|---|---|---|
| `tests/test_update_prices.py` | 3 | Empty yfinance result, partial result, full result |
| `tests/test_update_regime.py` | 12 | `compute_sp_vs_d200` sentinels, `assign_signal` carry-forward (fresh / sentinel / no prior / prior-also-stale / prior-zero / recovery clears flag) |
| `tests/test_transition_signals.py` | 9 | Happy path, all-met, unknown regime, stale (>), stale (<), no_data, no_sma, missing component, accounting consistency |
| `tests/test_validate_regime.py` | 10 | Good file, missing file, malformed JSON, unknown regime, missing component, **Apr 16 silent-zero canary**, sentinel-zero allowed, put_call allowed, stale-counted-as-met flagged, stale file flagged |

Run: `python -m pytest tests/ -v` — **34 passed**.

---

## 5 · OpenSpec requirements added

**Project-local** (`openspec/changes/data-integrity-guards/OPENSPEC.md`):
- Documents the 3-tier fix with the exact commit range (`b3f4f1f..bd76ef2`)
- Declares follow-up work and owners

**Workspace-wide** (`skills/uxui/openspec/specs/data-integrity/spec.md`, v1.3.0):
- Rule 1: Never overwrite good data with empty data
- Rule 2: Carry forward on sentinel values (with `stale: true` flag)
- Rule 3: Distinguish missing from zero in the UI
- Rule 4: Empty-state placeholders
- Rule 5: Regression tests for every data producer

Every future dashboard built in this workspace inherits these requirements.

---

## 6 · Operator runbook

### When Research page shows "N stale" in the hero

Check what's missing:
```bash
python -c "import json; d=json.load(open('data/regime.json')); \
  [print(k, v.get('signal')) for k,v in d['components'].items() if v.get('stale')]"
```

Common causes:
- yfinance outage → check `data/prices.json` size + mtime
- Missing watchlist entry for an ETF → check `data/watchlist.json`

### When validator fails

```
[validate-regime] ❌ 1 violation(s) in data/regime.json:
  - sp_vs_d200: value=0 with non-sentinel signal='above' ...
```

1. **Do not deploy.** Previous good file is still served.
2. Re-run `python scripts/update-regime.py` once (may have been transient).
3. If still failing, inspect the component listed and the backing compute function.
4. If yfinance is down, wait for recovery — pipeline is designed to stay safe.

### When the file is flagged stale (>24h old)

Cron is not running. Check:
- `~/Library/LaunchAgents/com.breakingtrades.eod.plist` (or wherever EOD runs)
- `/tmp/eod-update.log` last lines

---

## 7 · Invariants now enforced

1. **`data/regime.json` is never overwritten with degraded data silently.** Every degradation is either flagged (`stale: true`) or refused (prior file wins).
2. **Stale never counts as met.** `cond()` short-circuits + validator rejects inconsistency.
3. **UI always reflects the truth.** Stale rendering is visually distinct and textually explicit.
4. **Every data-producing script has a matching test file.** Enforced by uxui data-integrity spec Rule 5.
5. **Every regime.json write is validated.** Enforced by eod-update.sh + CI gate.

---

## 8 · Files changed (this hardening pass)

```
scripts/update-prices.py                    # refuse empty writes
scripts/update-regime.py                    # assign_signal carry-forward + cond() stale-aware
scripts/validate-regime.py                  # NEW — runtime validator
scripts/eod-update.sh                       # wires validator into pipeline

tests/test_update_prices.py                 # NEW — 3 tests
tests/test_update_regime.py                 # NEW — 12 tests
tests/test_transition_signals.py            # NEW — 9 tests
tests/test_validate_regime.py               # NEW — 10 tests

js/pages/autoresearch.js                    # stale condition rendering + hero badge
css/autoresearch.css                        # .tx-card.stale + .tx-hero-stale styling

docs/TESTING.md                             # NEW — test-suite reference
docs/AI-RESEARCHER-POSTMORTEM.md            # NEW — this file
openspec/INDEX.md                           # updated — data-integrity-guards shipped
openspec/changes/data-integrity-guards/OPENSPEC.md  # NEW — project change log

.github/workflows/pipeline-tests.yml        # NEW — CI gate

# Workspace / design-system level
skills/uxui/openspec/INDEX.md               # v1.2.0 → v1.3.0
skills/uxui/openspec/specs/data-integrity/spec.md   # NEW — cross-cutting requirements
```

---

## 9 · What made this bug survive so long

- Silent failure at **every layer**. No single layer logged a warning loud enough.
- The wrong number (0.00) looked *plausible*. A nonsense value (like `-9999`) would have been caught immediately.
- No tests on the pipeline. Pure scripts, no feedback loop.
- No post-write sanity check. The pipeline exit 0 was interpreted as "things are fine."

## 10 · What will prevent it next time

- **Tests** run on every push (CI gate).
- **Validator** runs after every EOD write (cron gate).
- **UI** surfaces stale as a visually loud first-class state (user-visible gate).
- **Openspec** makes the pattern mandatory for every future dashboard (process gate).

Four independent lines of defense. Any one of them, present back in March, would have caught this bug within a day.
