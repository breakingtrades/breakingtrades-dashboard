#!/usr/bin/env python3
"""
update-ai-picks-tracker.py — refresh the AI Picks tracked portfolio with live prices.

Reads data/ai-trader/ai-picks-tracker.json, looks up each position's current price
from data/watchlist.json (the canonical live price layer the dashboard already
maintains), recomputes unrealized P&L, advances days_held, updates the high-water
mark, and flips status to STOPPED (price <= stop) or TARGET (price >= target_2).

Idempotent: safe to run every EOD. Never re-opens a STOPPED/TARGET position.

Run from the dashboard repo root:
    python3 scripts/update-ai-picks-tracker.py

Designed to be wired into eod-update.sh after the price refresh step.
"""
import json
import os
import sys
from datetime import datetime, timezone, date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACKER = os.path.join(REPO, "data", "ai-trader", "ai-picks-tracker.json")
WATCHLIST = os.path.join(REPO, "data", "watchlist.json")
PRICES = os.path.join(REPO, "data", "prices.json")


def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def current_price(ticker, wl_by_sym, prices):
    """Resolve a live price: watchlist first, then prices.json, else None."""
    t = wl_by_sym.get(ticker)
    if t and t.get("price"):
        return float(t["price"])
    pj = (prices or {}).get("tickers", {}).get(ticker) if prices else None
    if pj and pj.get("price"):
        return float(pj["price"])
    return None


def trading_days_between(start_iso, end_date):
    """Approximate trading days (weekdays) between entry and now."""
    try:
        start = date.fromisoformat(start_iso)
    except Exception:
        return 0
    days = 0
    cur = start
    while cur < end_date:
        if cur.weekday() < 5:
            days += 1
        cur = date.fromordinal(cur.toordinal() + 1)
    return days


def main():
    tracker = load_json(TRACKER)
    if not tracker:
        print(f"No tracker at {TRACKER} — nothing to update.")
        return 0
    wl = load_json(WATCHLIST) or []
    wl_by_sym = {t["symbol"]: t for t in wl} if isinstance(wl, list) else {}
    prices = load_json(PRICES)

    today = date.today()
    updated = 0
    total_cost = 0.0
    total_value = 0.0

    for p in tracker.get("positions", []):
        cost = p.get("cost_basis") or (p["entry_price"] * p["shares"])
        total_cost += cost
        px = current_price(p["ticker"], wl_by_sym, prices)
        if px is None:
            # keep last known price; still count its value
            px = p.get("last_price", p["entry_price"])
        else:
            updated += 1
        p["last_price"] = round(px, 4)
        p["days_held"] = trading_days_between(p["entry_date"], today)
        # High-water mark
        if px > p.get("high_water_mark", p["entry_price"]):
            p["high_water_mark"] = round(px, 4)
        # P&L
        mkt_val = px * p["shares"]
        p["unrealized_pnl"] = round(mkt_val - cost, 2)
        p["unrealized_pct"] = round((px / p["entry_price"] - 1) * 100, 2)
        # Status transitions (only from OPEN — never reopen a closed position)
        if p.get("status", "OPEN") == "OPEN":
            if px <= p["stop_price"]:
                p["status"] = "STOPPED"
                p["exit_price"] = round(px, 4)
                p["exit_date"] = today.isoformat()
            elif px >= p["target_2"]:
                p["status"] = "TARGET"
                p["exit_price"] = round(px, 4)
                p["exit_date"] = today.isoformat()
        total_value += mkt_val

    # Portfolio rollup
    cash = tracker.get("cash", 0.0)
    tracker["as_of"] = datetime.now(timezone.utc).isoformat()
    tracker["market_value"] = round(total_value + cash, 2)
    tracker["total_unrealized_pnl"] = round(total_value - total_cost, 2)
    tracker["total_unrealized_pct"] = round(
        (total_value - total_cost) / total_cost * 100, 2) if total_cost else 0.0
    open_count = sum(1 for p in tracker["positions"] if p.get("status") == "OPEN")
    tracker["open_count"] = open_count

    with open(TRACKER, "w") as f:
        json.dump(tracker, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"AI Picks tracker updated: {updated} live prices, "
          f"P&L ${tracker['total_unrealized_pnl']:+,.2f} "
          f"({tracker['total_unrealized_pct']:+.2f}%), "
          f"{open_count} open / {len(tracker['positions'])} total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
