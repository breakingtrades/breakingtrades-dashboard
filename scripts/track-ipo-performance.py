#!/usr/bin/env python3
"""
track-ipo-performance.py — IPO post-debut performance tracker.

Reads `data/ipo-history.jsonl` (append-only ledger of recent IPO debuts) and
fetches live OHLCV data from yfinance to compute:

  - day1_close_pct     — close on first trading day vs IPO price
  - day1_high_pct      — intraday high day 1 vs IPO price
  - last_close         — most recent close
  - return_from_ipo_pct
  - return_from_d1_high_pct
  - broke_ipo_price    — true if any post-d1 close < IPO price
  - days_since_ipo
  - status_tag         — 'pop-and-hold' / 'sub-IPO-fade' / 'crashed' / etc.

Output: `data/ipo-tracker.json` — consumed by Events page + Week Ahead page
to display recent IPO performance as a regime signal for upcoming IPOs.

Usage:
    python3 scripts/track-ipo-performance.py [--dry-run] [--days 90]

Dependencies: yfinance via the parent project's venv (path-resolved below).
Falls back to system yfinance if available.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
HISTORY_PATH = DATA / "ipo-history.jsonl"
OUT_PATH = DATA / "ipo-tracker.json"

# Prefer the parent project's venv (has yfinance + lxml installed)
PARENT_VENV_PY = Path.home() / "projects" / "breakingtrades" / ".venv" / "bin" / "python"
if PARENT_VENV_PY.exists():
    YF_PY = str(PARENT_VENV_PY)
else:
    YF_PY = sys.executable


def load_history() -> list[dict]:
    """Read ipo-history.jsonl, skipping comment/metadata lines."""
    out: list[dict] = []
    if not HISTORY_PATH.exists():
        return out
    with open(HISTORY_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            # Skip the metadata header (no `symbol` key)
            if "symbol" not in rec:
                continue
            out.append(rec)
    return out


def fetch_ohlc(symbols: list[str]) -> dict[str, list[dict]]:
    """Pull daily OHLC since each symbol's IPO date via yfinance.

    Runs as a subprocess against the parent venv's python so we don't need
    yfinance installed in the dashboard's environment.
    """
    if not symbols:
        return {}
    code = """
import sys, json
import yfinance as yf

symbols = sys.argv[1].split(',')
out = {}
for sym in symbols:
    try:
        h = yf.Ticker(sym).history(period='6mo')
        out[sym] = [
            {
                'date': str(d.date()),
                'open': round(float(o), 4) if o == o else None,
                'high': round(float(hi), 4) if hi == hi else None,
                'low': round(float(lo), 4) if lo == lo else None,
                'close': round(float(c), 4) if c == c else None,
                'volume': int(v) if v == v else 0,
            }
            for d, o, hi, lo, c, v in zip(
                h.index, h['Open'], h['High'], h['Low'], h['Close'], h['Volume']
            )
        ]
    except Exception as ex:
        out[sym] = {'error': str(ex)}
print(json.dumps(out))
"""
    try:
        r = subprocess.run(
            [YF_PY, "-c", code, ",".join(symbols)],
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode != 0:
            print(f"WARN: yfinance subprocess failed: {r.stderr[:300]}", file=sys.stderr)
            return {}
        return json.loads(r.stdout)
    except Exception as ex:
        print(f"WARN: fetch_ohlc crashed: {ex}", file=sys.stderr)
        return {}


def classify(d1_close_pct: float | None, last_pct: float | None,
             broke_ipo: bool, days_since: int) -> str:
    """Heuristic regime tag for the IPO."""
    if d1_close_pct is None or last_pct is None:
        return "unknown"
    if days_since <= 1:
        if d1_close_pct >= 30:
            return "blowout-pop"
        if d1_close_pct >= 10:
            return "solid-pop"
        if d1_close_pct >= 0:
            return "flat-debut"
        return "broken-ipo-day-1"
    # Multi-session view
    if last_pct < -25:
        return "crashed"
    if broke_ipo and last_pct < 0:
        return "sub-IPO-fade"
    if last_pct < -5:
        return "pop-and-fade"
    if d1_close_pct >= 10 and last_pct >= 5:
        return "pop-and-hold"
    if last_pct >= 0:
        return "holding-IPO"
    return "below-IPO"


def compute_metrics(rec: dict, ohlc: list[dict] | dict) -> dict:
    """Compute post-debut metrics for one IPO record."""
    out: dict = {**rec, "metrics": None, "history_days": 0, "error": None}
    if isinstance(ohlc, dict) and ohlc.get("error"):
        out["error"] = ohlc["error"]
        return out
    if not isinstance(ohlc, list) or not ohlc:
        out["error"] = "no_ohlc"
        return out

    ipo_price = rec.get("ipo_price")
    ipo_date = rec.get("ipo_date")
    if not ipo_price or not ipo_date:
        out["error"] = "missing_ipo_meta"
        return out

    # Filter to bars on/after IPO date
    bars = [b for b in ohlc if b["date"] >= ipo_date and b.get("close") is not None]
    if not bars:
        out["error"] = "no_bars_after_ipo_date"
        return out

    d1 = bars[0]
    last = bars[-1]
    today = datetime.now(timezone.utc).date()
    try:
        ipo_d = datetime.fromisoformat(ipo_date).date()
        days_since_ipo = (today - ipo_d).days
    except Exception:
        days_since_ipo = len(bars)

    d1_close_pct = (d1["close"] - ipo_price) / ipo_price * 100 if ipo_price else None
    d1_high_pct = (d1["high"] - ipo_price) / ipo_price * 100 if d1.get("high") and ipo_price else None
    last_pct = (last["close"] - ipo_price) / ipo_price * 100 if ipo_price else None
    last_from_d1_high_pct = None
    if d1.get("high") and last.get("close"):
        last_from_d1_high_pct = (last["close"] - d1["high"]) / d1["high"] * 100

    broke_ipo = any(b["close"] < ipo_price for b in bars[1:]) if len(bars) > 1 else False

    # Day-5 / day-30 snapshots when available
    def at(idx: int) -> dict | None:
        if idx < len(bars):
            b = bars[idx]
            return {
                "date": b["date"],
                "close": b["close"],
                "pct_from_ipo": round((b["close"] - ipo_price) / ipo_price * 100, 2),
            }
        return None

    # Volume collapse signal — interest exhaustion if vol_recent / vol_d1 < 0.25
    vol_d1 = d1.get("volume") or 0
    vol_last = last.get("volume") or 0
    vol_collapse_pct = None
    if vol_d1 > 0:
        vol_collapse_pct = round((vol_last - vol_d1) / vol_d1 * 100, 1)

    status_tag = classify(d1_close_pct, last_pct, broke_ipo, days_since_ipo)

    out["metrics"] = {
        "days_since_ipo": days_since_ipo,
        "history_days": len(bars),
        "ipo_price": ipo_price,
        "day1_close": d1["close"],
        "day1_high": d1.get("high"),
        "day1_close_pct": round(d1_close_pct, 2) if d1_close_pct is not None else None,
        "day1_high_pct": round(d1_high_pct, 2) if d1_high_pct is not None else None,
        "last_date": last["date"],
        "last_close": last["close"],
        "return_from_ipo_pct": round(last_pct, 2) if last_pct is not None else None,
        "return_from_d1_high_pct": round(last_from_d1_high_pct, 2) if last_from_d1_high_pct is not None else None,
        "broke_ipo_price": broke_ipo,
        "day5": at(4),
        "day30": at(29),
        "volume_d1": vol_d1,
        "volume_last": vol_last,
        "volume_collapse_pct": vol_collapse_pct,
        "status_tag": status_tag,
    }
    out["history_days"] = len(bars)
    return out


def regime_summary(records: list[dict]) -> dict:
    """Aggregate signal across all tracked IPOs."""
    valid = [r for r in records if r.get("metrics")]
    if not valid:
        return {"signal": "no_data", "ipos_tracked": 0}

    tags: dict[str, int] = {}
    last_pcts: list[float] = []
    broken = 0
    for r in valid:
        m = r["metrics"]
        tags[m["status_tag"]] = tags.get(m["status_tag"], 0) + 1
        if m["return_from_ipo_pct"] is not None:
            last_pcts.append(m["return_from_ipo_pct"])
        if m["broke_ipo_price"]:
            broken += 1

    avg_return = round(sum(last_pcts) / len(last_pcts), 2) if last_pcts else None
    median_return = (
        round(sorted(last_pcts)[len(last_pcts) // 2], 2) if last_pcts else None
    )

    # Regime classification
    bad_tags = {"crashed", "sub-IPO-fade", "pop-and-fade", "broken-ipo-day-1", "below-IPO"}
    good_tags = {"blowout-pop", "solid-pop", "pop-and-hold"}
    bad = sum(tags.get(t, 0) for t in bad_tags)
    good = sum(tags.get(t, 0) for t in good_tags)
    n = len(valid)

    if n == 0:
        signal = "no_data"
        interp = "No IPOs tracked yet."
    elif bad / n >= 0.6:
        signal = "exhaustion"
        interp = (
            f"{bad}/{n} recent IPOs faded or broke IPO price. Hype is exhausted at the auction; "
            "no incremental bid for the tape. Avoid day-1 chasing on upcoming mega-IPOs."
        )
    elif good / n >= 0.6:
        signal = "robust"
        interp = (
            f"{good}/{n} recent IPOs popped and held. Demand is following through to the tape. "
            "Mega-IPO day-1 momentum has a higher probability of sustaining."
        )
    else:
        signal = "mixed"
        interp = (
            f"Mixed regime — {good}/{n} held, {bad}/{n} faded. Selectivity matters. "
            "Watch sector tilt: AI/quantum buying impulses are sector-specific not market-wide."
        )

    return {
        "signal": signal,
        "interpretation": interp,
        "ipos_tracked": n,
        "broke_ipo_price_count": broken,
        "broke_ipo_price_pct": round(broken / n * 100, 1) if n else 0,
        "avg_return_from_ipo_pct": avg_return,
        "median_return_from_ipo_pct": median_return,
        "by_status_tag": tags,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--days", type=int, default=90,
                    help="Only include IPOs from the last N days (default 90)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    out_path = Path(args.out) if args.out else OUT_PATH
    history = load_history()

    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=args.days)).isoformat()
    fresh = [r for r in history if r.get("ipo_date", "") >= cutoff]
    print(f"Loaded {len(history)} IPOs from history; {len(fresh)} within last {args.days}d")

    if not fresh:
        print("No recent IPOs to track. Exiting.")
        if not args.dry_run:
            payload = {
                "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "ipos": [],
                "regime_summary": {"signal": "no_data", "ipos_tracked": 0},
            }
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w") as f:
                json.dump(payload, f, indent=2)
                f.write("\n")
        return

    symbols = sorted({r["symbol"] for r in fresh})
    print(f"Fetching OHLC for: {', '.join(symbols)}")
    ohlc = fetch_ohlc(symbols)

    enriched: list[dict] = []
    for r in fresh:
        bars = ohlc.get(r["symbol"], [])
        enriched.append(compute_metrics(r, bars))

    enriched.sort(key=lambda r: r.get("ipo_date", ""), reverse=True)

    regime = regime_summary(enriched)

    payload = {
        "schema_version": 1,
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "lookback_days": args.days,
        "regime_summary": regime,
        "ipos": enriched,
    }

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"\nWrote {out_path}")
    print(f"  Regime: {regime['signal']} — {regime.get('interpretation','')[:120]}")
    for r in enriched:
        m = r.get("metrics") or {}
        if m:
            print(f"  {r['symbol']:6} ({r['ipo_date']}): "
                  f"d1={m['day1_close_pct']:+.1f}% high={m['day1_high_pct']:+.1f}% → "
                  f"now {m['return_from_ipo_pct']:+.1f}% [{m['status_tag']}]"
                  f"{' BROKE' if m['broke_ipo_price'] else ''}")
        else:
            print(f"  {r['symbol']:6} ({r['ipo_date']}): error={r.get('error')}")


if __name__ == "__main__":
    main()
