#!/usr/bin/env python3
"""
export-yfinance-fallback.py — Fetch dashboard data from Yahoo Finance when Mac hasn't pushed fresh data.

Checks freshness of each data file. If stale (>24h or missing), fetches from yfinance.
Produces the same JSON schemas as the IB-based export scripts.

Usage:
  python scripts/export-yfinance-fallback.py           # check freshness, fetch if stale
  python scripts/export-yfinance-fallback.py --force    # force refresh all
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

DASHBOARD_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = DASHBOARD_DIR / "data"

FRESHNESS_HOURS = 20  # consider data stale after this many hours

# --- Watchlist tickers (read from existing watchlist.json for metadata) ---
SECTOR_ETFS = ["XLE", "XLB", "XLI", "XLY", "XLP", "XLV", "XLF", "XLK", "XLC", "XLU", "XLRE"]
BENCHMARK = "SPY"

# Pair definitions
PAIRS = [
    {"pair": "XLY/XLP", "desc": "Consumer weakening — risk-off rotation"},
    {"pair": "HYG/SPY", "desc": "Credit vs Equity — risk appetite"},
    {"pair": "RSP/SPY", "desc": "Breadth — equal vs cap weight"},
    {"pair": "XLV/SPY", "desc": "Defensive rotation"},
    {"pair": "IWM/SPY", "desc": "Small caps vs Large caps"},
    {"pair": "IWM/QQQ", "desc": "Value vs Growth"},
    {"pair": "XLE/SPY", "desc": "Energy outperformance"},
    {"pair": "GLD/SPY", "desc": "Safe haven demand"},
    {"pair": "TLT/SPY", "desc": "Flight to bonds"},
    {"pair": "SLV/GLD", "desc": "Industrial vs safe haven"},
    {"pair": "HYG/TLT", "desc": "Credit vs treasuries"},
    {"pair": "IGV/QQQ", "desc": "Software vs Broad Tech"},
]

# VIX regime thresholds
VIX_REGIMES = [
    (30, "Crisis", "#f44336", "Extreme fear. Capital preservation mode."),
    (25, "High", "#ff5722", "Elevated risk. Reduce exposure, tighten stops."),
    (20, "Elevated", "#ffa726", "Above average. Be selective with new entries."),
    (15, "Normal", "#66bb6a", "Normal market conditions. Standard risk."),
    (0,  "Low", "#26a69a", "Complacency. Watch for potential vol expansion."),
]


def is_fresh(filepath, max_hours=FRESHNESS_HOURS):
    """Check if a JSON file has a recent generatedAt/updated timestamp."""
    if not filepath.exists():
        return False
    try:
        data = json.loads(filepath.read_text())
        ts = None
        if isinstance(data, dict):
            ts = data.get("generatedAt") or data.get("updated")
        elif isinstance(data, list) and data:
            ts = data[0].get("updated")
        if not ts:
            # Fall back to file mtime
            mtime = datetime.fromtimestamp(filepath.stat().st_mtime, tz=timezone.utc)
            return (datetime.now(timezone.utc) - mtime) < timedelta(hours=max_hours)
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - parsed) < timedelta(hours=max_hours)
    except Exception:
        return False


def fetch_watchlist():
    """Update watchlist prices and SMAs from yfinance."""
    import yfinance as yf

    wl_path = DATA_DIR / "watchlist.json"
    if not wl_path.exists():
        print("  ⚠️ No existing watchlist.json — skipping (needs ticker metadata from Mac)")
        return

    watchlist = json.loads(wl_path.read_text())
    symbols = [t["symbol"] for t in watchlist]

    # Filter out non-yfinance symbols
    skip = set()
    for s in symbols:
        if "." in s and not s.endswith(".AX"):  # allow ASX
            skip.add(s)

    print(f"  Fetching {len(symbols) - len(skip)} tickers...")
    # Batch download daily data (200 days for SMA200)
    valid_symbols = [s for s in symbols if s not in skip]
    data = yf.download(valid_symbols, period="1y", interval="1d", group_by="ticker", progress=False, threads=True)

    now = datetime.now(timezone.utc).isoformat()

    for t in watchlist:
        sym = t["symbol"]
        if sym in skip:
            continue
        try:
            if len(valid_symbols) == 1:
                df = data
            else:
                df = data[sym]
            if df.empty or len(df) < 20:
                continue
            close = df["Close"].dropna()
            if close.empty:
                continue

            t["price"] = round(float(close.iloc[-1]), 2)
            if len(close) >= 2:
                prev = float(close.iloc[-2])
                t["change"] = round((t["price"] - prev) / prev * 100, 2) if prev else 0

            if len(close) >= 20:
                t["sma20"] = round(float(close.rolling(20).mean().iloc[-1]), 2)
            if len(close) >= 50:
                t["sma50"] = round(float(close.rolling(50).mean().iloc[-1]), 2)
            if len(close) >= 200:
                t["sma200"] = round(float(close.rolling(200).mean().iloc[-1]), 2)

            # Weekly SMA20 (approximate: 20 weeks = 100 trading days)
            if len(close) >= 100:
                weekly = close.resample("W").last().dropna()
                if len(weekly) >= 20:
                    t["w20"] = round(float(weekly.rolling(20).mean().iloc[-1]), 2)

            # Bias: price vs SMA20
            if t.get("sma20"):
                t["bias"] = "bull" if t["price"] > t["sma20"] else "bear"

            t["updated"] = now
        except Exception as e:
            print(f"  ⚠️ {sym}: {e}")
            continue

    with open(wl_path, "w") as f:
        json.dump(watchlist, f, indent=2)
    print(f"  ✅ Updated {len(watchlist)} watchlist tickers")


def fetch_sector_rotation():
    """Compute sector rotation from yfinance weekly data."""
    import yfinance as yf

    all_symbols = SECTOR_ETFS + [BENCHMARK]
    data = yf.download(all_symbols, period="2y", interval="1wk", group_by="ticker", progress=False, threads=True)

    # Extract weekly closes
    weekly = {}
    for sym in all_symbols:
        try:
            df = data[sym]["Close"].dropna()
            weekly[sym] = list(zip([d.strftime("%Y-%m-%d") for d in df.index], [float(v) for v in df.values]))
        except Exception as e:
            print(f"  ⚠️ {sym} weekly: {e}")

    if BENCHMARK not in weekly:
        print("  ❌ No benchmark data — skipping sector rotation")
        return

    bench_dates = [d for d, _ in weekly[BENCHMARK]]
    bench_closes = [c for _, c in weekly[BENCHMARK]]

    SECTORS = [
        {"symbol": "XLE", "name": "Energy", "color": "#FF5722"},
        {"symbol": "XLB", "name": "Materials", "color": "#795548"},
        {"symbol": "XLI", "name": "Industrials", "color": "#607D8B"},
        {"symbol": "XLY", "name": "Discretionary", "color": "#FFA500"},
        {"symbol": "XLP", "name": "Staples", "color": "#28A745"},
        {"symbol": "XLV", "name": "Healthcare", "color": "#DC3545"},
        {"symbol": "XLF", "name": "Financials", "color": "#1E90FF"},
        {"symbol": "XLK", "name": "Technology", "color": "#00BCD4"},
        {"symbol": "XLC", "name": "Communication", "color": "#9C27B0"},
        {"symbol": "XLU", "name": "Utilities", "color": "#6366F1"},
        {"symbol": "XLRE", "name": "Real Estate", "color": "#009688"},
    ]

    LOOKBACK = 13
    TRAIL_LENGTH = 26

    result = {
        "benchmark": BENCHMARK,
        "lookback": LOOKBACK,
        "trailLength": TRAIL_LENGTH,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "yfinance",
        "sectors": [],
    }

    for sec in SECTORS:
        sym = sec["symbol"]
        if sym not in weekly:
            continue

        sec_lookup = dict(weekly[sym])
        sec_closes = [sec_lookup.get(d) for d in bench_dates]

        # Compute RS + momentum
        n = len(bench_closes)
        rs = [None] * n
        momentum = [None] * n

        for i in range(LOOKBACK, n):
            if sec_closes[i] is None or sec_closes[i - LOOKBACK] is None:
                continue
            if bench_closes[i - LOOKBACK] == 0:
                continue
            sec_chg = (sec_closes[i] - sec_closes[i - LOOKBACK]) / sec_closes[i - LOOKBACK]
            ben_chg = (bench_closes[i] - bench_closes[i - LOOKBACK]) / bench_closes[i - LOOKBACK]
            if (1 + ben_chg) == 0:
                continue
            rs[i] = (1 + sec_chg) / (1 + ben_chg) * 100

        for i in range(1, n):
            if rs[i] is not None and rs[i - 1] is not None and rs[i - 1] != 0:
                momentum[i] = (rs[i] / rs[i - 1]) * 100

        trail = []
        for i in range(n - 1, -1, -1):
            if rs[i] is not None and momentum[i] is not None:
                trail.append({"date": bench_dates[i], "rs": round(rs[i], 3), "momentum": round(momentum[i], 3)})
            if len(trail) >= TRAIL_LENGTH:
                break
        trail.reverse()

        if trail:
            last = trail[-1]
            quadrant = ("Leading" if last["rs"] >= 100 and last["momentum"] >= 100 else
                        "Weakening" if last["rs"] >= 100 and last["momentum"] < 100 else
                        "Lagging" if last["rs"] < 100 and last["momentum"] < 100 else
                        "Improving")
        else:
            quadrant = "Unknown"

        result["sectors"].append({
            "symbol": sym, "name": sec["name"], "color": sec["color"],
            "quadrant": quadrant, "trail": trail,
        })

    with open(DATA_DIR / "sector-rotation.json", "w") as f:
        json.dump(result, f, indent=2)

    # Sector risk map (same logic as export-sector-rotation.py)
    SECTOR_NAME_MAP = {
        "Energy": ["Energy", "Clean Energy"], "Materials": ["Materials", "Agriculture"],
        "Industrials": ["Industrials"], "Discretionary": ["Discretionary", "Retail"],
        "Staples": ["Staples"], "Healthcare": ["Healthcare"], "Financials": ["Financials"],
        "Technology": ["Technology", "Telecom", "Semiconductors"],
        "Communication": ["Communication"], "Utilities": ["Utilities"], "Real Estate": [],
    }
    QUADRANT_RISK = {"Leading": "low", "Weakening": "medium", "Improving": "medium", "Lagging": "high"}
    sector_risk = {}
    for s in result["sectors"]:
        last = s["trail"][-1] if s["trail"] else {}
        risk = QUADRANT_RISK.get(s["quadrant"], "unknown")
        rs_val = last.get("rs", 100)
        mom_val = last.get("momentum", 100)
        if s["quadrant"] == "Lagging" and (rs_val < 95 or mom_val < 97):
            risk = "high"
        elif s["quadrant"] == "Weakening" and mom_val < 96:
            risk = "elevated"
        elif s["quadrant"] == "Improving" and rs_val < 95:
            risk = "elevated"
        entry = {"etf": s["symbol"], "quadrant": s["quadrant"], "risk": risk, "rs": round(rs_val, 2), "momentum": round(mom_val, 2)}
        for wl_name in SECTOR_NAME_MAP.get(s["name"], []):
            sector_risk[wl_name] = entry
        sector_risk[s["name"]] = entry
    for unmapped in ["Bond", "ETF", "Index", "Crypto"]:
        sector_risk[unmapped] = {"etf": None, "quadrant": "N/A", "risk": "neutral", "rs": 100, "momentum": 100}

    with open(DATA_DIR / "sector-risk.json", "w") as f:
        json.dump(sector_risk, f, indent=2)

    print(f"  ✅ Sector rotation: {len(result['sectors'])} sectors")


def fetch_vix():
    """Fetch VIX data and compute regime."""
    import yfinance as yf

    vix = yf.Ticker("^VIX")
    hist = vix.history(period="3mo", interval="1d")
    if hist.empty:
        print("  ⚠️ No VIX data")
        return

    close = hist["Close"].dropna()
    current = round(float(close.iloc[-1]), 2)
    sma20 = round(float(close.rolling(20).mean().iloc[-1]), 2) if len(close) >= 20 else current
    sma50 = round(float(close.rolling(50).mean().iloc[-1]), 2) if len(close) >= 50 else current

    # Percentile rank over 30 days
    last30 = close.iloc[-30:] if len(close) >= 30 else close
    percentile = int(round((last30 < current).mean() * 100))

    # Regime
    regime, color, desc_base = "Normal", "#66bb6a", ""
    for threshold, name, c, d in VIX_REGIMES:
        if current >= threshold:
            regime, color, desc_base = name, c, d
            break

    trend = "contracting" if current < sma20 else "expanding"
    description = f"VIX is {regime.lower()}. Trending {'below' if current < sma20 else 'above'} SMA20 ({sma20}), volatility is {trend}."

    result = {
        "current": current, "sma20": sma20, "sma50": sma50,
        "percentile30d": percentile, "regime": regime, "color": color,
        "description": description, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "yfinance",
    }
    with open(DATA_DIR / "vix.json", "w") as f:
        json.dump(result, f, indent=2)
    print(f"  ✅ VIX: {current} ({regime})")


def fetch_pairs():
    """Compute pair ratios and signals."""
    import yfinance as yf

    # Collect unique symbols
    symbols = set()
    for p in PAIRS:
        a, b = p["pair"].split("/")
        symbols.add(a)
        symbols.add(b)

    data = yf.download(list(symbols), period="3mo", interval="1d", group_by="ticker", progress=False, threads=True)

    results = []
    for p in PAIRS:
        a, b = p["pair"].split("/")
        try:
            ca = data[a]["Close"].dropna()
            cb = data[b]["Close"].dropna()
            # Align dates
            common = ca.index.intersection(cb.index)
            ca, cb = ca[common], cb[common]
            if len(ca) < 20:
                continue
            ratio = ca / cb
            sma20 = ratio.rolling(20).mean()
            current = float(ratio.iloc[-1])
            prev = float(ratio.iloc[-6]) if len(ratio) >= 6 else float(ratio.iloc[0])  # ~1 week ago
            sma_val = float(sma20.iloc[-1])

            if current > sma_val and current > prev:
                signal, color = "↗ RISING", "up"
            elif current < sma_val and current < prev:
                signal, color = "↘ FALLING", "down"
            elif current > prev:
                signal, color = "→ FLAT UP", "neutral"
            else:
                signal, color = "→ FLAT DOWN", "neutral"

            results.append({
                "pair": p["pair"], "desc": p["desc"],
                "signal": signal, "color": color,
            })
        except Exception as e:
            print(f"  ⚠️ {p['pair']}: {e}")
            results.append({"pair": p["pair"], "desc": p["desc"], "signal": "— N/A", "color": "neutral"})

    with open(DATA_DIR / "pairs.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"  ✅ Pairs: {len(results)} ratios")


def fetch_fear_greed():
    """Fetch CNN Fear & Greed Index, with VIX-based approximation as fallback."""
    import urllib.request

    # Try CNN API first
    try:
        url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        def parse_hist(d, key):
            val = d.get(key)
            return int(val) if val is not None else None

        result = {
            "current": {"value": int(data["fear_and_greed"]["score"]), "label": data["fear_and_greed"]["rating"]},
            "previousClose": {"value": parse_hist(data.get("fear_and_greed_historical", {}), "previousClose"),
                              "label": data.get("fear_and_greed_historical", {}).get("previousOneDay", "")},
            "oneWeekAgo": {"value": parse_hist(data.get("fear_and_greed_historical", {}), "oneWeekAgo"),
                           "label": data.get("fear_and_greed_historical", {}).get("previousOneWeek", "")},
            "oneMonthAgo": {"value": parse_hist(data.get("fear_and_greed_historical", {}), "oneMonthAgo"),
                            "label": data.get("fear_and_greed_historical", {}).get("previousOneMonth", "")},
            "updated": datetime.now(timezone.utc).isoformat(),
            "source": "cnn",
        }
        with open(DATA_DIR / "fear-greed.json", "w") as f:
            json.dump(result, f, indent=2)
        print(f"  ✅ Fear & Greed: {result['current']['value']} ({result['current']['label']})")
        return
    except Exception as e:
        print(f"  ⚠️ CNN API failed ({e}) — using VIX-based approximation")

    # Fallback: VIX-based F&G approximation
    # VIX 10=Extreme Greed(95), VIX 15=Greed(75), VIX 20=Neutral(50), VIX 25=Fear(25), VIX 35+=Extreme Fear(5)
    try:
        vix_data = json.loads((DATA_DIR / "vix.json").read_text())
        vix = vix_data.get("current", 20)
        # Linear mapping: VIX 10→95, VIX 35→5
        score = max(0, min(100, int(100 - (vix - 10) * 3.6)))
        if score >= 75: label = "Extreme Greed"
        elif score >= 55: label = "Greed"
        elif score >= 45: label = "Neutral"
        elif score >= 25: label = "Fear"
        else: label = "Extreme Fear"

        result = {
            "current": {"value": score, "label": label},
            "previousClose": {"value": None, "label": ""},
            "oneWeekAgo": {"value": None, "label": ""},
            "oneMonthAgo": {"value": None, "label": ""},
            "updated": datetime.now(timezone.utc).isoformat(),
            "source": "vix-approximation",
        }
        with open(DATA_DIR / "fear-greed.json", "w") as f:
            json.dump(result, f, indent=2)
        print(f"  ✅ Fear & Greed (VIX approx): {score} ({label})")
    except Exception as e2:
        print(f"  ❌ Fear & Greed completely failed: {e2} — keeping existing data")


def main():
    force = "--force" in sys.argv
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    datasets = [
        ("watchlist.json", fetch_watchlist),
        ("sector-rotation.json", fetch_sector_rotation),
        ("vix.json", fetch_vix),
        ("pairs.json", fetch_pairs),
        ("fear-greed.json", fetch_fear_greed),
    ]

    for filename, fetcher in datasets:
        path = DATA_DIR / filename
        if not force and is_fresh(path):
            print(f"✅ {filename} is fresh — skipping")
            continue
        print(f"🔄 {filename} is stale — fetching from yfinance...")
        try:
            fetcher()
        except Exception as e:
            print(f"  ❌ {filename} failed: {e}")


if __name__ == "__main__":
    main()
