# Design: autoresearch-empirical-priors-ui

## Context

The parent repo's `autoresearch-empirical-priors` change (archived 2026-06-06 at `openspec/changes/archive/2026-06-06-autoresearch-empirical-priors/`) shipped a 3-layer rule-grounding system. That change's spec covers the data layer (trading-days.parquet contract, study log schema, run_study tool, rule-evidence map). It does NOT cover the dashboard UI surface — specifically:

1. Which JSON files the dashboard expects to read
2. The contract between the parent repo's `empirical-priors.jsonl` and the dashboard's `data/empirical-priors.json` (latest-version-per-study transformation)
3. The 3 dashboard sections + their render contracts
4. The render-ordering invariants (sections must work without `data/regime.json`)
5. The routing gotcha about `v1/autoresearch.html` vs the SPA route

This change fills that gap.

## Goals / Non-Goals

**Goals:**
1. Document the export-side contract: what the dashboard reads, what shape it expects, what guarantees the exporter provides.
2. Document the render-side contract: which sections, what data they show, what they fall back to when data is missing.
3. Capture the routing decision (SPA `/#autoresearch` is canonical; v1 page is legacy).
4. Make the dashboard openspec internally consistent with the parent repo's empirical-priors spec.

**Non-Goals:**
1. NOT re-specifying the data layer — that lives in the parent repo's `empirical-priors` spec.
2. NOT adding new UI capabilities beyond what shipped on 2026-06-06 in commit `3778a1f`.
3. NOT documenting the existing 8+ regime sections on the autoresearch page (they're covered by `regime-intelligence` change).

## Decisions

### 1. New capability: `research-page-empirical-priors-ui`

Distinct from the parent's `empirical-priors` capability. The parent owns the data layer + study runner + linker. This dashboard capability owns:
- The exporter section that reads parent-repo data and produces dashboard JSON
- The 3 dashboard sections and their render contracts
- The render-ordering invariants

Splitting capabilities by repo boundary keeps the spec separation clean: parent repo can change parquet schema without breaking dashboard contract (as long as exporter still emits the same JSON shape), and dashboard can re-skin sections without touching parent code.

### 2. Latest-version-per-study by default in dashboard JSON

The parent's `empirical-priors.jsonl` is append-only with versioning (re-running a study creates v2, v3, ...). The dashboard exporter `_load_priors_latest()` deduplicates to one entry per `study_id` (max version). This keeps the UI showing the freshest analysis per study. A future enhancement could add an "all versions" toggle to the UI, but v1 is latest-only.

### 3. Sections render outside the regimeData guard

The existing autoresearch page has a hard short-circuit: if `data/regime.json` is missing, it calls `renderNoData()` and returns early. The empirical-priors sections don't need regime data — they read their own JSON. Putting their render calls inside the regimeData branch would silently disable them whenever the regime pipeline hadn't run.

Verification caught this: clicking through to `/#autoresearch` showed only the no-data hero. Fix: move the 3 render calls above the guard, plus add a fallback `_collapsibles` registration in the no-data branch so the new sections still get their click-to-expand wiring.

### 4. Routing: SPA `/#autoresearch` is canonical

`breakingtrades-dashboard/v1/autoresearch.html` is a standalone legacy page with its own inline JS that fetches `data/autoresearch-results.json` directly. It does NOT load `js/pages/autoresearch.js`. Edits to `js/pages/autoresearch.js` only show up at the SPA route `/#autoresearch` (alias for the internal `airesearcher` route — see `js/router.js`).

This change targets the SPA route only. Migrating the v1 page is out of scope; v1 will be retired with the broader v2 cutover (Phase 4 — see INDEX.md "Active Changes").

### 5. XSS-safe HTML insertion

All study/rule/regime data flows from a controlled pipeline (parent repo Python scripts), not user input. But because the rule statements include free-form text that could include `<` `>` `&` `"` `'` characters, the renderer uses `escAttr(s)` everywhere user-visible text is interpolated into innerHTML strings. Defensive practice for a read-only UI fed from disk; cheap insurance.

### 6. Pure file-based contract — no Pandas in browser

Dashboard renders from pre-computed JSON. The trading-days parquet (50MB) is NOT shipped to the dashboard repo. Per-ticker stats and per-regime aggregations are computed once at export time by `export_empirical_priors_layer()`, written to `regime-explorer.json`, and loaded as plain JSON by the browser.

This means: any new aggregation or slicing the UI wants to surface needs to be added to the exporter first (so it's present in the JSON), THEN exposed in the renderer. The dashboard never reads the parquet directly.

### 7. Click-to-detail uses inline render targets, not a global modal

Existing detail-modal component (`js/components/detail-modal.js`) is wired for ticker-symbol modals. Studies and rules don't fit that schema (no symbol, different data shape). To avoid forcing a polymorphic modal, study-detail and rule-lineage-detail render inline into a `<div id="prior-detail">` / `<div id="lineage-detail">` placed below their respective tables. Clicking another row replaces the previous detail. Simpler, less coupling, and detail panels are visible without scroll-into-modal friction.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Parent renames `empirical-priors.jsonl` schema | Exporter has explicit known-keys logic; schema changes need coordinated update of `_load_priors_latest()` and the JSON consumers. Versioning the JSON schema is a future enhancement; for now, strict compatibility is informally maintained. |
| Browser JSON loads slow as study count grows | At ~1KB per study, 1000 studies = 1MB. Plenty of headroom; no pagination needed for v1. Add lazy/pagination only if surface area grows past ~500 studies. |
| User clicks while regime data still loading | Empty-state messages in each render function ("Add a study under …" / "Rebuild trading-days.parquet …") cover the "data not yet exported" case gracefully. |
| Routing gotcha resurfaces (someone edits v1 page expecting SPA behavior) | Documented in dashboard `AGENTS.md`, parent `program.md` Purpose 3, the SKILL.md references file, and this design.md. Hard to miss. |
| Vision verification of dashboard sections is unreliable (vision mistakes tables for cards/filters) | Use `browser_console` DOM queries for definitive verification (`document.querySelectorAll('tr.prior-row').length`). Vision is supplementary. |

## Open Questions

1. **Should the dashboard expose study versions explicitly?** Currently the table shows `qqq-5pct-1d-since-1999 v3` but only the latest version is in the exported JSON. A "show all versions" toggle would expose the full history. Defer until a real use case (re-running a study and wanting to compare v1 vs v2 outcomes side-by-side in the UI).

2. **Should the Rule Lineage table also link to the parent repo's archived openspec change?** It's a doc-link and the dashboard is read-only anyway. Probably yes for traceability; defer to follow-up.

3. **Should pages other than `/#autoresearch` surface empirical-priors data?** E.g. could the watchlist detail modal show "studies touching SPY"? Possible but speculative. Wait for a request.
