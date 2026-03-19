#!/usr/bin/env python3
"""Scrape CNN Fear & Greed index and write data/fear-greed.json"""
import json, os, requests
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(SCRIPT_DIR), "data", "fear-greed.json")
URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"

def label(v):
    if v is None: return None
    if v >= 75: return "Extreme Greed"
    if v >= 55: return "Greed"
    if v >= 45: return "Neutral"
    if v >= 25: return "Fear"
    return "Extreme Fear"

def entry(v):
    if v is None: return None
    v = round(v, 1)
    return {"value": v, "label": label(v)}

r = requests.get(URL, headers={"User-Agent": UA}, timeout=10)
r.raise_for_status()
fg = r.json().get("fear_and_greed", {})

out = {
    "current": entry(fg.get("score")),
    "previousClose": entry(fg.get("previous_close")),
    "oneWeekAgo": entry(fg.get("previous_1_week")),
    "oneMonthAgo": entry(fg.get("previous_1_month")),
    "oneYearAgo": entry(fg.get("previous_1_year")),
    "updated": datetime.now(timezone.utc).isoformat(),
    "source": "cnn"
}

with open(OUT, "w") as f:
    json.dump(out, f, indent=2)

print(f"F&G: {out['current']['value']} ({out['current']['label']})")
