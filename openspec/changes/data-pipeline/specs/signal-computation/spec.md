## ADDED Requirements

### Requirement: Compute SMA values for all watchlist symbols
The system SHALL compute Simple Moving Averages (SMA 20, 50, 100, 200) from daily and weekly OHLCV CSV data for all symbols in the watchlist (currently 70 symbols).

#### Scenario: Daily SMA computation
- **WHEN** the pipeline runs with a valid CSV at `data/{ticker}_daily.csv` containing at least 200 rows
- **THEN** the system computes SMA20, SMA50, SMA100, SMA200 using the Close column and includes them in the output JSON

#### Scenario: Weekly SMA computation
- **WHEN** the pipeline runs with a valid CSV at `data/{ticker}_weekly.csv`
- **THEN** the system computes Weekly SMA20, SMA50, SMA100, SMA200 and includes them in the output JSON

#### Scenario: Insufficient data
- **WHEN** a CSV has fewer rows than the longest SMA period requested
- **THEN** the system computes available SMAs (e.g., SMA20 if 20+ rows) and sets unavailable SMAs to `null`

### Requirement: Compute RSI-14 using Wilder's smoothing
The system SHALL compute RSI with period 14 using Wilder's smoothing method (exponential moving average of gains/losses, not simple average).

#### Scenario: Standard RSI calculation
- **WHEN** daily CSV has 15+ rows of close prices
- **THEN** RSI is computed using Wilder's method and rounded to 1 decimal place

#### Scenario: All gains or all losses
- **WHEN** the last 14 periods are all gains
- **THEN** RSI outputs 100.0 (not division by zero)

### Requirement: Classify bias as BULL, BEAR, or MIXED
The system SHALL classify each ticker's bias based on SMA alignment: BULL = price > SMA20 > SMA50 AND price > Weekly SMA20; BEAR = price < SMA20 < SMA50 AND price < Weekly SMA20; all other configurations = MIXED.

#### Scenario: Bullish stack
- **WHEN** price is $100, SMA20 is $98, SMA50 is $95, Weekly SMA20 is $96
- **THEN** bias is classified as `BULL`

#### Scenario: Bearish stack
- **WHEN** price is $90, SMA20 is $95, SMA50 is $98, Weekly SMA20 is $97
- **THEN** bias is classified as `BEAR`

#### Scenario: Mixed signals
- **WHEN** price is above SMA20 but below SMA50
- **THEN** bias is classified as `MIXED`

### Requirement: Compute percentage from 6-month high
The system SHALL compute how far the current price is from the 6-month (126 trading days) high as a negative percentage.

#### Scenario: At 6-month high
- **WHEN** current price equals the 6-month high
- **THEN** `pct_from_6mo_high` is `0.0`

#### Scenario: Below 6-month high
- **WHEN** current price is $90 and 6-month high is $100
- **THEN** `pct_from_6mo_high` is `-10.0`

### Requirement: Handle malformed CSV data gracefully
The system SHALL skip rows with parsing errors and log warnings rather than crashing the pipeline.

#### Scenario: CSV with extra fields
- **WHEN** a CSV row has more fields than the header (e.g., `oih_daily.csv` line 2688 with 8 fields vs expected 6)
- **THEN** the system skips the malformed row using `on_bad_lines='skip'` and logs a warning

#### Scenario: Missing ticker CSV
- **WHEN** no CSV exists for a watchlist symbol
- **THEN** the system logs a warning and excludes that symbol from output (does not crash)
