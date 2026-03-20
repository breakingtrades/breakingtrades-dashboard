#!/usr/bin/env python3
"""
Expected Move Calculator — Polygon.io options data

Tiers:
  daily:     Intraday futures proxies (~8 tickers) — run daily pre-market
  weekly:    Full watchlist (~70) — run Friday after close
  monthly:   Full watchlist (~70) — run Friday after close
  quarterly: Big indices + top 10 S&P (~14) — run weekly

Weekly EM  = ATM straddle close × 0.85
Daily EM   = Weekly EM / √5
Monthly EM = nearest monthly expiry straddle × 0.85
Quarterly  = nearest quarterly expiry straddle × 0.85

Usage:
  python3 update-expected-moves.py                # all tiers
  python3 update-expected-moves.py --tier daily   # daily only (fast)
  python3 update-expected-moves.py --tier weekly   # weekly + monthly
  python3 update-expected-moves.py --tier quarterly
  python3 update-expected-moves.py --ticker SPY   # single ticker debug
"""

import json, os, sys, subprocess, math, time, argparse
from datetime import datetime, timedelta
from pathlib import Path

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests', '-q'])
    import requests

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)
OUT_FILE = DATA_DIR / 'expected-moves.json'
WATCHLIST_FILE = DATA_DIR / 'watchlist.json'

# --- Ticker Tiers ---
# Daily: intraday futures proxies
DAILY_TICKERS = ['SPY', 'QQQ', 'DIA', 'IWM', 'IBIT', 'USO', 'UNG', 'GLD']

# Quarterly: big indices + top 10 S&P 500 by weight
QUARTERLY_TICKERS = [
    'SPY', 'QQQ', 'DIA', 'IWM',
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'BRK.B', 'LLY',
]

# Futures → ETF proxy mapping (for display labels)
FUTURES_PROXY = {
    'SPY': {'futures': 'ES', 'multiplier': 10},
    'QQQ': {'futures': 'NQ', 'multiplier': 40},
    'DIA': {'futures': 'YM', 'multiplier': 8.6},
    'IWM': {'futures': 'RTY', 'multiplier': 10},
    'IBIT': {'futures': 'BTC', 'note': 'spot BTC proxy'},
    'USO': {'futures': 'CL', 'note': 'crude oil proxy (imperfect, contango)'},
    'UNG': {'futures': 'NG', 'note': 'nat gas proxy (imperfect, contango)'},
    'GLD': {'futures': 'GC', 'multiplier': 18.6},
}

API_BASE = 'https://api.polygon.io'
RATE_LIMIT_DELAY = 12.5  # Free tier: 5 calls/min


def get_api_key():
    try:
        result = subprocess.run(
            ['security', 'find-generic-password', '-a', 'breakingtrades', '-s', 'polygon-api-key', '-w'],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except Exception:
        key = os.environ.get('POLYGON_API_KEY')
        if not key:
            print("ERROR: No Polygon API key", file=sys.stderr)
            sys.exit(1)
        return key


def get_watchlist_tickers():
    if WATCHLIST_FILE.exists():
        try:
            data = json.loads(WATCHLIST_FILE.read_text())
            symbols = [item.get('symbol') for item in data if item.get('symbol')]
            if symbols:
                return symbols
        except Exception:
            pass
    # Fallback
    return DAILY_TICKERS + [
        'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',
        'XLE', 'XLF', 'XLK', 'XLV', 'XLP', 'XLU', 'XLY', 'XLI', 'XLC', 'XLRE', 'XLB',
        'TLT', 'HYG', 'LQD', 'URA', 'OIH', 'COIN', 'ARM', 'DELL', 'NBIS',
    ]


def api_get(url, params, api_key):
    params['apiKey'] = api_key
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def get_prev_close(ticker, api_key):
    data = api_get(f"{API_BASE}/v2/aggs/ticker/{ticker}/prev", {}, api_key)
    if data.get('results'):
        return data['results'][0]['c']
    return None


def find_expiry(ticker, api_key, min_dte, max_dte):
    """Find nearest expiry in DTE range."""
    today = datetime.now()
    params = {
        'underlying_ticker': ticker,
        'contract_type': 'call',
        'expired': 'false',
        'expiration_date.gte': (today + timedelta(days=min_dte)).strftime('%Y-%m-%d'),
        'expiration_date.lte': (today + timedelta(days=max_dte)).strftime('%Y-%m-%d'),
        'limit': 1,
        'sort': 'expiration_date',
        'order': 'asc',
    }
    data = api_get(f"{API_BASE}/v3/reference/options/contracts", params, api_key)
    if data.get('results'):
        return data['results'][0]['expiration_date']
    return None


def build_option_ticker(underlying, expiry, strike, cp):
    """Build OCC option ticker: O:SPY260320C00660000"""
    exp_str = expiry.replace('-', '')[2:]  # YYMMDD
    strike_str = f"{int(strike * 1000):08d}"
    return f"O:{underlying}{exp_str}{cp}{strike_str}"


def get_strike_step(price):
    if price < 25:
        return 0.5
    elif price < 50:
        return 1
    elif price < 200:
        return 2.5
    elif price < 500:
        return 5
    else:
        return 10


def get_straddle_close(ticker, close_price, expiry, api_key):
    """Get ATM straddle close. Returns (straddle_price, strike) or None."""
    step = get_strike_step(close_price)
    atm_strike = round(close_price / step) * step

    strikes_to_try = [atm_strike]
    for i in range(1, 4):
        strikes_to_try.append(atm_strike + i * step)
        strikes_to_try.append(atm_strike - i * step)

    for strike in strikes_to_try:
        if strike <= 0:
            continue
        call_t = build_option_ticker(ticker, expiry, strike, 'C')
        put_t = build_option_ticker(ticker, expiry, strike, 'P')

        time.sleep(RATE_LIMIT_DELAY)
        try:
            cr = api_get(f"{API_BASE}/v2/aggs/ticker/{call_t}/prev", {}, api_key)
        except Exception:
            continue
        if not cr.get('results'):
            continue
        call_close = cr['results'][0]['c']

        time.sleep(RATE_LIMIT_DELAY)
        try:
            pr = api_get(f"{API_BASE}/v2/aggs/ticker/{put_t}/prev", {}, api_key)
        except Exception:
            continue
        if not pr.get('results'):
            continue
        put_close = pr['results'][0]['c']

        straddle = call_close + put_close
        return straddle, strike, call_close, put_close

    return None


def compute_em(straddle, close_price, dte_actual=5):
    """Compute EM from straddle. Scale to daily/weekly/monthly/quarterly."""
    em_raw = straddle * 0.85  # Expected move for that expiry

    # Scale based on actual DTE
    if dte_actual <= 0:
        dte_actual = 5
    daily_factor = 1 / math.sqrt(dte_actual)
    weekly_factor = math.sqrt(5 / dte_actual)
    monthly_factor = math.sqrt(21 / dte_actual)
    quarterly_factor = math.sqrt(63 / dte_actual)

    daily = em_raw * daily_factor
    weekly = em_raw * weekly_factor
    monthly = em_raw * monthly_factor
    quarterly = em_raw * quarterly_factor

    def band(em):
        return {
            'value': round(em, 2),
            'pct': round(em / close_price * 100, 2),
            'upper': round(close_price + em, 2),
            'lower': round(close_price - em, 2),
        }

    return {
        'daily': band(daily),
        'weekly': band(weekly),
        'monthly': band(monthly),
        'quarterly': band(quarterly),
    }


def process_ticker(ticker, api_key, tiers=None):
    """Process a single ticker. Returns dict or None."""
    if tiers is None:
        tiers = ['weekly']

    print(f"\n[{ticker}]", end=' ', flush=True)

    # Get close
    time.sleep(RATE_LIMIT_DELAY)
    close_price = get_prev_close(ticker, api_key)
    if not close_price:
        print("no close", flush=True)
        return None
    print(f"${close_price}", end=' ', flush=True)

    result = {'close': close_price, 'updated': datetime.now().isoformat()}

    # Futures proxy info
    if ticker in FUTURES_PROXY:
        result['futures_proxy'] = FUTURES_PROXY[ticker]

    # Weekly expiry straddle (base for daily/weekly)
    time.sleep(RATE_LIMIT_DELAY)
    weekly_exp = find_expiry(ticker, api_key, min_dte=0, max_dte=8)
    if weekly_exp:
        straddle_data = get_straddle_close(ticker, close_price, weekly_exp, api_key)
        if straddle_data:
            straddle, strike, call_c, put_c = straddle_data
            dte = max(1, (datetime.strptime(weekly_exp, '%Y-%m-%d') - datetime.now()).days)
            em = compute_em(straddle, close_price, dte)
            result['weekly_expiry'] = weekly_exp
            result['weekly_dte'] = dte
            result['strike'] = strike
            result['straddle'] = round(straddle, 2)
            result['call_close'] = call_c
            result['put_close'] = put_c
            result['daily'] = em['daily']
            result['weekly'] = em['weekly']
            result['monthly'] = em['monthly']
            result['quarterly'] = em['quarterly']
            print(f"straddle=${straddle:.2f} wkEM=±${em['weekly']['value']} ({em['weekly']['pct']}%)", end=' ', flush=True)
        else:
            print("no straddle", end=' ', flush=True)
            return None
    else:
        print("no weekly expiry", end=' ', flush=True)
        return None

    # Monthly expiry straddle (more accurate monthly EM)
    if 'monthly' in (tiers or []) or 'all' in (tiers or []):
        time.sleep(RATE_LIMIT_DELAY)
        monthly_exp = find_expiry(ticker, api_key, min_dte=14, max_dte=45)
        if monthly_exp:
            m_straddle = get_straddle_close(ticker, close_price, monthly_exp, api_key)
            if m_straddle:
                ms, mstrike, mc, mp = m_straddle
                mdte = max(1, (datetime.strptime(monthly_exp, '%Y-%m-%d') - datetime.now()).days)
                m_em = ms * 0.85
                result['monthly'] = {
                    'value': round(m_em, 2),
                    'pct': round(m_em / close_price * 100, 2),
                    'upper': round(close_price + m_em, 2),
                    'lower': round(close_price - m_em, 2),
                }
                result['monthly_expiry'] = monthly_exp
                result['monthly_straddle'] = round(ms, 2)
                print(f"moEM=±${m_em:.2f}", end=' ', flush=True)

    # Quarterly expiry straddle
    if ticker in QUARTERLY_TICKERS and ('quarterly' in (tiers or []) or 'all' in (tiers or [])):
        time.sleep(RATE_LIMIT_DELAY)
        q_exp = find_expiry(ticker, api_key, min_dte=45, max_dte=100)
        if q_exp:
            q_straddle = get_straddle_close(ticker, close_price, q_exp, api_key)
            if q_straddle:
                qs, qstrike, qc, qp = q_straddle
                q_em = qs * 0.85
                result['quarterly'] = {
                    'value': round(q_em, 2),
                    'pct': round(q_em / close_price * 100, 2),
                    'upper': round(close_price + q_em, 2),
                    'lower': round(close_price - q_em, 2),
                }
                result['quarterly_expiry'] = q_exp
                result['quarterly_straddle'] = round(qs, 2)
                print(f"qEM=±${q_em:.2f}", end=' ', flush=True)

    print("✓", flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description='Expected Move Calculator')
    parser.add_argument('--tier', choices=['daily', 'weekly', 'quarterly', 'all'], default='all')
    parser.add_argument('--ticker', help='Single ticker (debug mode)')
    args = parser.parse_args()

    api_key = get_api_key()
    existing = json.loads(OUT_FILE.read_text()) if OUT_FILE.exists() else {'updated': None, 'tickers': {}}

    # Determine which tickers to process
    if args.ticker:
        tickers = [args.ticker.upper()]
        tiers = ['all']
    elif args.tier == 'daily':
        tickers = DAILY_TICKERS
        tiers = ['daily']
    elif args.tier == 'weekly':
        tickers = list(set(get_watchlist_tickers()))
        tiers = ['weekly', 'monthly']
    elif args.tier == 'quarterly':
        tickers = QUARTERLY_TICKERS
        tiers = ['quarterly']
    else:  # all
        tickers = list(set(get_watchlist_tickers() + QUARTERLY_TICKERS))
        tiers = ['all']

    print(f"Tier: {args.tier} | {len(tickers)} tickers | {tiers}")
    print(f"Estimated time: ~{len(tickers) * 5 * RATE_LIMIT_DELAY / 60:.0f} min (rate limited)")

    results = existing.get('tickers', {})
    processed = 0
    errors = []

    for ticker in sorted(tickers):
        try:
            data = process_ticker(ticker, api_key, tiers)
            if data:
                # Preserve history
                history = results.get(ticker, {}).get('history', [])
                entry = {
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'close': data['close'],
                    'straddle': data.get('straddle'),
                    'weekly_em': data.get('weekly', {}).get('value'),
                    'daily_em': data.get('daily', {}).get('value'),
                }
                history = [h for h in history if h.get('date') != entry['date']]
                history.append(entry)
                data['history'] = history[-52]  # ~1yr weekly
                results[ticker] = data
                processed += 1
            else:
                errors.append(ticker)
        except Exception as e:
            print(f" ERROR: {e}", flush=True)
            errors.append(f"{ticker}: {e}")

    output = {'updated': datetime.now().isoformat(), 'tickers': results}
    OUT_FILE.write_text(json.dumps(output, indent=2))

    print(f"\n{'='*50}")
    print(f"Done: {processed}/{len(tickers)} | Saved: {OUT_FILE}")
    if errors:
        print(f"Errors: {errors}")


if __name__ == '__main__':
    main()
