#!/usr/bin/env python3
"""Update data/vix.json with latest VIX price + SMA20/50 + 30d percentile."""
import json, os, urllib.request
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(REPO, 'data', 'vix.json')

url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=90d'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
data = json.loads(urllib.request.urlopen(req, timeout=15).read())
closes = [c for c in data['chart']['result'][0]['indicators']['quote'][0]['close'] if c is not None]

current = round(closes[-1], 2)
sma20   = round(sum(closes[-20:]) / min(20, len(closes)), 2)
sma50   = round(sum(closes[-50:]) / min(50, len(closes)), 2)

window = sorted(closes[-30:])
percentile30d = round(sum(1 for x in window if x < current) / len(window) * 100)

if   current < 15: regime, color = 'Complacency', '#00d4aa'
elif current < 20: regime, color = 'Normal',      '#8bc34a'
elif current < 30: regime, color = 'Elevated',    '#ffa726'
elif current < 40: regime, color = 'Fear',        '#ef5350'
else:              regime, color = 'Panic',       '#d32f2f'

trend = 'above' if current > sma20 else 'below'
direction = 'rising' if current > sma20 else 'easing'
description = f'VIX is {regime.lower()}. Trending {trend} SMA20 ({sma20}), showing {direction} volatility.'

result = {
    'current':        current,
    'sma20':          sma20,
    'sma50':          sma50,
    'percentile30d':  percentile30d,
    'regime':         regime,
    'color':          color,
    'description':    description,
    'updated':        datetime.now(timezone.utc).isoformat(),
}

with open(OUT, 'w') as f:
    json.dump(result, f, indent=2)

print(f'[vix] {current} | {regime} | SMA20={sma20} | p{percentile30d}')
