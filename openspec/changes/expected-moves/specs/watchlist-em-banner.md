# Watchlist EM Banner

## Overview
Shows expected move bands in the watchlist detail modal when EM data exists for the ticker.

## Requirements
- MUST load EM data async on page init
- MUST show banner above charts in `openDetail()` modal when ticker has EM data
- MUST NOT show banner for tickers without EM data
- MUST display visual band with H (cyan), M (gray), L (red) lines
- MUST show current price marker (gold) on the visual band
- MUST display Daily/Weekly/Monthly/Quarterly tier cards
- MUST highlight Weekly tier with active border
- MUST show ABOVE/BELOW label when price is outside weekly band
- MUST show metadata: straddle price, expiry, strike, futures proxy
- MUST auto-open detail when `?ticker=` URL param is present
