#!/usr/bin/env python3
"""
update-prices.py — Single source of truth for current ticker prices.

Fetches latest closing prices for ALL dashboard tickers from yfinance.
Writes data/prices.json — consumed by every dashboard page as the canonical price.

Usage:
  python3 scripts/update-prices.py           # update all tickers
  python3 scripts/update-prices.py --status  # show staleness report

Output: data/prices.json
{
  "updated": "2026-03-27T20:30:00+00:00",
  "source": "yfinance",
  "tickers": {
    "SPY": { "price": 651.50, "change": -0.81, "updated": "2026-03-27T20:30:00+00:00" },
    ...
  }
}

Every page should fetch prices.json on load and use it as THE price.
Other data files (expected-moves.json, watchlist.json) keep their calc-time
snapshots for reference, but the display price comes from prices.json.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
OUT_FILE = DATA_DIR / "prices.json"
WATCHLIST_FILE = DATA_DIR / "watchlist.json"
EM_FILE = DATA_DIR / "expected-moves.json"


def get_all_tickers():
    """Collect every ticker referenced across dashboard data files."""
    tickers = set()

    # From watchlist.json
    if WATCHLIST_FILE.exists():
        try:
            wl = json.loads(WATCHLIST_FILE.read_text())
            for item in wl:
                if item.get("symbol"):
                    tickers.add(item["symbol"])
        except Exception:
            pass

    # From expected-moves.json
    if EM_FILE.exists():
        try:
            em = json.loads(EM_FILE.read_text())
            for sym in em.get("tickers", {}):
                tickers.add(sym)
        except Exception:
            pass

    # Hardcoded essentials (in case files are empty)
    essentials = [
        "SPY", "QQQ", "DIA", "IWM", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN",
        "META", "TSLA", "AVGO", "LLY", "IBIT", "GLD", "USO", "UNG", "TLT",
        "HYG", "LQD", "XLE", "XLF", "XLK", "XLV", "XLP", "XLU", "XLY",
        "XLI", "XLC", "XLRE", "XLB",
    ]
    # Regime internals — Tier 1 (free via yfinance)
    regime_tickers = [
        "^MOVE",    # MOVE Index (VIX of bonds) — THE bottoming signal (R053, R057, R072)
        "^VIX",     # VIX (already tracked via vix.json but also in prices for regime scoring)
        "IWF",      # iShares Russell 1000 Growth — Growth vs Value pair (IWF/IWD)
        "IWD",      # iShares Russell 1000 Value
        "RSP",      # Equal Weight S&P 500 — breadth signal (RSP/SPY)
        "DX-Y.NYB", # DXY Dollar Index — risk-off indicator
        "CPER",     # Copper ETF — "Dr. Copper" health (R044)
        "SLV",      # Silver ETF — precious metals chain
        "SMH",      # Semiconductor ETF — tech health, 0.55 vs SPX key level
        "^GSPC",    # S&P 500 index (for regime scoring vs MAs)
        "^DJT",     # Dow Transports — "horrid" per Tom, recession signal
        "ADM",      # Archer-Daniels-Midland — agriculture (late-cycle canary)
        "MOS",      # Mosaic — agriculture/fertilizer (inflation canary)
        "^GDAXI",   # DAX — "lead indicator", Wyckoff distribution (R073)
        "^KS11",    # KOSPI — "175% AI bubble" (R073)
        "^HSI",     # Hang Seng — risk-on tell (R073)
        "^AXJO",    # ASX 200 (Australia) — commodity economy proxy (R073)
        "FXI",      # China ETF — 25,800 key level
    ]
    for s in essentials + regime_tickers:
        tickers.add(s)

    return sorted(tickers)


def show_status():
    """Print staleness report."""
    if not OUT_FILE.exists():
        print("❌ prices.json does not exist yet. Run without --status to create it.")
        return

    data = json.loads(OUT_FILE.read_text())
    updated = data.get("updated", "unknown")
    source = data.get("source", "unknown")
    tickers = data.get("tickers", {})

    print(f"prices.json — {len(tickers)} tickers, source: {source}")
    print(f"Last updated: {updated}")

    # Check staleness
    try:
        ts = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
        if age_hours > 24:
            print(f"⚠️  STALE — {age_hours:.1f}h old")
        else:
            print(f"✅ Fresh — {age_hours:.1f}h old")
    except Exception:
        print("⚠️  Could not parse timestamp")

    # Sample prices
    for sym in ["SPY", "QQQ", "NVDA", "AAPL", "TSLA"]:
        t = tickers.get(sym)
        if t:
            print(f"  {sym}: ${t['price']:.2f} ({t['change']:+.2f}%)")


def update_prices():
    """Fetch latest prices from yfinance and write prices.json."""
    import yfinance as yf

    tickers = get_all_tickers()
    print(f"Fetching prices for {len(tickers)} tickers...")

    # yfinance symbol mapping
    yf_map = {}
    for sym in tickers:
        if sym == "BRK.B":
            yf_map[sym] = "BRK-B"
        else:
            yf_map[sym] = sym

    yf_symbols = list(set(yf_map.values()))

    # Download 5 days to get previous close for change %
    data = yf.download(yf_symbols, period="5d", interval="1d",
                       group_by="ticker", progress=False, threads=True, auto_adjust=True)

    now = datetime.now(timezone.utc).isoformat()
    result = {}
    errors = 0

    for sym in tickers:
        yf_sym = yf_map[sym]
        try:
            if len(yf_symbols) == 1:
                df = data
            else:
                df = data[yf_sym]

            close = df["Close"].dropna()
            if close.empty:
                continue

            price = round(float(close.iloc[-1]), 2)
            change = 0.0
            if len(close) >= 2:
                prev = float(close.iloc[-2])
                if prev > 0:
                    change = round((price - prev) / prev * 100, 2)

            result[sym] = {
                "price": price,
                "change": change,
                "updated": now,
            }
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  ⚠️ {sym}: {e}")

    output = {
        "updated": now,
        "source": "yfinance",
        "tickers": result,
    }

    OUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"✅ Wrote {len(result)} tickers to prices.json ({errors} errors)")


def main():
    if "--status" in sys.argv:
        show_status()
    else:
        update_prices()


if __name__ == "__main__":
    main()
