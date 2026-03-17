## ADDED Requirements

### Requirement: CLI entry point orchestrates all pipeline stages
The system SHALL provide a single CLI script (`scripts/export-dashboard-data.py`) that runs: (1) signal computation, (2) trade lifecycle classification, (3) pair ratio computation, (4) macro aggregation, (5) Tom analysis generation, (6) JSON output to `data/` directory.

#### Scenario: Full pipeline run
- **WHEN** `python3 scripts/export-dashboard-data.py --data-dir ~/projects/breakingtrades/data --output-dir data/` is executed
- **THEN** all 6 stages run in sequence and output JSON files: `data/watchlist.json`, `data/setups.json`, `data/macro.json`, `data/pairs.json`, `data/tom/briefing.json`, `data/tom/takes/*.json`

#### Scenario: Skip Tom analysis
- **WHEN** `--skip-tom` flag is provided
- **THEN** stages 1-4 run but LLM calls are skipped; existing Tom JSON files are preserved

#### Scenario: Single ticker mode
- **WHEN** `--ticker AAPL` flag is provided
- **THEN** only AAPL is processed (useful for testing)

### Requirement: Auto-commit and push to GitHub
The system SHALL optionally commit changed JSON files and push to the `main` branch when `--push` flag is provided.

#### Scenario: Push after pipeline
- **WHEN** `--push` flag is set and JSON files have changed
- **THEN** the system runs `git add data/ && git commit -m "data: refresh [timestamp]" && git push origin main`

#### Scenario: No changes
- **WHEN** `--push` flag is set but no JSON files changed (identical output)
- **THEN** the system skips commit and logs "No data changes"

### Requirement: Structured logging with summary
The system SHALL log each stage's progress and output a final summary with: symbols processed, symbols skipped (with reasons), retests found, exit signals found, pipeline duration.

#### Scenario: Pipeline summary
- **WHEN** pipeline completes successfully
- **THEN** stdout shows: `Pipeline complete: 68/70 symbols processed, 2 skipped (no CSV), 5 RETEST, 3 EXIT_SIGNAL, 2m 34s`

### Requirement: Cron-compatible execution
The system SHALL run cleanly from cron/launchd without interactive prompts, using environment variables for API keys (`AZURE_OPENAI_KEY` or `ANTHROPIC_API_KEY`) and explicit path arguments.

#### Scenario: Cron execution
- **WHEN** launched from crontab `35 13 * * 1-5 /path/to/python3 /path/to/export-dashboard-data.py --push`
- **THEN** the system runs without prompts, uses env vars for auth, and exits 0 on success or 1 on failure
