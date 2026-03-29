#!/usr/bin/env python3
"""
update-breadth.py — Market Breadth data pipeline

Computes % of stocks above key SMAs for S&P 500 sectors and major indices.
Since TradingView breadth symbols (S5TW, NDTW, etc.) aren't available on yfinance,
we compute breadth directly from constituent stock data.

Approach:
  - S&P 500 constituents fetched from a hardcoded list (updated periodically)
  - For each stock: fetch 200-day history, compute SMA 20/50/100/200
  - Group by GICS sector → % above 20-day SMA
  - For indices (SPX, NDX, DJI, RUT, VTI): use constituent subsets

Output: data/breadth.json
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

REPO = Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "data"

# ── S&P 500 Sector ETF constituents approach ──
# Instead of fetching 500+ individual stocks (slow, rate-limited),
# we use sector SPDR ETFs to approximate sector health,
# and compute breadth from the top holdings of each sector.

# Sector codes matching the task spec
SECTORS = {
    "COM": {"name": "Communication Services", "etf": "XLC"},
    "CND": {"name": "Consumer Discretionary", "etf": "XLY"},
    "CNS": {"name": "Consumer Staples", "etf": "XLP"},
    "ENE": {"name": "Energy", "etf": "XLE"},
    "FIN": {"name": "Financials", "etf": "XLF"},
    "HLC": {"name": "Health Care", "etf": "XLV"},
    "IND": {"name": "Industrials", "etf": "XLI"},
    "MAT": {"name": "Materials", "etf": "XLB"},
    "RLE": {"name": "Real Estate", "etf": "XLRE"},
    "TEC": {"name": "Technology", "etf": "XLK"},
    "UTL": {"name": "Utilities", "etf": "XLU"},
}

# Representative stocks per sector (top ~15-25 by weight)
SECTOR_STOCKS = {
    "COM": ["META", "GOOGL", "GOOG", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "EA", "TTWO", "CHTR", "OMC", "IPG", "LYV", "MTCH", "PARA", "WBD", "FOX", "FOXA"],
    "CND": ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG", "ORLY", "AZO", "CMG", "MAR", "HLT", "DHI", "LEN", "GM", "F", "ROST", "EBAY"],
    "CNS": ["PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "MDLZ", "GIS", "KMB", "SYY", "HSY", "KHC", "STZ", "CAG", "TSN", "HRL", "CPB", "MKC"],
    "ENE": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB", "KMI", "HAL", "BKR", "DVN", "FANG", "HES", "CTRA", "MRO", "APA", "OKE"],
    "FIN": ["BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "C", "AXP", "SCHW", "BLK", "SPGI", "CME", "ICE", "MMC", "AON", "PGR", "TRV", "AIG"],
    "HLC": ["UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY", "AMGN", "MDT", "ELV", "CI", "ISRG", "SYK", "GILD", "VRTX", "REGN", "ZTS"],
    "IND": ["RTX", "HON", "UNP", "UPS", "BA", "CAT", "DE", "LMT", "GE", "GD", "MMM", "ITW", "EMR", "ETN", "FDX", "CSX", "NSC", "WM", "RSG", "CTAS"],
    "MAT": ["LIN", "APD", "SHW", "ECL", "FCX", "NUE", "NEM", "DOW", "DD", "VMC", "MLM", "PPG", "IFF", "ALB", "CE", "CF", "MOS", "FMC", "PKG", "IP"],
    "RLE": ["PLD", "AMT", "CCI", "EQIX", "PSA", "DLR", "O", "WELL", "SPG", "VICI", "AVB", "EQR", "ARE", "MAA", "UDR", "ESS", "VTR", "PEAK", "KIM", "REG"],
    "TEC": ["AAPL", "MSFT", "NVDA", "AVGO", "CRM", "ADBE", "AMD", "CSCO", "ACN", "INTC", "ORCL", "TXN", "QCOM", "IBM", "INTU", "NOW", "AMAT", "MU", "LRCX", "KLAC"],
    "UTL": ["NEE", "SO", "DUK", "D", "SRE", "AEP", "EXC", "XEL", "ED", "WEC", "ES", "PEG", "AWK", "DTE", "EIX", "FE", "PPL", "ATO", "CMS", "CNP"],
}

# Index constituents (approximated by representative ETF holdings)
INDEX_STOCKS = {
    "SPX": None,  # All stocks combined (from all sectors above)
    "NDX": ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "AVGO", "TSLA", "NFLX",
            "COST", "AMD", "ADBE", "CRM", "QCOM", "INTC", "CSCO", "TXN", "INTU", "CMCSA",
            "AMGN", "PEP", "HON", "AMAT", "BKNG", "ISRG", "LRCX", "MU", "KLAC", "ADP",
            "REGN", "GILD", "SBUX", "MDLZ", "PANW", "MELI", "SNPS", "CDNS", "MAR", "ORLY",
            "PYPL", "ABNB", "NXPI", "MCHP", "KDP", "FTNT", "ROST", "DASH", "MNST", "DXCM"],
    "DJI": ["AAPL", "MSFT", "UNH", "GS", "HD", "MCD", "AMGN", "V", "CAT", "BA",
            "HON", "CRM", "TRV", "JPM", "AXP", "IBM", "JNJ", "PG", "WMT", "CVX",
            "MRK", "DIS", "NKE", "MMM", "KO", "CSCO", "INTC", "VZ", "WBA", "DOW"],
    "RUT": None,  # Use all sector stocks as proxy (small-cap tilt)
    "VTI": None,  # Use all sector stocks as proxy (total market)
}

SMA_PERIODS = [20, 50, 100, 200]


def fetch_all_history(symbols, period="1y"):
    """Fetch history for all symbols at once using yfinance batch download."""
    print(f"  Fetching {len(symbols)} symbols...")
    try:
        data = yf.download(symbols, period=period, progress=False, threads=True)
        if data.empty:
            return {}
        # Handle multi-level columns from batch download
        close = data["Close"] if "Close" in data.columns.get_level_values(0) else data.get("Close", data)
        if isinstance(close, dict) or (hasattr(close, 'columns') and len(close.columns) > 1):
            return {sym: close[sym].dropna() for sym in symbols if sym in close.columns}
        else:
            # Single symbol case
            return {symbols[0]: close.dropna()}
    except Exception as e:
        print(f"  ⚠️ Batch download failed: {e}")
        return {}


def compute_breadth(history_map, symbols, sma_period):
    """Compute % of symbols above their SMA for a given period."""
    above = 0
    total = 0
    for sym in symbols:
        series = history_map.get(sym)
        if series is None or len(series) < sma_period:
            continue
        sma = series.rolling(window=sma_period).mean()
        if len(sma) == 0 or sma.isna().all():
            continue
        last_close = series.iloc[-1]
        last_sma = sma.iloc[-1]
        if not (last_close != last_close or last_sma != last_sma):  # NaN check
            total += 1
            if last_close > last_sma:
                above += 1
    if total == 0:
        return None
    return round((above / total) * 100, 1)


def main():
    print("=== Market Breadth Update ===")

    # Collect all unique symbols
    all_symbols = set()
    for stocks in SECTOR_STOCKS.values():
        all_symbols.update(stocks)
    for key, stocks in INDEX_STOCKS.items():
        if stocks:
            all_symbols.update(stocks)

    all_symbols = sorted(all_symbols)
    print(f"Total unique symbols: {len(all_symbols)}")

    # Batch fetch all history
    history = fetch_all_history(all_symbols, period="1y")
    print(f"Got history for {len(history)} symbols")

    if len(history) < 50:
        print("⚠️ Too few symbols returned — data may be unreliable")

    # Compute sector breadth (% above 20-day SMA)
    sectors = {}
    for code, info in SECTORS.items():
        stocks = SECTOR_STOCKS[code]
        val = compute_breadth(history, stocks, 20)
        sectors[code] = {
            "name": info["name"],
            "above_20d": val if val is not None else 0.0,
        }
        status = f"{val}%" if val is not None else "N/A"
        print(f"  {code} ({info['name']}): {status}")

    # Compute index breadth (multi-timeframe)
    all_sector_stocks = []
    for stocks in SECTOR_STOCKS.values():
        all_sector_stocks.extend(stocks)

    indices = {}
    for idx_code, idx_stocks in [
        ("SPX", all_sector_stocks),
        ("NDX", INDEX_STOCKS["NDX"]),
        ("DJI", INDEX_STOCKS["DJI"]),
        ("RUT", all_sector_stocks),
        ("VTI", all_sector_stocks),
    ]:
        idx_data = {}
        stocks = idx_stocks or all_sector_stocks
        for period in SMA_PERIODS:
            val = compute_breadth(history, stocks, period)
            idx_data[f"{period}d"] = val if val is not None else 0.0
        indices[idx_code] = idx_data
        print(f"  {idx_code}: {idx_data}")

    # Compute total stacked + average
    sector_values = [s["above_20d"] for s in sectors.values()]
    stacked = round(sum(sector_values), 1)
    average = round(stacked / len(sector_values), 1) if sector_values else 0

    result = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "sectors": sectors,
        "indices": indices,
        "total": {
            "stacked": stacked,
            "average": average,
        },
    }

    out_path = DATA_DIR / "breadth.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n✅ Written to {out_path}")
    print(f"   Stacked total: {stacked}/1100 | Average: {average}%")

    return 0


if __name__ == "__main__":
    sys.exit(main())
