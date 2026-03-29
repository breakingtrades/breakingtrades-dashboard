#!/usr/bin/env python3
"""
Expected Move Calculator — IB Gateway → yfinance fallback

Priority: IB Gateway (best data) → yfinance (free, no deps)
Polygon.io removed (key expired).

Tiers:
  daily:     Index/futures proxies (~8) — fast, every day
  weekly:    Full watchlist (~60-70) — Friday after close
  all:       weekly + monthly + quarterly bands

Weekly EM  = ATM straddle × 0.85
Daily EM   = Weekly EM / √5
Monthly EM = monthly-expiry straddle × 0.85 (or scaled from weekly)
Quarterly  = quarterly-expiry straddle × 0.85 (or scaled from weekly)

Usage:
  python3 update-expected-moves.py                # all tiers
  python3 update-expected-moves.py --tier daily   # daily only (fast)
  python3 update-expected-moves.py --tier weekly   # weekly + monthly
  python3 update-expected-moves.py --ticker SPY   # single ticker debug
  python3 update-expected-moves.py --source yfinance  # force yfinance
  python3 update-expected-moves.py --source ib --port 4001  # force IB live

Environment:
  IB_PORT         — IB Gateway port (default: 4002)
  BT_EM_SOURCE    — force source: ib | yfinance (default: auto)
"""

import json, os, sys, math, argparse, time
from datetime import datetime, timedelta
from pathlib import Path

# --- Paths ---
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent
DATA_DIR = REPO_DIR / 'data'
DATA_DIR.mkdir(exist_ok=True)
OUT_FILE = DATA_DIR / 'expected-moves.json'
WATCHLIST_FILE = DATA_DIR / 'watchlist.json'
PRICES_FILE = DATA_DIR / 'prices.json'

# --- Ticker Tiers ---
DAILY_TICKERS = ['SPX', 'SPY', 'QQQ', 'DIA', 'IWM', 'IBIT', 'USO', 'UNG', 'GLD']

QUARTERLY_TICKERS = [
    'SPX', 'SPY', 'QQQ', 'DIA', 'IWM',
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'LLY',
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

# yfinance symbol mapping (display name → yfinance ticker)
YF_SYMBOL_MAP = {'SPX': '^SPX'}


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


def find_expiry_in_range(expirations, min_dte, max_dte):
    """Find nearest expiry within DTE range. Prefers Fridays."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    candidates = []
    for exp in sorted(expirations):
        if isinstance(exp, str):
            # Handle both YYYYMMDD and YYYY-MM-DD formats
            exp_str = exp.replace('-', '')
            exp_date = datetime.strptime(exp_str, '%Y%m%d')
        else:
            exp_date = exp if isinstance(exp, datetime) else datetime.combine(exp, datetime.min.time())
            exp_str = exp_date.strftime('%Y%m%d')
        dte = (exp_date - today).days
        if min_dte <= dte <= max_dte:
            is_friday = exp_date.weekday() == 4
            candidates.append((exp_str, max(1, dte), is_friday))

    if not candidates:
        return None, None

    fridays = [c for c in candidates if c[2]]
    if fridays:
        return fridays[0][0], fridays[0][1]
    return candidates[0][0], candidates[0][1]


def compute_em_bands(straddle, close_price, dte):
    """Compute EM bands from straddle price, scaling by sqrt(time)."""
    em_raw = straddle * 0.85
    dte = max(1, dte)

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


# ============================================================
# Source: yfinance (free, no gateway needed)
# ============================================================

def yf_process_ticker(ticker, include_monthly=False, include_quarterly=False, canonical_prices=None):
    """Process a single ticker via yfinance options chain."""
    import yfinance as yf

    # Map display symbol to yfinance symbol (e.g. SPX → ^SPX)
    yf_symbol = YF_SYMBOL_MAP.get(ticker, ticker)

    print(f"\n[{ticker}]", end=' ', flush=True)

    # Canonical price layer is source of truth for close
    close_price = None
    price_source = None

    if canonical_prices and ticker in canonical_prices:
        close_price = canonical_prices[ticker]
        price_source = 'prices'

    if not close_price or close_price <= 0:
        try:
            t_info = yf.Ticker(yf_symbol)
            info = t_info.fast_info
            close_price = (
                info.get('regularMarketPreviousClose')
                or info.get('previousClose')
                or info.get('lastPrice')
            )
            price_source = 'yfinance'
        except Exception as e:
            pass

    if not close_price or close_price <= 0:
        print("no price", flush=True)
        return None

    print(f"${close_price:.2f} ({price_source})", end=' ', flush=True)

    try:
        t = yf.Ticker(yf_symbol)
        expirations = t.options
        if not expirations:
            print("no options", flush=True)
            return None
    except Exception:
        print("options unavailable", flush=True)
        return None

    result = {
        'close': round(close_price, 2),
        'spot': round(close_price, 2),
        'updated': datetime.now().isoformat(),
        'source': 'yfinance',
    }

    if ticker in FUTURES_PROXY:
        result['futures_proxy'] = FUTURES_PROXY[ticker]

    # --- Nearest expiry ---
    # Prefer weekly (1-8 DTE), then 0-14 DTE, then nearest monthly (up to 45 DTE)
    weekly_exp, weekly_dte = find_expiry_in_range(expirations, 1, 8)
    if not weekly_exp:
        weekly_exp, weekly_dte = find_expiry_in_range(expirations, 0, 14)
    if not weekly_exp:
        weekly_exp, weekly_dte = find_expiry_in_range(expirations, 14, 45)
    if not weekly_exp:
        print("no expiry within 45 DTE", flush=True)
        return None

    # yfinance uses YYYY-MM-DD format for option_chain()
    yf_exp = f"{weekly_exp[:4]}-{weekly_exp[4:6]}-{weekly_exp[6:8]}"

    try:
        chain = t.option_chain(yf_exp)
        calls = chain.calls
        puts = chain.puts
    except Exception as e:
        print(f"chain error: {e}", flush=True)
        return None

    # Find ATM
    atm_call = calls.iloc[(calls['strike'] - close_price).abs().argsort().iloc[0]]
    atm_put = puts.iloc[(puts['strike'] - close_price).abs().argsort().iloc[0]]

    call_price = atm_call.get('lastPrice', 0)
    put_price = atm_put.get('lastPrice', 0)

    if not call_price or not put_price or call_price <= 0 or put_price <= 0:
        # Try mid price fallback
        call_price = call_price or ((atm_call.get('bid', 0) + atm_call.get('ask', 0)) / 2)
        put_price = put_price or ((atm_put.get('bid', 0) + atm_put.get('ask', 0)) / 2)

    if not call_price or not put_price:
        print("no option prices", flush=True)
        return None

    straddle = call_price + put_price
    atm_strike = atm_call['strike']
    em = compute_em_bands(straddle, close_price, weekly_dte)

    result.update({
        'strike': atm_strike,
        'straddle': round(straddle, 2),
        'call_close': round(call_price, 2),
        'put_close': round(put_price, 2),
        'weekly_expiry': weekly_exp,
        'weekly_dte': weekly_dte,
        'daily': em['daily'],
        'weekly': em['weekly'],
        'monthly': em['monthly'],      # scaled from weekly
        'quarterly': em['quarterly'],   # scaled from weekly
    })

    # Get IV from the ATM options
    call_iv = atm_call.get('impliedVolatility', 0)
    put_iv = atm_put.get('impliedVolatility', 0)
    if call_iv and put_iv:
        result['iv'] = round((call_iv + put_iv) / 2 * 100, 1)

    print(f"K={atm_strike} C=${call_price:.2f} P=${put_price:.2f} strd=${straddle:.2f} wkEM=±${em['weekly']['value']} ({em['weekly']['pct']}%)", end=' ', flush=True)

    # --- Monthly expiry (direct straddle if available) ---
    if include_monthly:
        m_exp, m_dte = find_expiry_in_range(expirations, 14, 45)
        if m_exp:
            yf_m_exp = f"{m_exp[:4]}-{m_exp[4:6]}-{m_exp[6:8]}"
            try:
                m_chain = t.option_chain(yf_m_exp)
                m_atm_c = m_chain.calls.iloc[(m_chain.calls['strike'] - close_price).abs().argsort().iloc[0]]
                m_atm_p = m_chain.puts.iloc[(m_chain.puts['strike'] - close_price).abs().argsort().iloc[0]]
                mc = m_atm_c.get('lastPrice') or ((m_atm_c.get('bid', 0) + m_atm_c.get('ask', 0)) / 2)
                mp = m_atm_p.get('lastPrice') or ((m_atm_p.get('bid', 0) + m_atm_p.get('ask', 0)) / 2)
                if mc and mp and mc > 0 and mp > 0:
                    m_straddle = mc + mp
                    m_em = m_straddle * 0.85
                    result['monthly'] = {
                        'value': round(m_em, 2),
                        'pct': round(m_em / close_price * 100, 2),
                        'upper': round(close_price + m_em, 2),
                        'lower': round(close_price - m_em, 2),
                    }
                    result['monthly_expiry'] = m_exp
                    result['monthly_straddle'] = round(m_straddle, 2)
                    print(f"moEM=±${m_em:.2f}", end=' ', flush=True)
            except Exception:
                pass  # Keep scaled monthly from weekly

    # --- Quarterly expiry ---
    if include_quarterly and ticker in QUARTERLY_TICKERS:
        q_exp, q_dte = find_expiry_in_range(expirations, 45, 100)
        if q_exp:
            yf_q_exp = f"{q_exp[:4]}-{q_exp[4:6]}-{q_exp[6:8]}"
            try:
                q_chain = t.option_chain(yf_q_exp)
                q_atm_c = q_chain.calls.iloc[(q_chain.calls['strike'] - close_price).abs().argsort().iloc[0]]
                q_atm_p = q_chain.puts.iloc[(q_chain.puts['strike'] - close_price).abs().argsort().iloc[0]]
                qc = q_atm_c.get('lastPrice') or ((q_atm_c.get('bid', 0) + q_atm_c.get('ask', 0)) / 2)
                qp = q_atm_p.get('lastPrice') or ((q_atm_p.get('bid', 0) + q_atm_p.get('ask', 0)) / 2)
                if qc and qp and qc > 0 and qp > 0:
                    q_straddle = qc + qp
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


# ============================================================
# Source: IB Gateway
# ============================================================

def ib_connect(port, client_id=70):
    """Try to connect to IB Gateway. Returns (ib, None) or (None, error)."""
    try:
        import asyncio
        asyncio.set_event_loop(asyncio.new_event_loop())
        from ib_insync import IB
        ib = IB()
        ib.connect('127.0.0.1', port, clientId=client_id, readonly=True)
        ib.reqMarketDataType(2)  # Frozen data when market closed
        print(f"IB connected: {ib.managedAccounts()} (port {port})")
        return ib, None
    except Exception as e:
        return None, str(e)


def ib_process_ticker(ib, ticker, include_monthly=False, include_quarterly=False):
    """Process a single ticker via IB Gateway. Same logic as update-expected-moves-ib.py."""
    from ib_insync import Stock, Option
    print(f"\n[{ticker}]", end=' ', flush=True)

    stock = Stock(ticker, 'SMART', 'USD')
    try:
        ib.qualifyContracts(stock)
    except Exception:
        print("can't qualify", flush=True)
        return None

    # Get close price
    stock_ticker = ib.reqMktData(stock, '', False, False)
    ib.sleep(3)
    close_price = stock_ticker.close
    ib.cancelMktData(stock)

    if not close_price or close_price <= 0 or (isinstance(close_price, float) and math.isnan(close_price)):
        try:
            bars = ib.reqHistoricalData(stock, endDateTime='', durationStr='2 D',
                                         barSizeSetting='1 day', whatToShow='TRADES', useRTH=True)
            if bars:
                close_price = bars[-1].close
        except Exception:
            pass

    if not close_price or close_price <= 0 or (isinstance(close_price, float) and math.isnan(close_price)):
        print("no close price", flush=True)
        return None
    print(f"${close_price}", end=' ', flush=True)

    # Get option chain
    chains = ib.reqSecDefOptParams(stock.symbol, '', stock.secType, stock.conId)
    chain = max((c for c in chains if c.expirations and c.strikes), key=lambda c: len(c.expirations), default=None)

    if not chain:
        print("no chain", flush=True)
        return None

    result = {
        'close': close_price,
        'spot': close_price,
        'updated': datetime.now().isoformat(),
        'source': 'ib',
    }

    if ticker in FUTURES_PROXY:
        result['futures_proxy'] = FUTURES_PROXY[ticker]

    # Weekly expiry
    weekly_exp, weekly_dte = find_expiry_in_range(chain.expirations, 1, 8)
    if not weekly_exp:
        weekly_exp, weekly_dte = find_expiry_in_range(chain.expirations, 0, 14)
    if not weekly_exp:
        print("no weekly expiry", flush=True)
        return None

    available = sorted(chain.strikes)
    candidates = sorted(available, key=lambda s: abs(s - close_price))[:5]

    call = put = atm_strike = None
    for strike in candidates:
        c = Option(ticker, weekly_exp, strike, 'C', 'SMART')
        p = Option(ticker, weekly_exp, strike, 'P', 'SMART')
        ib.qualifyContracts(c, p)
        if c.conId and p.conId:
            call, put, atm_strike = c, p, strike
            break

    if not call or not put:
        print("can't qualify options", flush=True)
        return None

    ct = ib.reqMktData(call, '', False, False)
    pt = ib.reqMktData(put, '', False, False)
    ib.sleep(3)

    call_close = ct.close if ct.close and not math.isnan(ct.close) and ct.close > 0 else None
    put_close = pt.close if pt.close and not math.isnan(pt.close) and pt.close > 0 else None
    ib.cancelMktData(call)
    ib.cancelMktData(put)

    if not call_close:
        call_close = ct.last if ct.last and not math.isnan(ct.last) else None
    if not put_close:
        put_close = pt.last if pt.last and not math.isnan(pt.last) else None

    if not call_close or not put_close:
        print(f"no option prices", flush=True)
        return None

    straddle = call_close + put_close
    em = compute_em_bands(straddle, close_price, weekly_dte)

    result.update({
        'strike': atm_strike,
        'straddle': round(straddle, 2),
        'call_close': call_close,
        'put_close': put_close,
        'weekly_expiry': weekly_exp,
        'weekly_dte': weekly_dte,
        'daily': em['daily'],
        'weekly': em['weekly'],
        'monthly': em['monthly'],
        'quarterly': em['quarterly'],
    })

    print(f"K={atm_strike} C=${call_close} P=${put_close} strd=${straddle:.2f} wkEM=±${em['weekly']['value']} ({em['weekly']['pct']}%)", end=' ', flush=True)

    # Monthly direct straddle
    if include_monthly:
        m_exp, m_dte = find_expiry_in_range(chain.expirations, 14, 45)
        if m_exp:
            m_strike = min(available, key=lambda s: abs(s - close_price))
            mc = Option(ticker, m_exp, m_strike, 'C', 'SMART')
            mp = Option(ticker, m_exp, m_strike, 'P', 'SMART')
            try:
                ib.qualifyContracts(mc, mp)
                mct = ib.reqMktData(mc, '', False, False)
                mpt = ib.reqMktData(mp, '', False, False)
                ib.sleep(3)
                mc_c = mct.close if mct.close and not math.isnan(mct.close) and mct.close > 0 else None
                mp_c = mpt.close if mpt.close and not math.isnan(mpt.close) and mpt.close > 0 else None
                ib.cancelMktData(mc)
                ib.cancelMktData(mp)
                if mc_c and mp_c:
                    m_straddle = mc_c + mp_c
                    m_em = m_straddle * 0.85
                    result['monthly'] = {
                        'value': round(m_em, 2),
                        'pct': round(m_em / close_price * 100, 2),
                        'upper': round(close_price + m_em, 2),
                        'lower': round(close_price - m_em, 2),
                    }
                    result['monthly_expiry'] = m_exp
                    result['monthly_straddle'] = round(m_straddle, 2)
                    print(f"moEM=±${m_em:.2f}", end=' ', flush=True)
            except Exception:
                pass

    # Quarterly direct straddle
    if include_quarterly and ticker in QUARTERLY_TICKERS:
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
                qc_c = qct.close if qct.close and not math.isnan(qct.close) and qct.close > 0 else None
                qp_c = qpt.close if qpt.close and not math.isnan(qpt.close) and qpt.close > 0 else None
                ib.cancelMktData(qc)
                ib.cancelMktData(qp)
                if qc_c and qp_c:
                    q_straddle = qc_c + qp_c
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


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Expected Move Calculator (IB → yfinance)')
    parser.add_argument('--tier', choices=['daily', 'weekly', 'quarterly', 'all'], default='all')
    parser.add_argument('--ticker', help='Single ticker debug')
    parser.add_argument('--source', choices=['auto', 'ib', 'yfinance'], default='auto',
                        help='Data source (default: try IB, fallback to yfinance)')
    parser.add_argument('--port', type=int, default=int(os.environ.get('IB_PORT', 4002)),
                        help='IB Gateway port')
    parser.add_argument('--client-id', type=int, default=70)
    args = parser.parse_args()

    source = args.source if args.source != 'auto' else os.environ.get('BT_EM_SOURCE', 'auto')

    # Load existing data
    existing = json.loads(OUT_FILE.read_text()) if OUT_FILE.exists() else {'updated': None, 'tickers': {}}

    # Determine tickers and tier flags
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
        include_monthly = include_quarterly = True
    else:  # all
        tickers = list(set(get_watchlist_tickers() + QUARTERLY_TICKERS))
        include_monthly = include_quarterly = True

    # Try IB first, fallback to yfinance
    ib = None
    use_yfinance = (source == 'yfinance')

    if source in ('auto', 'ib'):
        ib, err = ib_connect(args.port, args.client_id)
        if ib:
            print(f"Source: IB Gateway (port {args.port})")
        elif source == 'ib':
            print(f"ERROR: IB Gateway required but not available: {err}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"IB Gateway not available ({err}), falling back to yfinance")
            use_yfinance = True

    if use_yfinance:
        print("Source: yfinance (free)")
        try:
            import yfinance
        except ImportError:
            import subprocess
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'yfinance', '-q'])

    print(f"Tier: {args.tier} | {len(tickers)} tickers | monthly={include_monthly} quarterly={include_quarterly}")

    # Load canonical prices (source of truth for close prices)
    canonical_prices = {}
    if PRICES_FILE.exists():
        try:
            data = json.loads(PRICES_FILE.read_text())
            for sym, info in data.items():
                if sym.startswith('_'): continue
                if isinstance(info, dict) and info.get('price'):
                    canonical_prices[sym] = info['price']
                elif isinstance(info, (int, float)) and info > 0:
                    canonical_prices[sym] = info
        except Exception:
            pass
    if WATCHLIST_FILE.exists():
        try:
            data = json.loads(WATCHLIST_FILE.read_text())
            for item in data:
                if isinstance(item, dict) and item.get('symbol') and item.get('price'):
                    if item['symbol'] not in canonical_prices:
                        canonical_prices[item['symbol']] = item['price']
        except Exception:
            pass
    print(f"Canonical prices loaded: {len(canonical_prices)} tickers")

    results = existing.get('tickers', {})
    processed = 0
    errors = []

    for ticker in sorted(tickers):
        try:
            if use_yfinance:
                data = yf_process_ticker(ticker, include_monthly, include_quarterly, canonical_prices)
            else:
                data = ib_process_ticker(ib, ticker, include_monthly, include_quarterly)

            if data:
                # Preserve history
                history = results.get(ticker, {}).get('history', [])
                entry = {
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'close': data.get('close'),
                    'straddle': data.get('straddle'),
                    'weekly_em': data.get('weekly', {}).get('value'),
                    'daily_em': data.get('daily', {}).get('value'),
                }
                history = [h for h in history if h.get('date') != entry['date']]
                history.append(entry)
                data['history'] = history[-52:]  # ~1yr weekly
                results[ticker] = data
                processed += 1
            else:
                errors.append(ticker)
        except Exception as e:
            print(f" ERROR: {e}", flush=True)
            errors.append(f"{ticker}: {e}")

    if ib:
        ib.disconnect()

    output = {
        'updated': datetime.now().isoformat(),
        'source': 'ib' if not use_yfinance else 'yfinance',
        'tier': args.tier,
        'tickers': results,
    }
    OUT_FILE.write_text(json.dumps(output, indent=2))

    print(f"\n{'='*50}")
    print(f"Done: {processed}/{len(tickers)} tickers | Source: {'yfinance' if use_yfinance else 'IB'}")
    print(f"Saved: {OUT_FILE}")
    if errors:
        print(f"Errors ({len(errors)}): {errors}")


if __name__ == '__main__':
    main()
