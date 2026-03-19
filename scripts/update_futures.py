#!/usr/bin/env python3
"""
Fetch pre-market / live futures & macro quotes via Yahoo Finance v8 chart API.
Writes data/futures.json for the dashboard futures strip.

Usage: python3 scripts/update_futures.py
"""
import json, urllib.request, os, sys
from datetime import datetime

SYMBOLS = [
    # Index Futures
    {"sym": "ES=F",     "label": "S&P 500",  "group": "indices"},
    {"sym": "NQ=F",     "label": "Nasdaq",   "group": "indices"},
    {"sym": "RTY=F",    "label": "Russell",  "group": "indices"},
    {"sym": "YM=F",     "label": "Dow",      "group": "indices"},
    # Commodities
    {"sym": "CL=F",     "label": "Crude",    "group": "commodities"},
    {"sym": "NG=F",     "label": "Nat Gas",  "group": "commodities"},
    {"sym": "GC=F",     "label": "Gold",     "group": "commodities"},
    {"sym": "SI=F",     "label": "Silver",   "group": "commodities"},
    {"sym": "HG=F",     "label": "Copper",   "group": "commodities"},
    # Rates & Dollar
    {"sym": "^TNX",     "label": "US10Y",    "group": "rates"},
    {"sym": "DX-Y.NYB", "label": "DXY",      "group": "rates"},
    # Volatility
    {"sym": "^VIX",     "label": "VIX",      "group": "volatility"},
    # Crypto
    {"sym": "BTC-USD",  "label": "BTC",      "group": "crypto"},
    {"sym": "ETH-USD",  "label": "ETH",      "group": "crypto"},
]

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

def fetch_one(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym, safe='')}?interval=1d&range=2d"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    result = data["chart"]["result"][0]
    meta = result["meta"]
    
    price = meta.get("regularMarketPrice", 0)
    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose", 0)
    
    change = price - prev_close if prev_close else 0
    change_pct = (change / prev_close * 100) if prev_close else 0
    
    return {
        "price": round(price, 2),
        "change": round(change, 2),
        "changePct": round(change_pct, 2),
        "prevClose": round(prev_close, 2),
    }

def main():
    results = []
    errors = []
    for s in SYMBOLS:
        try:
            q = fetch_one(s["sym"])
            results.append({
                "symbol": s["sym"],
                "label": s["label"],
                "group": s["group"],
                **q,
            })
        except Exception as e:
            errors.append(f"{s['sym']}: {e}")
    
    out = {"updated": datetime.now().isoformat(), "quotes": results}
    out_path = os.path.join(OUT_DIR, "futures.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    
    print(f"✓ {len(results)}/{len(SYMBOLS)} quotes → {out_path}")
    for e in errors:
        print(f"  ⚠ {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
