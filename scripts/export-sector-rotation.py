#!/usr/bin/env python3
"""Export sector rotation data (RS + momentum with trail) for the RRG chart."""

import csv
import json
import os
from pathlib import Path

DATA_DIR = Path(os.path.expanduser("~/projects/breakingtrades/data"))
OUT_FILE = Path(os.path.expanduser(
    "~/projects/breakingtrades/breakingtrades-dashboard/data/sector-rotation.json"
))

BENCHMARK = "SPY"
LOOKBACK = 13  # 13-week RS lookback (quarterly)
TRAIL_LENGTH = 26  # how many weeks of trail to export (UI can slice shorter)

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


def read_weekly_close(symbol: str) -> list[tuple[str, float]]:
    """Read weekly CSV, return list of (date, close)."""
    path = DATA_DIR / f"{symbol}_weekly.csv"
    rows = []
    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((row["date"], float(row["close"])))
    return rows


def align_to_benchmark(benchmark_dates, sector_data):
    """Align sector data to benchmark dates via dict lookup."""
    lookup = dict(sector_data)
    return [lookup.get(d) for d in benchmark_dates]


def compute_rs_momentum(sector_closes, bench_closes, lookback):
    """Compute RS ratio and RS momentum arrays."""
    n = len(bench_closes)
    rs = [None] * n
    momentum = [None] * n

    for i in range(lookback, n):
        if sector_closes[i] is None or sector_closes[i - lookback] is None:
            continue
        if bench_closes[i] is None or bench_closes[i - lookback] is None:
            continue
        sec_chg = (sector_closes[i] - sector_closes[i - lookback]) / sector_closes[i - lookback]
        ben_chg = (bench_closes[i] - bench_closes[i - lookback]) / bench_closes[i - lookback]
        if (1 + ben_chg) == 0:
            continue
        rs[i] = (1 + sec_chg) / (1 + ben_chg) * 100  # centered at 100

    for i in range(1, n):
        if rs[i] is not None and rs[i - 1] is not None and rs[i - 1] != 0:
            momentum[i] = (rs[i] / rs[i - 1]) * 100  # centered at 100

    return rs, momentum


def main():
    if not DATA_DIR.exists():
        print(f"⚠️ Data dir {DATA_DIR} not found — skipping sector rotation export (using existing data)")
        return
    bench_file = DATA_DIR / f"{BENCHMARK}_weekly.csv"
    if not bench_file.exists():
        print(f"⚠️ Benchmark file {bench_file} not found — skipping sector rotation export")
        return

    bench_data = read_weekly_close(BENCHMARK)
    bench_dates = [d for d, _ in bench_data]
    bench_closes = [c for _, c in bench_data]

    result = {
        "benchmark": BENCHMARK,
        "lookback": LOOKBACK,
        "trailLength": TRAIL_LENGTH,
        "generatedAt": None,
        "sectors": [],
    }

    from datetime import datetime
    result["generatedAt"] = datetime.now().isoformat()

    for sec in SECTORS:
        sec_data = read_weekly_close(sec["symbol"])
        aligned = align_to_benchmark(bench_dates, sec_data)
        rs, mom = compute_rs_momentum(aligned, bench_closes, LOOKBACK)

        # Get last TRAIL_LENGTH valid points
        trail = []
        for i in range(len(rs) - 1, -1, -1):
            if rs[i] is not None and mom[i] is not None:
                trail.append({
                    "date": bench_dates[i],
                    "rs": round(rs[i], 3),
                    "momentum": round(mom[i], 3),
                })
            if len(trail) >= TRAIL_LENGTH:
                break
        trail.reverse()

        if trail:
            last = trail[-1]
            quadrant = "Leading" if last["rs"] >= 100 and last["momentum"] >= 100 else \
                       "Weakening" if last["rs"] >= 100 and last["momentum"] < 100 else \
                       "Lagging" if last["rs"] < 100 and last["momentum"] < 100 else \
                       "Improving"
        else:
            quadrant = "Unknown"

        result["sectors"].append({
            "symbol": sec["symbol"],
            "name": sec["name"],
            "color": sec["color"],
            "quadrant": quadrant,
            "trail": trail,
        })

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(result, f, indent=2)

    # --- Sector Risk Map ---
    # Map GICS sector names to watchlist sector names, assign risk level from quadrant + RS/momentum distance
    SECTOR_NAME_MAP = {
        "Energy": ["Energy", "Clean Energy"],
        "Materials": ["Materials", "Agriculture"],
        "Industrials": ["Industrials"],
        "Discretionary": ["Discretionary", "Retail"],
        "Staples": ["Staples"],
        "Healthcare": ["Healthcare"],
        "Financials": ["Financials"],
        "Technology": ["Technology", "Telecom", "Semiconductors"],
        "Communication": ["Communication"],
        "Utilities": ["Utilities"],
        "Real Estate": [],  # no tickers in watchlist currently
    }

    QUADRANT_RISK = {
        "Leading": "low",       # RS>100, Mom>100 — strong and accelerating
        "Weakening": "medium",  # RS>100, Mom<100 — strong but decelerating
        "Improving": "medium",  # RS<100, Mom>100 — weak but accelerating
        "Lagging": "high",      # RS<100, Mom<100 — weak and decelerating
    }

    sector_risk = {}
    for s in result["sectors"]:
        last = s["trail"][-1] if s["trail"] else {}
        risk = QUADRANT_RISK.get(s["quadrant"], "unknown")
        # Increase risk if deeply in quadrant
        rs = last.get("rs", 100)
        mom = last.get("momentum", 100)
        if s["quadrant"] == "Lagging" and (rs < 95 or mom < 97):
            risk = "high"
        elif s["quadrant"] == "Weakening" and mom < 96:
            risk = "elevated"
        elif s["quadrant"] == "Improving" and rs < 95:
            risk = "elevated"

        entry = {
            "etf": s["symbol"],
            "quadrant": s["quadrant"],
            "risk": risk,
            "rs": round(rs, 2),
            "momentum": round(mom, 2),
        }
        # Map to watchlist sector names
        for wl_name in SECTOR_NAME_MAP.get(s["name"], []):
            sector_risk[wl_name] = entry
        sector_risk[s["name"]] = entry  # also keyed by GICS name

    # Fallback for sectors not mapped to a GICS ETF
    for unmapped in ["Bond", "ETF", "Index", "Crypto"]:
        sector_risk[unmapped] = {"etf": None, "quadrant": "N/A", "risk": "neutral", "rs": 100, "momentum": 100}

    risk_file = OUT_FILE.parent / "sector-risk.json"
    with open(risk_file, "w") as f:
        json.dump(sector_risk, f, indent=2)

    print(f"✅ Exported sector risk map to {risk_file}")
    print(f"✅ Exported {len(result['sectors'])} sectors to {OUT_FILE}")
    for s in result["sectors"]:
        t = s["trail"][-1] if s["trail"] else {}
        print(f"  {s['symbol']:5s} → RS={t.get('rs','?'):>7}  Mom={t.get('momentum','?'):>7}  [{s['quadrant']}]")


if __name__ == "__main__":
    main()
