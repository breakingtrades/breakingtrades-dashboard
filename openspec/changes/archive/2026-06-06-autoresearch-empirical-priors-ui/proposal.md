# autoresearch-empirical-priors-ui

> **Note on retroactive filing.** This change proposal was written 2026-06-06 *after* the implementation shipped in commit `3778a1f` (and a follow-up exporter integration commit). Per dashboard `AGENTS.md` rule 7 ("Document the change in openspec BEFORE implementing"), the proper sequence would have been spec → build. The full design + spec for the empirical-priors layer was authored in the **parent repo** (`openspec/changes/archive/2026-06-06-autoresearch-empirical-priors/`) and that capability shipped end-to-end (parquet → study runner → linker → exporter → dashboard). The dashboard UI was treated as "implementation of parent spec" — defensible but not strictly per the rule. This file backfills the dashboard-side proposal so the dashboard openspec record is internally consistent with rule 7 going forward.

## Why

The parent repo's `autoresearch-empirical-priors` change shipped a 3-layer rule-grounding system: a `data/trading-days.parquet` foundation, an append-only `data/empirical-priors.jsonl` study log, and a `RULES.json` `evidence` field. The work is invisible to the user without a UI surface. The dashboard's `/#autoresearch` SPA route already had 8+ regime-monitoring sections; this change extends it with three new sections that read pre-exported JSON files emitted by the parent repo's pipeline.

Without the UI, every study answer requires CLI access (`python autoresearch/run_study.py …`), every rule-evidence trace requires reading raw JSON, and the per-regime pattern data sits unused. The whole point of building studies as queryable artifacts is that humans can scan and click through them.

## What Changes

### `breakingtrades-dashboard/scripts/export-dashboard-data.py`

- New top-level constants: `PARENT_ROOT`, `PRIORS_JSONL`, `TRADING_DAYS_PARQUET`, `RULES_JSON` (resolve via `os.path.join(__file__/.., .., ..)`)
- New helpers `_load_priors_latest()` (latest-version-per-study from append-only jsonl) and `_load_rules()` (RULES.json reader)
- New `export_empirical_priors_layer()` function emitting three JSON files under `data/`:
  - **`data/empirical-priors.json`** — `{ generated_at, n_studies, studies: [...] }`. Studies are latest-version-per-study by default; full schema is one entry per study with `study_id, version, title, population, n, outcomes, regime_breakdown, rule_refs, source_query, created_at, evidence_dates, notes`
  - **`data/regime-explorer.json`** — `{ generated_at, regimes: { <name>: { n_days, date_range, per_ticker, studies_touching } } }`. Per-ticker stats include `n_days, cum_return, mean_return_1d`
  - **`data/rule-lineage.json`** — `{ generated_at, n_rules_with_evidence, rules: { <rule_id>: { id, category, priority, rule, source, evidence } } }`. Only includes rules whose RULES.json entry has a non-empty `evidence` field
- Hooked into `main()` post-pipeline: best-effort, non-fatal on exception

### `breakingtrades-dashboard/js/pages/autoresearch.js`

- HTML scaffold for 3 new sections inserted before the closing `</div>` of `page-content`: `section-priors`, `section-regime-explorer`, `section-rule-lineage`. Each follows the existing pattern (`section-title` icon + label + subtitle + `body-*` container)
- 3 new `fetch()` calls added to the `Promise.all` in `init()`: `data/empirical-priors.json`, `data/regime-explorer.json`, `data/rule-lineage.json`
- 5 new render functions: `renderEmpiricalPriors` (sortable table + click-to-detail row binding), `showStudyDetail` (modal-style detail with horizon table + regime breakdown), `renderRegimeExplorer` (per-regime card grid), `renderRuleLineage` (rule table with evidence badges), `showRuleLineageDetail` (full rule + color-coded evidence chain)
- Helper `escAttr(s)` for XSS-safe HTML insertion
- Section render calls placed **outside** the `regimeData` guard so the empirical-priors sections render even when `data/regime.json` is missing/stale. Fallback collapsibles registration in the no-data branch wires up just the new sections
- Three new collapsible registrations added to the main `sections` array: `regime:priors`, `regime:regime-explorer`, `regime:rule-lineage`

### `breakingtrades-dashboard/AGENTS.md`

- Add row to OpenSpec Changes table linking to this proposal + parent repo spec

### `breakingtrades-dashboard/openspec/INDEX.md`

- Add row to "Shipped Changes" table referencing the dashboard commit `3778a1f` and the parent submodule bump `c00d36e`

## Capabilities

### New Capabilities

- **`research-page-empirical-priors-ui`** — the three new sections on `/#autoresearch` (Empirical Priors, Regime Explorer, Rule Lineage) and the supporting exporter section. Distinct from the parent repo's `empirical-priors` capability (which governs the data layer, study runner, and rule-evidence linker contract); this capability governs only the dashboard surface and the export contract that bridges parent → dashboard.

### Modified Capabilities

- None. The existing `autoresearch.js` page contract (8+ regime sections) is unchanged; the new sections are additive.

## Impact

- **Code:** `scripts/export-dashboard-data.py` (+~100 lines), `js/pages/autoresearch.js` (+~290 lines for sections, fetches, render functions, collapsibles).
- **Data (new):** `data/empirical-priors.json`, `data/regime-explorer.json`, `data/rule-lineage.json` — generated each pipeline run.
- **Existing data:** unchanged. The exporter additions are append-only.
- **Dependencies:** Reading `<parent>/data/trading-days.parquet` requires `pandas` + `pyarrow` in the dashboard scripts venv. Already present in parent venv; export script uses parent's data files but runs from the dashboard's Python environment.

## Safety Impact

None. Pure read-only UI surface over read-only data. No live-trading API, no automated rule promotion, no autoresearch parameter changes triggered from the UI. Dashboard is read-only by design — study creation and rule-evidence editing happen via parent-repo CLI (`run_study.py`, `link_rules_to_studies.py`).

## Non-Goals

- This change does NOT permit study creation, study mutation, or rule-evidence editing through the UI. All authoring happens via the parent-repo Python toolchain.
- This change does NOT modify the existing 8+ regime sections on the autoresearch page (regime hero, components, playbook, internals, commodity chain, transition, cycle, history).
- This change does NOT add live-query / SQL endpoints to the dashboard. The dashboard reads pre-computed JSON files only.
- This change does NOT update the v1 standalone page at `v1/autoresearch.html` (legacy page that doesn't load `js/pages/autoresearch.js`). Three new sections live ONLY at the SPA route `/#autoresearch`.

## Routing Note (HIT during build)

`breakingtrades-dashboard/v1/autoresearch.html` is a STANDALONE legacy page with its own inline JS. It fetches `data/autoresearch-results.json` directly and renders the page itself — it does NOT load `js/pages/autoresearch.js` at all. Edits to `js/pages/autoresearch.js` only show up at `http://localhost:8888/#autoresearch` (SPA root with hash route), NOT at `/v1/autoresearch.html`. If a verification snapshot shows "🔬 No Autoresearch Data Yet" with a `bash autoresearch/runner.sh --experiments 20` command, you're on the v1 page — switch to `/#autoresearch`.

## Decisions Confirmed With User

- **Parquet stays in parent repo, not copied to dashboard.** Trading-days.parquet is ~50MB and rebuildable; the dashboard reads pre-computed JSON summaries instead.
- **Append-only studies, latest-version-per-study by default in dashboard.** Versioning + provenance preserved on disk; UI shows the most recent version of each study by default.
- **Sections render outside regimeData guard.** Empirical-priors sections work standalone without `data/regime.json`. Caught during verification when the v1 routing gotcha was first hit.
