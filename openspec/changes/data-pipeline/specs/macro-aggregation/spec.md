## ADDED Requirements

### Requirement: Aggregate macro indicator values
The system SHALL pull current values for 8 macro indicators: VIX, Oil (CL=F or USOIL), DXY, Copper (HG=F), BTC-USD, Gold (GC=F), US10Y (^TNX), US02Y. Source: existing CSVs in `data/` or yfinance API fallback.

#### Scenario: All CSVs available
- **WHEN** `vix_daily.csv`, `dxy_daily.csv`, etc. exist with recent data (< 3 trading days old)
- **THEN** the system reads the last close from each CSV

#### Scenario: Stale or missing CSV
- **WHEN** a macro CSV is missing or last row is > 3 trading days old
- **THEN** the system fetches the latest value from yfinance and logs a warning about staleness

### Requirement: Classify macro indicator direction
The system SHALL classify each indicator's short-term direction (UP/DOWN/FLAT) based on 5-day change and add a signal emoji (🟢/🔴/🟡).

#### Scenario: VIX rising
- **WHEN** VIX 5-day change is > +5%
- **THEN** direction is `UP`, signal is `🔴` (VIX up = risk-off, red for equities)

#### Scenario: DXY falling
- **WHEN** DXY 5-day change is < -0.5%
- **THEN** direction is `DOWN`, signal is `🟢` (weak dollar = bullish risk assets)

### Requirement: Output macro JSON with consistent schema
The system SHALL output `data/macro.json` with schema: `{ indicators: [{ symbol, name, value, change_5d, change_pct_5d, direction, signal, updated }], market_status: "OPEN"|"CLOSED"|"PRE"|"POST" }`.

#### Scenario: Weekend run
- **WHEN** pipeline runs on Saturday
- **THEN** `market_status` is `CLOSED` and values reflect Friday's close
