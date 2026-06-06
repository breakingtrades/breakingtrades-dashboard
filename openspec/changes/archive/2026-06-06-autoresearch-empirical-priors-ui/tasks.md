# Tasks: autoresearch-empirical-priors-ui

> **Retroactive filing — all implementation tasks complete and shipped.** Spec-side tasks (this proposal) authored 2026-06-06 after the fact.

## 1. Spec authoring

- [x] 1.1 Write proposal.md with Why / What Changes / Capabilities / Impact / Safety / Non-Goals / Routing Note / Decisions
- [x] 1.2 Write design.md with Context / Goals / Decisions / Risks / Open Questions
- [x] 1.3 Write tasks.md (this file)
- [x] 1.4 Write specs/research-page-empirical-priors-ui/spec.md with ADDED Requirements covering exporter contract, dashboard render contract, fallback behavior, routing
- [x] 1.5 Run `openspec validate autoresearch-empirical-priors-ui --strict`

## 2. Exporter implementation (shipped in `3778a1f`)

- [x] 2.1 Add `PARENT_ROOT`, `PRIORS_JSONL`, `TRADING_DAYS_PARQUET`, `RULES_JSON` constants to `scripts/export-dashboard-data.py`
- [x] 2.2 Implement `_load_priors_latest()` (jsonl reader, dedupe by max version per study_id)
- [x] 2.3 Implement `_load_rules()` (RULES.json reader)
- [x] 2.4 Implement `export_empirical_priors_layer()` emitting 3 JSON files
- [x] 2.5 Hook into `main()` post-pipeline as best-effort non-fatal section
- [x] 2.6 Verify outputs: `data/empirical-priors.json` with `n_studies` populated, `data/regime-explorer.json` with regime cards, `data/rule-lineage.json` with rules-with-evidence

## 3. Dashboard render implementation (shipped in `3778a1f`)

- [x] 3.1 Add 3 HTML section scaffolds to `js/pages/autoresearch.js` render() before closing `</div>`
- [x] 3.2 Add 3 fetches to `Promise.all` in `init()` for the new JSON files
- [x] 3.3 Implement `renderEmpiricalPriors` with sortable table + click-to-detail row binding
- [x] 3.4 Implement `showStudyDetail` (forward-return horizon table + regime breakdown)
- [x] 3.5 Implement `renderRegimeExplorer` per-regime card grid
- [x] 3.6 Implement `renderRuleLineage` rule table with evidence badges
- [x] 3.7 Implement `showRuleLineageDetail` with color-coded evidence chain
- [x] 3.8 Add `escAttr(s)` helper for XSS-safe HTML insertion
- [x] 3.9 Move render calls OUTSIDE the regimeData guard
- [x] 3.10 Add fallback collapsibles registration in the no-data branch
- [x] 3.11 Register 3 new entries in the main `sections` collapsibles array

## 4. Documentation

- [x] 4.1 Update `breakingtrades-dashboard/AGENTS.md` with row in OpenSpec Changes table
- [x] 4.2 Update `breakingtrades-dashboard/openspec/INDEX.md` Shipped Changes table

## 5. Verification

- [x] 5.1 End-to-end run #1: exporter produces 3 JSON files; dashboard renders all 3 sections
- [x] 5.2 End-to-end run #2: idempotent (no manual fixes needed between runs)
- [x] 5.3 Click-to-detail interactivity verified via `browser_console` DOM inspection (study detail modal, rule lineage detail with 3 evidence cards)
- [x] 5.4 Routing gotcha confirmed: v1 page shows "🔬 No Autoresearch Data Yet"; SPA route `/#autoresearch` shows the new sections

## 6. Archive

- [ ] 6.1 Archive: `openspec archive autoresearch-empirical-priors-ui --yes`
