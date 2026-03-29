#!/usr/bin/env python3
"""
Expected Move Calculator — IB Gateway (live or paper)

Pulls ATM straddle close prices via reqMktData, calculates EM bands.

Tiers:
  daily:     Intraday proxies (~8) — ES/NQ/CL/NG via ETF options
  weekly:    Full watchlist (~70)
  monthly:   Full watchlist (~70) — uses monthly expiry straddle
  quarterly: Big indices + top 10 S&P (~14) — quarterly expiry straddle

Usage:
  python3 update-expected-moves-ib.py                # all tiers
  python3 update-expected-moves-ib.py --tier daily
  python3 update-expected-moves-ib.py --tier weekly
  python3 update-expected-moves-ib.py --tier quarterly
  python3 update-expected-moves-ib.py --ticker SPY
  python3 update-expected-moves-ib.py --port 4001    # live gateway
"""

import asyncio, json, os, sys, math, argparse, time
from datetime import datetime, timedelta
from pathlib import Path

asyncio.set_event_loop(asyncio.new_event_loop())
from ib_insync import *

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)
OUT_FILE = DATA_DIR / 'expected-moves.json'
WATCHLIST_FILE = DATA_DIR / 'watchlist.json'
PRICES_FILE = DATA_DIR / 'prices.json'

# --- Ticker Tiers ---
DAILY_TICKERS = ['SPY', 'QQQ', 'DIA', 'IWM', 'IBIT', 'USO', 'UNG', 'GLD']

QUARTERLY_TICKERS = [
    'SPY', 'QQQ', 'DIA', 'IWM',
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'AVGO', 'BRK B', 'LLY',
]

FUTURES_PROXY = {
    'SPY': {'futures': 'ES', 'multiplier': 10},
    'QQQ': {'futures': 'NQ', 'multiplier': 40},
    'DIA': {'futures': 'YM', 'multiplier': 8.6},
    'IWM': {'futures': 'RTY', 'multiplier': 10},
    'IBIT': {'futures': 'BTC', 'note': 'spot BTC proxy'},
    'USO': {'futures': 'CL', 'note': 'crude oil proxy'},
    'UNG': {'futures': 'NG', 'note': 'nat gas proxy'},
    'GLD': {'futures': 'GC', 'multiplier': 18.6},
}

DEFAULT_PORT = 4002  # Live account


def load_canonical_prices():
    """Load close prices from canonical price layer (prices.json → watchlist.json fallback).
    This is the single source of truth for close prices — never use IB reqMktData for close."""
    prices = {}

    # Primary: prices.json (bt-prices canonical layer)
    if PRICES_FILE.exists():
        try:
            data = json.loads(PRICES_FILE.read_text())
            for sym, info in data.items():
                if sym.startswith('_'):
                    continue
                if isinstance(info, dict) and info.get('price'):
                    prices[sym] = info['price']
                elif isinstance(info, (int, float)) and info > 0:
                    prices[sym] = info
        except Exception:
            pass

    # Fallback: watchlist.json (yfinance prices)
    if WATCHLIST_FILE.exists():
        try:
            data = json.loads(WATCHLIST_FILE.read_text())
            for item in data:
                if isinstance(item, dict) and item.get('symbol') and item.get('price'):
                    sym = item['symbol']
                    if sym not in prices:  # prices.json takes priority
                        prices[sym] = item['price']
        except Exception:
            pass

    return prices


def get_watchlist_tickers():
    if WATCHLIST_FILE.exists():
        try:
            data = json.loads(WATCHLIST_FILE.read_text())
            return [item['symbol'] for item in data if item.get('symbol')]
        except Exception:
            pass
    return DAILY_TICKERS + [
        'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',
        'XLE', 'XLF', 'XLK', 'XLV', 'XLP', 'XLU', 'XLY', 'XLI', 'XLC', 'XLRE', 'XLB',
        'TLT', 'HYG', 'LQD', 'URA', 'OIH', 'COIN', 'ARM', 'DELL', 'NBIS',
    ]


def get_strike_step(price):
    if price < 25: return 0.5
    if price < 50: return 1
    if price < 200: return 2.5
    if price < 500: return 5
    return 10


def find_expiry_in_range(expirations, min_dte, max_dte):
    """Find nearest expiry within DTE range. Prefers Fridays. Uses date-only comparison."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    candidates = []
    for exp in sorted(expirations):
        exp_date = datetime.strptime(exp, '%Y%m%d')
        dte = (exp_date - today).days
        if min_dte <= dte <= max_dte:
            is_friday = exp_date.weekday() == 4
            candidates.append((exp, max(1, dte), is_friday))

    if not candidates:
        return None, None

    # Prefer Friday expirations, then nearest
    fridays = [c for c in candidates if c[2]]
    if fridays:
        return fridays[0][0], fridays[0][1]
    return candidates[0][0], candidates[0][1]


def compute_em_from_straddle(straddle, close_price, dte):
    """Compute EM bands from straddle price and DTE."""
    em_raw = straddle * 0.85
    if dte <= 0:
        dte = 1

    def band(target_dte):
        scaled = em_raw * math.sqrt(target_dte / dte)
        return {
            'value': round(scaled, 2),
            'pct': round(scaled / close_price * 100, 2),
            'upper': round(close_price + scaled, 2),
            'lower': round(close_price - scaled, 2),
        }

    return {
        'daily': band(1),
        'weekly': band(5),
        'monthly': band(21),
        'quarterly': band(63),
    }


def process_ticker(ib, ticker, include_monthly=False, include_quarterly=False, canonical_prices=None):
    """Process a single ticker. Returns dict or None."""
    print(f"\n[{ticker}]", end=' ', flush=True)

    # Qualify underlying
    stock = Stock(ticker, 'SMART', 'USD')
    try:
        ib.qualifyContracts(stock)
    except Exception:
        print("can't qualify", flush=True)
        return None

    # Get close price — canonical prices.json/watchlist.json is source of truth
    close_price = None
    price_source = None

    if canonical_prices and ticker in canonical_prices:
        close_price = canonical_prices[ticker]
        price_source = 'prices'

    if not close_price or close_price <= 0:
        # Fallback 1: IB historical bar (most recent trading day close)
        try:
            bars = ib.reqHistoricalData(stock, endDateTime='', durationStr='2 D',
                                         barSizeSetting='1 day', whatToShow='TRADES', useRTH=True)
            if bars:
                close_price = bars[-1].close
                price_source = 'ib-hist'
        except Exception:
            pass

    if not close_price or close_price <= 0:
        # Fallback 2: IB market data (may be stale after hours)
        stock_ticker = ib.reqMktData(stock, '', False, False)
        ib.sleep(3)
        close_price = stock_ticker.close
        ib.cancelMktData(stock)
        price_source = 'ib-mkt'

    if not close_price or close_price <= 0 or (isinstance(close_price, float) and math.isnan(close_price)):
        print("no close price", flush=True)
        return None
    print(f"${close_price} ({price_source})", end=' ', flush=True)

    # Get option chain — pick exchange with most expirations
    chains = ib.reqSecDefOptParams(stock.symbol, '', stock.secType, stock.conId)
    chain = None
    best_count = 0
    for c in chains:
        if c.expirations and c.strikes:
            exp_count = len(c.expirations)
            if exp_count > best_count:
                best_count = exp_count
                chain = c

    if not chain or not chain.expirations or not chain.strikes:
        print("no chain", flush=True)
        return None

    result = {
        'close': close_price,
        'updated': datetime.now().isoformat(),
        'source': 'ib',
        'price_source': price_source,
    }

    if ticker in FUTURES_PROXY:
        result['futures_proxy'] = FUTURES_PROXY[ticker]

    # --- Nearest expiry straddle ---
    # Prefer weekly (1-8 DTE), then 0-14 DTE, then nearest monthly (up to 45 DTE)
    weekly_exp, weekly_dte = find_expiry_in_range(chain.expirations, 1, 8)
    if not weekly_exp:
        weekly_exp, weekly_dte = find_expiry_in_range(chain.expirations, 0, 14)
    if not weekly_exp:
        weekly_exp, weekly_dte = find_expiry_in_range(chain.expirations, 14, 45)
    if not weekly_exp:
        print("no expiry within 45 DTE", flush=True)
        return None

    step = get_strike_step(close_price)
    atm_strike = round(close_price / step) * step

    # Find ATM strike — try nearest strikes until one qualifies
    available = sorted(chain.strikes)
    candidates = sorted(available, key=lambda s: abs(s - close_price))[:5]

    call = put = None
    atm_strike = None
    for strike in candidates:
        c = Option(ticker, weekly_exp, strike, 'C', 'SMART')
        p = Option(ticker, weekly_exp, strike, 'P', 'SMART')
        qualified = ib.qualifyContracts(c, p)
        if c.conId and p.conId:
            call, put = c, p
            atm_strike = strike
            break

    if not call or not put:
        print(f"can't qualify options (tried {candidates})", flush=True)
        return None

    ct = ib.reqMktData(call, '', False, False)
    pt = ib.reqMktData(put, '', False, False)
    ib.sleep(3)

    call_close = ct.close if ct.close and not math.isnan(ct.close) and ct.close > 0 else None
    put_close = pt.close if pt.close and not math.isnan(pt.close) and pt.close > 0 else None
    ib.cancelMktData(call)
    ib.cancelMktData(put)

    if not call_close or not put_close:
        # Try last price as fallback
        call_close = call_close or (ct.last if ct.last and not math.isnan(ct.last) else None)
        put_close = put_close or (pt.last if pt.last and not math.isnan(pt.last) else None)

    if not call_close or not put_close:
        print(f"no option prices (C={ct.close}/{ct.last}, P={pt.close}/{pt.last})", flush=True)
        return None

    straddle = call_close + put_close
    dte = max(1, weekly_dte)
    em = compute_em_from_straddle(straddle, close_price, dte)

    result.update({
        'strike': atm_strike,
        'straddle': round(straddle, 2),
        'call_close': call_close,
        'put_close': put_close,
        'weekly_expiry': weekly_exp,
        'weekly_dte': dte,
        'daily': em['daily'],
        'weekly': em['weekly'],
        'monthly': em['monthly'],
        'quarterly': em['quarterly'],
    })
    print(f"K={atm_strike} C=${call_close} P=${put_close} strd=${straddle:.2f} wkEM=±${em['weekly']['value']} ({em['weekly']['pct']}%)", end=' ', flush=True)

    # --- Monthly expiry straddle (direct, more accurate) ---
    if include_monthly:
        monthly_exp, monthly_dte = find_expiry_in_range(chain.expirations, 14, 45)
        if monthly_exp:
            m_strike = min(available, key=lambda s: abs(s - close_price))
            mc = Option(ticker, monthly_exp, m_strike, 'C', 'SMART')
            mp = Option(ticker, monthly_exp, m_strike, 'P', 'SMART')
            try:
                ib.qualifyContracts(mc, mp)
                mct = ib.reqMktData(mc, '', False, False)
                mpt = ib.reqMktData(mp, '', False, False)
                ib.sleep(3)
                mc_close = mct.close if mct.close and not math.isnan(mct.close) and mct.close > 0 else None
                mp_close = mpt.close if mpt.close and not math.isnan(mpt.close) and mpt.close > 0 else None
                ib.cancelMktData(mc)
                ib.cancelMktData(mp)
                if mc_close and mp_close:
                    m_straddle = mc_close + mp_close
                    m_em = m_straddle * 0.85
                    result['monthly'] = {
                        'value': round(m_em, 2),
                        'pct': round(m_em / close_price * 100, 2),
                        'upper': round(close_price + m_em, 2),
                        'lower': round(close_price - m_em, 2),
                    }
                    result['monthly_expiry'] = monthly_exp
                    result['monthly_straddle'] = round(m_straddle, 2)
                    print(f"moEM=±${m_em:.2f}", end=' ', flush=True)
            except Exception:
                pass

    # --- Quarterly expiry straddle ---
    if include_quarterly and ticker.replace(' ', '') in [t.replace(' ', '') for t in QUARTERLY_TICKERS]:
        q_exp, q_dte = find_expiry_in_range(chain.expirations, 45, 100)
        if q_exp:
            q_strike = min(available, key=lambda s: abs(s - close_price))
            qc = Option(ticker, q_exp, q_strike, 'C', 'SMART')
            qp = Option(ticker, q_exp, q_strike, 'P', 'SMART')
            try:
                ib.qualifyContracts(qc, qp)
                qct = ib.reqMktData(qc, '', False, False)
                qpt = ib.reqMktData(qp, '', False, False)
                ib.sleep(3)
                qc_close = qct.close if qct.close and not math.isnan(qct.close) and qct.close > 0 else None
                qp_close = qpt.close if qpt.close and not math.isnan(qpt.close) and qpt.close > 0 else None
                ib.cancelMktData(qc)
                ib.cancelMktData(qp)
                if qc_close and qp_close:
                    q_straddle = qc_close + qp_close
                    q_em = q_straddle * 0.85
                    result['quarterly'] = {
                        'value': round(q_em, 2),
                        'pct': round(q_em / close_price * 100, 2),
                        'upper': round(close_price + q_em, 2),
                        'lower': round(close_price - q_em, 2),
                    }
                    result['quarterly_expiry'] = q_exp
                    result['quarterly_straddle'] = round(q_straddle, 2)
                    print(f"qEM=±${q_em:.2f}", end=' ', flush=True)
            except Exception:
                pass

    print("✓", flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description='Expected Move Calculator (IB)')
    parser.add_argument('--tier', choices=['daily', 'weekly', 'quarterly', 'all'], default='all')
    parser.add_argument('--ticker', help='Single ticker debug')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='IB Gateway port (4001=live, 4002=paper)')
    parser.add_argument('--client-id', type=int, default=70)
    args = parser.parse_args()

    # Connect
    ib = IB()
    try:
        ib.connect('127.0.0.1', args.port, clientId=args.client_id, readonly=True)
    except Exception as e:
        print(f"ERROR: Can't connect to IB Gateway on port {args.port}: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"Connected: {ib.managedAccounts()} (port {args.port})")

    # Use frozen market data (type 2) — returns last close when market is closed
    ib.reqMarketDataType(2)

    # Load canonical prices (source of truth for close prices)
    canonical_prices = load_canonical_prices()
    print(f"Canonical prices loaded: {len(canonical_prices)} tickers")

    # Load existing
    existing = json.loads(OUT_FILE.read_text()) if OUT_FILE.exists() else {'updated': None, 'tickers': {}}

    # Determine tickers
    if args.ticker:
        tickers = [args.ticker.upper()]
        include_monthly = include_quarterly = True
    elif args.tier == 'daily':
        tickers = DAILY_TICKERS
        include_monthly = include_quarterly = False
    elif args.tier == 'weekly':
        tickers = list(set(get_watchlist_tickers()))
        include_monthly = True
        include_quarterly = False
    elif args.tier == 'quarterly':
        tickers = QUARTERLY_TICKERS
        include_monthly = True
        include_quarterly = True
    else:  # all
        tickers = list(set(get_watchlist_tickers() + QUARTERLY_TICKERS))
        include_monthly = True
        include_quarterly = True

    print(f"Tier: {args.tier} | {len(tickers)} tickers | monthly={include_monthly} quarterly={include_quarterly}")

    results = existing.get('tickers', {})
    processed = 0
    errors = []

    for ticker in sorted(tickers):
        try:
            data = process_ticker(ib, ticker, include_monthly, include_quarterly, canonical_prices)
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
                data['history'] = history[-52:]
                results[ticker] = data
                processed += 1
            else:
                errors.append(ticker)
        except Exception as e:
            print(f" ERROR: {e}", flush=True)
            errors.append(f"{ticker}: {e}")

    ib.disconnect()

    # Derive SPX from SPY (SPX = SPY × 10, index not directly tradeable on IB)
    if 'SPY' in results:
        spy = results['SPY']
        spx_close = round(spy['close'] * 10, 2)
        spx = {
            'close': spx_close,
            'updated': spy['updated'],
            'source': 'derived_from_spy',
            'price_source': 'spy_x10',
            'strike': round(spy.get('strike', 0) * 10, 2),
            'straddle': round(spy.get('straddle', 0) * 10, 2),
            'call_close': round(spy.get('call_close', 0) * 10, 2),
            'put_close': round(spy.get('put_close', 0) * 10, 2),
            'weekly_expiry': spy.get('weekly_expiry'),
            'weekly_dte': spy.get('weekly_dte'),
        }
        for tier in ['daily', 'weekly', 'monthly', 'quarterly']:
            if tier in spy:
                spx[tier] = {
                    'value': round(spy[tier]['value'] * 10, 2),
                    'pct': spy[tier]['pct'],
                    'upper': round(spx_close + spy[tier]['value'] * 10, 2),
                    'lower': round(spx_close - spy[tier]['value'] * 10, 2),
                }
        if spy.get('monthly_expiry'):
            spx['monthly_expiry'] = spy['monthly_expiry']
            spx['monthly_straddle'] = round(spy.get('monthly_straddle', 0) * 10, 2)
        if spy.get('quarterly_expiry'):
            spx['quarterly_expiry'] = spy['quarterly_expiry']
            spx['quarterly_straddle'] = round(spy.get('quarterly_straddle', 0) * 10, 2)
        # Preserve history
        history = results.get('SPX', {}).get('history', [])
        entry = {'date': datetime.now().strftime('%Y-%m-%d'), 'close': spx_close,
                 'straddle': spx.get('straddle'), 'weekly_em': spx.get('weekly', {}).get('value'),
                 'daily_em': spx.get('daily', {}).get('value')}
        history = [h for h in history if h.get('date') != entry['date']]
        history.append(entry)
        spx['history'] = history[-52:]
        results['SPX'] = spx
        print(f"\n[SPX] derived from SPY: ${spx_close} wkEM=±${spx['weekly']['value']} ({spx['weekly']['pct']}%)")

    output = {'updated': datetime.now().isoformat(), 'tickers': results}
    OUT_FILE.write_text(json.dumps(output, indent=2))

    print(f"\n{'='*50}")
    print(f"Done: {processed}/{len(tickers)} | Saved: {OUT_FILE}")
    if errors:
        print(f"Errors ({len(errors)}): {errors}")


if __name__ == '__main__':
    main()
