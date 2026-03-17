# Spec: Watchlist Widget

## ADDED Requirements

### Requirement: TradingView Market Overview Embed
The watchlist page shall embed TradingView's Market Overview widget (`embed-widget-market-overview.js`) with tabbed symbol groups matching the BreakingTrades watchlist sections.

#### Scenario: Default tab display
WHEN the watchlist page loads
THEN the Market Overview widget renders with dark theme
AND the first tab (Quality Stocks) is selected by default
AND live prices, % change, and sparkline charts are visible for all symbols in the tab

#### Scenario: Tab navigation
WHEN the user clicks a tab (Quality Stocks, Sector ETFs, Macro, Community Ideas)
THEN the widget updates to show symbols in that group
AND each symbol shows: name, ticker, last price, absolute change, % change, sparkline

#### Scenario: Widget configuration
WHEN the widget initializes
THEN it uses dark color theme with transparent background
AND sparkline growing color is `#00d4aa` (cyan)
AND sparkline falling color is `#ff4757` (red)
AND symbol logos are shown
AND floating tooltip is enabled
AND chart date range is 12 months

### Requirement: Symbol Groups
The widget tabs shall contain the following groups:

#### Scenario: Quality Stocks tab
WHEN the Quality Stocks tab is selected
THEN it displays: AAPL, MSFT, NVDA, GOOGL, AMZN, META, DELL, COIN

#### Scenario: Sector ETFs tab
WHEN the Sector ETFs tab is selected
THEN it displays: XLU, XLK, XLE, XLV, XLF, XLP, XLY, SPY, QQQ, IWM, DIA, RSP

#### Scenario: Macro tab
WHEN the Macro tab is selected
THEN it displays: VIX, DXY, US10Y, US02Y, Oil (CL), Gold (GC), Copper (HG), BTC, ETH

#### Scenario: Community Ideas tab
WHEN the Community Ideas tab is selected
THEN it displays all community trade idea tickers from watchlist.json
