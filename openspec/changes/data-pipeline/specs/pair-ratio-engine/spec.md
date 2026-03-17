## ADDED Requirements

### Requirement: Compute 12 pair ratios with trend classification
The system SHALL compute ratios for 12 pairs by dividing the numerator's close price by the denominator's close price, then classifying the trend as RISING, FALLING, or FLAT based on the SMA20 slope of the ratio series.

Pairs: XLY/XLP, HYG/SPY, IWF/IWD, RSP/SPY, XLV/SPY, IWM/SPY, IWM/QQQ, XLE/SPY, GLD/SPY, TLT/SPY, SLV/GLD, HYG/TLT.

#### Scenario: Rising ratio
- **WHEN** the SMA20 of XLY/XLP ratio has increased over the last 5 sessions
- **THEN** trend is `RISING` and signal is `🟢`

#### Scenario: Falling ratio
- **WHEN** the SMA20 of HYG/SPY ratio has decreased over the last 5 sessions
- **THEN** trend is `FALLING` and signal is `🔴`

#### Scenario: Flat ratio
- **WHEN** the SMA20 slope is within ±0.1% over 5 sessions
- **THEN** trend is `FLAT` and signal is `🟡`

### Requirement: Include ratio interpretation labels
The system SHALL include a human-readable interpretation label for each pair: XLY/XLP = "Consumer Strength", HYG/SPY = "Credit Risk", RSP/SPY = "Market Breadth", XLV/SPY = "Defensive Rotation", IWF/IWD = "Growth vs Value", IWM/SPY = "Small Cap Strength", XLE/SPY = "Energy Leadership", GLD/SPY = "Gold Relative", TLT/SPY = "Bond Demand", SLV/GLD = "Silver/Gold", HYG/TLT = "Risk Appetite", IWM/QQQ = "Small vs Large Tech".

#### Scenario: Output format
- **WHEN** pair ratios are exported
- **THEN** each ratio includes `{ pair, numerator, denominator, value, change_5d, trend, signal, label }`

### Requirement: Compute EMA 13/26 signals on ratio series
The system SHALL compute EMA 13 and EMA 26 on each ratio's daily series and flag bullish/bearish crossovers.

#### Scenario: Bullish crossover
- **WHEN** EMA13 of a ratio crosses above EMA26
- **THEN** `ema_signal` is `BULLISH_CROSS`

#### Scenario: Bearish crossover
- **WHEN** EMA13 of a ratio crosses below EMA26
- **THEN** `ema_signal` is `BEARISH_CROSS`

#### Scenario: No recent crossover
- **WHEN** EMA13 and EMA26 have not crossed in the last 5 sessions
- **THEN** `ema_signal` is `ABOVE` (if EMA13 > EMA26) or `BELOW`
