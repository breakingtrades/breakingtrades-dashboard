# Spec: Fear & Greed Gauge

## ADDED Requirements

### Requirement: Fear & Greed Index Display
The market page shall display the CNN Fear & Greed Index as a visual gauge with current value and historical comparison.

#### Scenario: Gauge rendering
WHEN `data/fear-greed.json` is loaded
THEN a semicircle gauge renders with a needle pointing to the current value (0-100)
AND the gauge arc is color-segmented: dark red (0-25), orange (25-45), yellow (45-55), light green (55-75), bright green (75-100)
AND the current value is displayed as a large number below the gauge
AND the classification text is shown (e.g., "Extreme Fear", "Neutral", "Greed")

#### Scenario: Historical comparison
WHEN the gauge renders
THEN it shows comparison values below:
- Previous close: value + direction arrow (↑/↓)
- 1 week ago: value + direction arrow
- 1 month ago: value + direction arrow
AND each comparison is color-coded by its classification

#### Scenario: Data staleness indicator
WHEN `data/fear-greed.json` was last updated more than 24 hours ago
THEN a subtle "Data may be stale" indicator appears
AND the update timestamp is shown in the user's selected timezone

### Requirement: Pipeline Integration
The data pipeline shall generate `data/fear-greed.json` on each run.

#### Scenario: Fear & Greed data generation
WHEN the pipeline runs (`scripts/export-dashboard-data.py`)
THEN it fetches the CNN Fear & Greed Index via the `fear-greed-index` Python package
AND writes `data/fear-greed.json` with: current value/description, previous_close, one_week_ago, one_month_ago, updated timestamp (UTC ISO-8601)
AND handles API failures gracefully (keeps previous JSON, logs warning)

### Requirement: No Client-Side API Calls
#### Scenario: Static data only
WHEN the market page loads
THEN Fear & Greed data is read from the static JSON file only
AND no client-side HTTP requests are made to CNN or any external API
AND CORS and API key issues are avoided entirely
