# Spec: Sector Heatmap

## ADDED Requirements

### Requirement: TradingView Stock Heatmap Embed
The market page shall embed TradingView's Stock Heatmap widget showing S&P 500 stocks grouped by sector.

#### Scenario: Default heatmap display
WHEN the market page loads
THEN the Stock Heatmap widget renders with dark theme
AND data source is S&P 500 (`SPY500`)
AND stocks are grouped by sector
AND block size represents market capitalization
AND block color represents daily % change (green = up, red = down)
AND the widget spans full page width at 500px height

#### Scenario: Interactive features
WHEN the user hovers over a stock block
THEN a tooltip shows: ticker, company name, % change, market cap
AND WHEN the user clicks a sector group header
THEN the heatmap zooms into that sector showing individual stocks

#### Scenario: Top bar controls
WHEN the widget renders with `hasTopBar: true`
THEN users can switch between: Performance (1D), Performance (1W), Performance (1M), Performance (YTD)
AND can toggle between sector grouping and no grouping
AND can switch data source (S&P 500, Nasdaq 100, Dow 30)

### Requirement: Dark Theme Integration
#### Scenario: Visual consistency
WHEN the heatmap renders
THEN it uses dark color theme matching the dashboard background
AND the widget background is transparent or matches `#0a0a12`
