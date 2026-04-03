#!/usr/bin/env python3
"""
capture-quarterly-em.py — End-of-quarter EM snapshot capture

Captures implied volatility and prices at the last trading day of a quarter
from IB Gateway, computes quarterly/monthly EM ranges, and appends to
data/em-quarterly-history.json.

Usage:
  python3 scripts/capture-quarterly-em.py                    # Auto-detect last completed quarter
  python3 scripts/capture-quarterly-em.py --quarter Q1-2026  # Specific quarter
  python3 scripts/capture-quarterly-em.py --dry-run          # Preview without writing

Requires: IB Gateway on port 4002, ib_insync
"""

import argparse
import asyncio
import datetime
import json
import math
import os
import sys

# Fix asyncio for ib_insync
asyncio.set_event_loop(asyncio.new_event_loop())
from ib_insync import IB, Stock, Index

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EM_FILE = os.path.join(PROJECT_DIR, 'data', 'expected-moves.json')
HIST_FILE = os.path.join(PROJECT_DIR, 'data', 'em-quarterly-history.json')

COEFF = 2 / math.sqrt(2 * math.pi)
INDEX_TICKERS = {'SPX'}

# Quarter definitions: end date, quarterly expiry (3rd Friday ~80d out), monthly expiry (~17d out)
# Expiries are the standard options expiration Fridays
QUARTERS = {
    'Q1-2025': {'date': '2025-03-31', 'q_exp': '20250620', 'm_exp': '20250417'},
    'Q2-2025': {'date': '2025-06-30', 'q_exp': '20250919', 'm_exp': '20250718'},
    'Q3-2025': {'date': '2025-09-30', 'q_exp': '20251219', 'm_exp': '20251017'},
    'Q4-2025': {'date': '2025-12-31', 'q_exp': '20260320', 'm_exp': '20260116'},
    'Q1-2026': {'date': '2026-03-31', 'q_exp': '20260619', 'm_exp': '20260417'},
    'Q2-2026': {'date': '2026-06-30', 'q_exp': '20260918', 'm_exp': '20260717'},
    'Q3-2026': {'date': '2026-09-30', 'q_exp': '20261218', 'm_exp': '20261016'},
    'Q4-2026': {'date': '2026-12-31', 'q_exp': '20270319', 'm_exp': '20270115'},
}


def parse_exp(s):
    return datetime.date(int(s[:4]), int(s[4:6]), int(s[6:]))


def detect_quarter():
    """Detect the most recently completed quarter."""
    today = datetime.date.today()
    # Quarter end dates for the current year and previous
    for label in sorted(QUARTERS.keys(), reverse=True):
        end = datetime.date.fromisoformat(QUARTERS[label]['date'])
        if end < today:
            return label
    return None


def load_tickers():
    """Load ticker list from expected-moves.json."""
    with open(EM_FILE) as f:
        return sorted(json.load(f)['tickers'].keys())


def load_history():
    """Load existing history or create empty structure."""
    if os.path.exists(HIST_FILE):
        with open(HIST_FILE) as f:
            return json.load(f)
    return {
        'updated': None,
        'source': 'ib_historical_iv',
        'description': 'Quarter-end EM snapshots from IB implied volatility',
        'tickers': {},
        'summary': {'total_tickers': 0, 'quarters': [], 'overall_accuracy': {}}
    }


def capture_quarter(ib, tickers, quarter_label):
    """Capture IV + price data for all tickers at a quarter-end date."""
    q_info = QUARTERS[quarter_label]
    target = q_info['date']
    end_dt = target.replace('-', '') + ' 23:59:59'
    # Add 1 day to get data including the target date
    target_dt = datetime.date.fromisoformat(target)
    next_day = target_dt + datetime.timedelta(days=1)
    end_dt = next_day.strftime('%Y%m%d') + ' 23:59:59'

    q_dte = (parse_exp(q_info['q_exp']) - target_dt).days
    m_dte = (parse_exp(q_info['m_exp']) - target_dt).days

    print(f"\n{'='*50}")
    print(f"  {quarter_label} — {target} (Q DTE={q_dte}, M DTE={m_dte})")
    print(f"{'='*50}")

    results = {}
    ok = skip = 0

    for i, ticker in enumerate(tickers):
        try:
            if ticker in INDEX_TICKERS:
                contract = Index(ticker, 'CBOE', 'USD')
            else:
                contract = Stock(ticker, 'SMART', 'USD')
            ib.qualifyContracts(contract)

            bars = ib.reqHistoricalData(
                contract, endDateTime=end_dt,
                durationStr='5 D', barSizeSetting='1 day',
                whatToShow='OPTION_IMPLIED_VOLATILITY', useRTH=True,
                formatDate=1, timeout=10
            )
            iv_data = {str(b.date): b.close for b in bars} if bars else {}

            price_bars = ib.reqHistoricalData(
                contract, endDateTime=end_dt,
                durationStr='5 D', barSizeSetting='1 day',
                whatToShow='TRADES', useRTH=True,
                formatDate=1, timeout=10
            )
            price_data = {str(b.date): b.close for b in price_bars} if price_bars else {}

            prev = (target_dt - datetime.timedelta(days=1)).isoformat()
            iv = iv_data.get(target) or iv_data.get(prev)
            price = price_data.get(target) or price_data.get(prev)

            if iv and price and iv > 0:
                S, sigma = price, iv
                em_q = S * sigma * math.sqrt(q_dte / 365) * COEFF * 0.85
                em_m = S * sigma * math.sqrt(m_dte / 365) * COEFF * 0.85
                results[ticker] = {
                    'date': target,
                    'close': round(S, 2),
                    'iv': round(sigma * 100, 2),
                    'quarterly': {
                        'em': round(em_q, 2), 'pct': round(em_q / S * 100, 2),
                        'upper': round(S + em_q, 2), 'lower': round(S - em_q, 2),
                        'dte': q_dte, 'expiry': q_info['q_exp']
                    },
                    'monthly': {
                        'em': round(em_m, 2), 'pct': round(em_m / S * 100, 2),
                        'upper': round(S + em_m, 2), 'lower': round(S - em_m, 2),
                        'dte': m_dte, 'expiry': q_info['m_exp']
                    }
                }
                ok += 1
            else:
                skip += 1
                if skip <= 5:
                    print(f"  SKIP {ticker}: iv={iv} price={price}")

            ib.sleep(0.3)

        except Exception as e:
            skip += 1
            print(f"  ERR {ticker}: {e}")

        if (i + 1) % 16 == 0:
            print(f"  ... {i+1}/{len(tickers)} ({ok} ok, {skip} skip)")

    print(f"  DONE: {ok}/{len(tickers)} ok, {skip} skip")
    return results


def integrate_results(hist, quarter_label, results):
    """Integrate captured results into the history file."""
    # Ensure quarter is in summary
    if quarter_label not in hist['summary'].get('quarters', []):
        hist['summary']['quarters'].append(quarter_label)
        hist['summary']['quarters'].sort()

    prev_quarter = None
    all_quarters = sorted(QUARTERS.keys())
    idx = all_quarters.index(quarter_label) if quarter_label in all_quarters else -1
    if idx > 0:
        prev_quarter = all_quarters[idx - 1]

    added = 0
    updated_outcomes = 0

    for ticker, data in results.items():
        if ticker not in hist['tickers']:
            hist['tickers'][ticker] = {
                'quarters': [],
                'accuracy': {'within': 0, 'total': 0, 'pct': None}
            }

        t = hist['tickers'][ticker]
        quarters = t['quarters']

        # Update previous quarter's outcome
        if prev_quarter:
            for q in quarters:
                if q['quarter'] == prev_quarter and 'outcome' not in q:
                    actual_close = data['close']
                    lo = q['quarterly']['lower']
                    hi = q['quarterly']['upper']
                    if lo <= actual_close <= hi:
                        status = 'within'
                    elif actual_close > hi:
                        status = 'above'
                    else:
                        status = 'below'
                    q['outcome'] = {
                        'actual_close': actual_close,
                        'actual_date': data['date'],
                        'status': status,
                        'deviation_pct': round(
                            (actual_close - q['close']) / q['close'] * 100, 2
                        )
                    }
                    updated_outcomes += 1

        # Add new quarter entry (skip if already exists)
        existing = [q for q in quarters if q['quarter'] == quarter_label]
        if not existing:
            quarters.append({
                'quarter': quarter_label,
                'date': data['date'],
                'close': data['close'],
                'iv': data['iv'],
                'quarterly': data['quarterly'],
                'monthly': data['monthly']
            })
            added += 1

        # Recompute accuracy
        outcomes = [q for q in quarters if 'outcome' in q]
        hits = sum(1 for o in outcomes if o['outcome']['status'] == 'within')
        total = len(outcomes)
        t['accuracy'] = {
            'within': hits,
            'total': total,
            'pct': round(hits / total * 100) if total > 0 else None
        }

    # Recompute summary
    total_outcomes = sum(t['accuracy']['total'] for t in hist['tickers'].values())
    total_hits = sum(t['accuracy']['within'] for t in hist['tickers'].values())
    hist['summary']['total_tickers'] = len(hist['tickers'])
    hist['summary']['overall_accuracy'] = {
        'within': total_hits,
        'total': total_outcomes,
        'pct': round(total_hits / total_outcomes * 100, 1) if total_outcomes > 0 else None
    }
    hist['updated'] = datetime.datetime.now().isoformat(timespec='seconds')

    return added, updated_outcomes


def main():
    parser = argparse.ArgumentParser(description='Capture quarterly EM snapshot')
    parser.add_argument('--quarter', help='Quarter label (e.g. Q1-2026). Auto-detects if omitted.')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--port', type=int, default=4002, help='IB Gateway port')
    args = parser.parse_args()

    quarter = args.quarter or detect_quarter()
    if not quarter:
        print('ERROR: Could not detect quarter. Use --quarter Q1-2026')
        sys.exit(1)

    if quarter not in QUARTERS:
        print(f'ERROR: Unknown quarter {quarter}. Known: {list(QUARTERS.keys())}')
        sys.exit(1)

    print(f'Capturing: {quarter}')
    print(f'Target date: {QUARTERS[quarter]["date"]}')

    tickers = load_tickers()
    print(f'Tickers: {len(tickers)}')

    ib = IB()
    try:
        ib.connect('127.0.0.1', args.port, clientId=110)
        print(f'Connected to IB Gateway on port {args.port}')
    except Exception as e:
        print(f'ERROR: Cannot connect to IB Gateway: {e}')
        sys.exit(1)

    results = capture_quarter(ib, tickers, quarter)
    ib.disconnect()

    if not results:
        print('ERROR: No results captured')
        sys.exit(1)

    hist = load_history()
    added, updated_outcomes = integrate_results(hist, quarter, results)

    print(f'\nResults:')
    print(f'  New entries: {added}')
    print(f'  Updated outcomes: {updated_outcomes}')
    print(f'  Overall accuracy: {hist["summary"]["overall_accuracy"]}')
    print(f'  Quarters: {hist["summary"]["quarters"]}')

    if args.dry_run:
        print('\n[DRY RUN] Would write to:', HIST_FILE)
    else:
        with open(HIST_FILE, 'w') as f:
            json.dump(hist, f, indent=2)
        print(f'\nWritten: {HIST_FILE}')


if __name__ == '__main__':
    main()
