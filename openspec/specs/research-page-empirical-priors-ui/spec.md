# research-page-empirical-priors-ui Specification

## Purpose
TBD - created by archiving change autoresearch-empirical-priors-ui. Update Purpose after archive.
## Requirements
### Requirement: Dashboard exporter emits 3 empirical-priors JSON files
The dashboard pipeline (`scripts/export-dashboard-data.py`) MUST run an `export_empirical_priors_layer()` step that reads the parent repo's `data/empirical-priors.jsonl` + `data/trading-days.parquet` + `agents/tom-fxevolution/RULES.json` and emits three JSON files under the dashboard's `data/` directory: `empirical-priors.json`, `regime-explorer.json`, and `rule-lineage.json`. The step MUST be best-effort and non-fatal (a missing parent file MUST NOT abort the rest of the pipeline).

#### Scenario: parent repo files all present
- **WHEN** `python3 scripts/export-dashboard-data.py` runs after the parent repo's empirical-priors layer has produced its data files
- **THEN** the dashboard pipeline MUST emit `data/empirical-priors.json`, `data/regime-explorer.json`, and `data/rule-lineage.json`, each with a `generated_at` ISO timestamp at the top level

#### Scenario: parent's trading-days.parquet missing
- **WHEN** `data/trading-days.parquet` is absent from the parent repo (e.g. before first build, or gitignored on a fresh clone)
- **THEN** the exporter MUST log a warning, skip per-regime per-ticker stat computation, write `regime-explorer.json` with empty regime data, and continue with `empirical-priors.json` and `rule-lineage.json` emission

### Requirement: empirical-priors.json contains latest-version-per-study
`data/empirical-priors.json` MUST contain at most one entry per `study_id`. When the parent repo's append-only `empirical-priors.jsonl` has multiple versions of a study (v1, v2, v3, ...), the exported file MUST include only the highest-version entry per study_id.

#### Scenario: study has been re-run
- **WHEN** the parent repo's `empirical-priors.jsonl` contains both v1 and v2 entries for `study_id="qqq-5pct-1d-since-1999"`
- **THEN** the dashboard's `empirical-priors.json` MUST include the v2 entry only; v1 MUST be excluded from the export

### Requirement: regime-explorer.json includes per-ticker stats per regime
`data/regime-explorer.json` MUST contain, for each labeled regime in `regime-labels.json` plus the `unknown` bucket, a structured entry with `n_days`, `date_range` (start + end ISO dates), `per_ticker` (mapping ticker → `{n_days, cum_return, mean_return_1d}`), and `studies_touching` (array of `{study_id, title, n, horizon_hit_rate}`).

#### Scenario: regime has labeled date range
- **WHEN** the regime `bull_summer25` is defined with `start: "2025-06-15", end: "2025-09-15"`
- **THEN** the exported entry MUST report `date_range: ["2025-06-15", "2025-09-15"]` (or the actual min/max trading-day date within the labeled window) plus `n_days` reflecting the number of trading days in that window

#### Scenario: regime is unknown / unlabeled
- **WHEN** the parquet contains rows where `regime_label = "unknown"`
- **THEN** the `unknown` bucket MUST be included in regime-explorer.json with its own date range and per-ticker stats; it MUST NOT be silently dropped

### Requirement: rule-lineage.json includes only rules with evidence
`data/rule-lineage.json` MUST contain only rules whose entry in `RULES.json` has a non-empty `evidence` field. Each included rule entry MUST carry the rule's full `id`, `category`, `priority`, `rule` (statement text), `source`, and `evidence` array.

#### Scenario: rule has no evidence
- **WHEN** a rule in `RULES.json` lacks an `evidence` field (legacy rules pre-dating the empirical-priors layer)
- **THEN** the rule MUST NOT appear in `rule-lineage.json` and MUST NOT cause an export error

#### Scenario: rule has evidence array
- **WHEN** a rule has `evidence: [{...}, {...}]` (curated via `rule-evidence-map.json` and applied by parent's `link_rules_to_studies.py`)
- **THEN** the rule MUST appear in `rule-lineage.json` under its `id` key with the full evidence array preserved

### Requirement: SPA route `/#autoresearch` renders 3 new sections
The dashboard's SPA at `index.html` MUST route the `#autoresearch` (alias for `#airesearcher`) hash to `js/pages/autoresearch.js`, which MUST render three new sections in addition to the existing 8+ regime-monitoring sections: **Empirical Priors**, **Regime Explorer**, and **Rule Lineage**. Each section MUST be collapsible and registered with the `BT.components.collapsible` system.

#### Scenario: user navigates to autoresearch page
- **WHEN** the user opens `http://localhost:8888/#autoresearch` (or `#airesearcher`) and the dashboard data has been freshly exported
- **THEN** the page MUST display section titles "Empirical Priors", "Regime Explorer", and "Rule Lineage" as collapsible sections, each with a Lucide icon and subtitle

#### Scenario: legacy v1 page does not render new sections
- **WHEN** the user opens `/v1/autoresearch.html` (the standalone legacy page)
- **THEN** the page MUST NOT render the empirical-priors sections (the v1 page does not load `js/pages/autoresearch.js` at all); the user MUST be directed to the SPA route via documentation

### Requirement: Empirical Priors section renders study table
The Empirical Priors section MUST render a sortable table with columns: `Study` (study_id + version badge), `Ticker`, `Condition`, `N`, `1Y Hit Rate`, `1Y Mean`, `Rules` (rule_refs joined). Each row MUST be clickable and MUST open a detail panel below the table when clicked.

#### Scenario: user clicks a study row
- **WHEN** the user clicks the row for `qqq-5pct-1d-since-1999`
- **THEN** a detail panel MUST appear below the table showing: study title, version, n, population description, a forward-return table with rows for each horizon (1d/5d/20d/60d/252d) showing `n / hit_rate_pos / mean / median / p25 / p75`, a regime breakdown table with rows per regime, optional notes, and the linked rule_refs

#### Scenario: empty state when no studies exist
- **WHEN** `data/empirical-priors.json` has zero studies
- **THEN** the section MUST render a friendly empty-state message: "No studies yet. Add a study under `autoresearch/studies/` and run `python autoresearch/run_study.py <path>`"

### Requirement: Regime Explorer renders per-regime cards
The Regime Explorer section MUST render a grid of per-regime cards (one card per labeled regime + an Unknown/Unlabeled card). Each card MUST show the regime name, n_days, date range, a per-ticker table with `Ticker / N / Cum Return %` rows, and a list of studies touching that regime.

#### Scenario: unknown regime is sorted last
- **WHEN** the regimes include both labeled regimes and the `unknown` bucket
- **THEN** the cards MUST be sorted alphabetically by regime name with the `unknown` card placed last regardless of alphabetical position

#### Scenario: regime has no studies touching it
- **WHEN** a regime has zero studies that include it in their `regime_breakdown`
- **THEN** the card's "Studies touching" section MUST display "No studies touch this regime yet" rather than an empty list

### Requirement: Rule Lineage renders evidence chains
The Rule Lineage section MUST render a sortable table of rules-with-evidence with columns: `Rule` (rule_id), `Category`, `Statement` (truncated to ~220 chars), `Evidence` (badge counts per evidence type). Each row MUST be clickable and MUST open a detail panel showing the full rule statement and a color-coded evidence chain.

#### Scenario: user clicks a rule with mixed evidence types
- **WHEN** the user clicks the row for a rule with 2 study evidence entries (1 primary, 1 contradictory) and 1 live observation
- **THEN** the detail panel MUST display the full rule statement above an evidence chain. Study evidence cards MUST have a cyan left border with the study_id, weight (color-coded: primary green, contradictory red, supporting muted), and horizon. Live observation cards MUST have an orange left border with the date and context text.

#### Scenario: empty state when no rules have evidence
- **WHEN** `data/rule-lineage.json` has zero rules with evidence
- **THEN** the section MUST render a friendly empty-state message directing the user to curate `autoresearch/rule-evidence-map.json` and run `python autoresearch/link_rules_to_studies.py`

### Requirement: Sections render outside regimeData guard
The 3 empirical-priors render functions (`renderEmpiricalPriors`, `renderRegimeExplorer`, `renderRuleLineage`) MUST be called from `init()` BEFORE the `if (!regimeData) renderNoData(); return;` guard. When `data/regime.json` is missing or empty, the empirical-priors sections MUST still render their content; only the regime-specific sections (hero, components, playbook, internals, commodity chain, transition, cycle, history) MUST be replaced by the no-data hero.

#### Scenario: regime.json is missing but empirical-priors data is fresh
- **WHEN** `data/regime.json` returns 404 or empty but `data/empirical-priors.json` etc. are populated
- **THEN** the page MUST display the no-data hero for the regime sections AND fully-populated Empirical Priors / Regime Explorer / Rule Lineage sections; the new sections MUST be wired with collapsible click-to-expand behavior via the fallback collapsibles registration in the no-data branch

### Requirement: Dashboard remains read-only
The empirical-priors UI MUST NOT permit study creation, study mutation, or rule-evidence editing through the browser. All authoring MUST happen via parent-repo Python tooling (`run_study.py`, `link_rules_to_studies.py`).

#### Scenario: user looks for in-UI study creation
- **WHEN** the user looks for an "Add Study" button or form on the autoresearch page
- **THEN** the page MUST NOT provide one; empty-state messages MUST direct the user to the parent-repo CLI workflow

