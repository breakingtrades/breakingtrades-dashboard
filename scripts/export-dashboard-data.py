#!/usr/bin/env python3
"""
export-dashboard-data.py
Pulls yfinance data for all watchlist symbols, computes SMAs/status/bias,
and outputs JSON files for the dashboard to consume.
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
import sys
from datetime import datetime, timezone
import requests

# Set working directory to project root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Define full 70+ symbol watchlist
WATCHLIST = [
  # Quality Stocks
  {'symbol':'AAPL', 'name':'Apple', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'MSFT', 'name':'Microsoft', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'NVDA', 'name':'NVIDIA', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'GOOGL', 'name':'Alphabet', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'AMZN', 'name':'Amazon', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'META', 'name':'Meta', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'DELL', 'name':'Dell', 'sector':'Technology', 'group':'Quality Stocks'},
  {'symbol':'COIN', 'name':'Coinbase', 'sector':'Financials', 'group':'Quality Stocks'},
  {'symbol':'ARM', 'name':'ARM Holdings', 'sector':'Technology', 'group':'Quality Stocks'},
  
  # Healthcare
  {'symbol':'PFE', 'name':'Pfizer', 'sector':'Healthcare', 'group':'Healthcare'},
  {'symbol':'ABBV', 'name':'AbbVie', 'sector':'Healthcare', 'group':'Healthcare'},
  {'symbol':'DHR', 'name':'Danaher', 'sector':'Healthcare', 'group':'Healthcare'},
  {'symbol':'SYK', 'name':'Stryker', 'sector':'Healthcare', 'group':'Healthcare'},
  {'symbol':'RVTY', 'name':'Revvity', 'sector':'Healthcare', 'group':'Healthcare'},
  {'symbol':'TMO', 'name':'Thermo Fisher', 'sector':'Healthcare', 'group':'Healthcare'},
  {'symbol':'GKOS', 'name':'Glaukos', 'sector':'Healthcare', 'group':'Healthcare'},
  
  # Sector ETFs
  {'symbol':'XLU', 'name':'Utilities', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLK', 'name':'Technology', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLE', 'name':'Energy', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLV', 'name':'Healthcare', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLF', 'name':'Financials', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLP', 'name':'Staples', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLY', 'name':'Discretionary', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLI', 'name':'Industrials', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLC', 'name':'Communication', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLB', 'name':'Materials', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'XLRE', 'name':'Real Estate', 'sector':'ETF', 'group':'Sector ETFs'},
  {'symbol':'IBIT', 'name':'Bitcoin', 'sector':'Crypto', 'group':'Sector ETFs'},
  
  # Macro / Index
  {'symbol':'SPY', 'name':'S&P 500', 'sector':'Index', 'group':'Macro / Index'},
  {'symbol':'QQQ', 'name':'Nasdaq 100', 'sector':'Index', 'group':'Macro / Index'},
  {'symbol':'IWM', 'name':'Russell 2000', 'sector':'Index', 'group':'Macro / Index'},
  {'symbol':'DIA', 'name':'Dow 30', 'sector':'Index', 'group':'Macro / Index'},
  {'symbol':'HYG', 'name':'High Yield Bond', 'sector':'Bond', 'group':'Macro / Index'},
  {'symbol':'TLT', 'name':'20+ Year Treasury', 'sector':'Bond', 'group':'Macro / Index'},
  {'symbol':'LQD', 'name':'Corp Bond', 'sector':'Bond', 'group':'Macro / Index'},
  
  # Energy & Commodities
  {'symbol':'AR', 'name':'Antero Resources', 'sector':'Energy', 'group':'Energy & Commodities'},
  {'symbol':'OIH', 'name':'Oil Services', 'sector':'Energy', 'group':'Energy & Commodities'},
  {'symbol':'SM', 'name':'SM Energy', 'sector':'Energy', 'group':'Energy & Commodities'},
  {'symbol':'URA', 'name':'Uranium', 'sector':'Energy', 'group':'Energy & Commodities'},
  {'symbol':'BE', 'name':'Bloom Energy', 'sector':'Clean Energy', 'group':'Energy & Commodities'},
  {'symbol':'AA', 'name':'Alcoa', 'sector':'Materials', 'group':'Energy & Commodities'},
  
  # Community Ideas
  {'symbol':'MOO', 'name':'Agribusiness', 'sector':'Agriculture', 'group':'Community Ideas'},
  {'symbol':'NEE', 'name':'NextEra Energy', 'sector':'Utilities', 'group':'Community Ideas'},
  {'symbol':'TGT', 'name':'Target', 'sector':'Retail', 'group':'Community Ideas'},
  {'symbol':'D', 'name':'Dominion Energy', 'sector':'Utilities', 'group':'Community Ideas'},
  {'symbol':'TMUS', 'name':'T-Mobile', 'sector':'Telecom', 'group':'Community Ideas'},
  {'symbol':'AWK', 'name':'American Water', 'sector':'Utilities', 'group':'Community Ideas'},
  {'symbol':'ADM', 'name':'Archer-Daniels', 'sector':'Agriculture', 'group':'Community Ideas'},
  {'symbol':'OMC', 'name':'Omnicom', 'sector':'Communication', 'group':'Community Ideas'},
  {'symbol':'CHTR', 'name':'Charter', 'sector':'Communication', 'group':'Community Ideas'},
  {'symbol':'ADSK', 'name':'Autodesk', 'sector':'Technology', 'group':'Community Ideas'},
  {'symbol':'ZM', 'name':'Zoom Video', 'sector':'Technology', 'group':'Community Ideas'},
  {'symbol':'TAP', 'name':'Molson Coors', 'sector':'Staples', 'group':'Community Ideas'},
  {'symbol':'CAG', 'name':'ConAgra', 'sector':'Staples', 'group':'Community Ideas'},
  {'symbol':'IGV', 'name':'Software ETF', 'sector':'Technology', 'group':'Community Ideas'},
  {'symbol':'IFF', 'name':'Intl Flavors', 'sector':'Materials', 'group':'Community Ideas'},
  {'symbol':'BILI', 'name':'Bilibili', 'sector':'Communication', 'group':'Community Ideas'},
  {'symbol':'STO.AX', 'name':'Santos', 'sector':'Energy', 'group':'Community Ideas'},
  {'symbol':'BJ', 'name':'BJs Wholesale', 'sector':'Staples', 'group':'Community Ideas'},
  {'symbol':'CP', 'name':'Canadian Pacific', 'sector':'Industrials', 'group':'Community Ideas'},
  {'symbol':'UNP', 'name':'Union Pacific', 'sector':'Industrials', 'group':'Community Ideas'},
  {'symbol':'ACI', 'name':'Albertsons', 'sector':'Staples', 'group':'Community Ideas'},
  {'symbol':'KHC', 'name':'Kraft Heinz', 'sector':'Staples', 'group':'Community Ideas'},
  {'symbol':'BYD', 'name':'Boyd Gaming', 'sector':'Discretionary', 'group':'Community Ideas'},
  {'symbol':'KMB', 'name':'Kimberly-Clark', 'sector':'Staples', 'group':'Community Ideas'},
  {'symbol':'S', 'name':'SentinelOne', 'sector':'Technology', 'group':'Community Ideas'},
  {'symbol':'UPS', 'name':'UPS', 'sector':'Industrials', 'group':'Community Ideas'},
  {'symbol':'NBIS', 'name':'Nebius Group', 'sector':'Technology', 'group':'Community Ideas'}
]

def get_fear_greed():
    """Fetch CNN Fear and Greed index directly from CNN API."""
    print("Fetching Fear & Greed...")
    try:
        ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
        r = requests.get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
                         headers={'User-Agent': ua}, timeout=10)
        r.raise_for_status()
        fg = r.json().get('fear_and_greed', {})
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
        return {
            "current": entry(fg.get('score')),
            "previousClose": entry(fg.get('previous_close')),
            "oneWeekAgo": entry(fg.get('previous_1_week')),
            "oneMonthAgo": entry(fg.get('previous_1_month')),
            "oneYearAgo": entry(fg.get('previous_1_year')),
            "updated": datetime.now(timezone.utc).isoformat(),
            "source": "cnn"
        }
    except Exception as e:
        print(f"Error fetching F&G: {e}")
        return None

def compute_metrics(symbol_data):
    """Compute SMAs, Bias, and Status from historical dataframe."""
    df = symbol_data.copy()
    if len(df) < 50:
        return None
        
    price = df['Close'].iloc[-1]
    prev_price = df['Close'].iloc[-2]
    change_pct = ((price - prev_price) / prev_price) * 100
    
    df['SMA20'] = df['Close'].rolling(window=20).mean()
    df['SMA50'] = df['Close'].rolling(window=50).mean()
    df['SMA200'] = df['Close'].rolling(window=200).mean()
    
    sma20 = df['SMA20'].iloc[-1]
    sma50 = df['SMA50'].iloc[-1]
    sma200 = df['SMA200'].iloc[-1]
    
    # Weekly approximation
    wk_df = df.resample('W').last()
    wk_df['W20'] = wk_df['Close'].rolling(window=20).mean()
    if len(wk_df) > 0 and not np.isnan(wk_df['W20'].iloc[-1]):
        w20 = wk_df['W20'].iloc[-1]
    else:
        w20 = sma20 # fallback
        
    # Bias logic
    if price > sma20 and price > sma50 and price > w20:
        bias = "bull"
    elif price < sma20 and price < sma50 and price < w20:
        bias = "bear"
    else:
        bias = "mixed"
        
    # Status logic (simplified for V2)
    dist20 = (price - sma20) / sma20
    dist50 = (price - sma50) / sma50
    
    if price < sma20 and prev_price >= df['SMA20'].iloc[-2]:
        status = "exit"
    elif abs(dist20) < 0.02 or abs(dist50) < 0.02:
        # Near a major moving average
        if (price > sma20 and prev_price <= df['SMA20'].iloc[-2]) or (price > sma50 and prev_price <= df['SMA50'].iloc[-2]):
            status = "triggered"
        else:
            status = "approaching"
    elif bias == "bull" and price > sma20 * 1.05:
        status = "active" # Extended above 20
    elif bias == "bull":
        status = "watching"
    else:
        status = "watching"
        
    return {
        "price": float(price),
        "change": float(change_pct),
        "sma20": float(sma20),
        "sma50": float(sma50),
        "sma200": float(sma200) if not np.isnan(sma200) else float(sma50),
        "w20": float(w20),
        "bias": bias,
        "status": status,
        "updated": datetime.now(timezone.utc).isoformat()
    }

def main():
    print("Starting BreakingTrades Data Pipeline...")
    symbols_list = [item['symbol'] for item in WATCHLIST]
    
    # Clean up Yahoo formats (e.g. STO.AX, but mostly standard)
    yf_symbols = []
    for s in symbols_list:
        if s == 'BRK.B': yf_symbols.append('BRK-B')
        else: yf_symbols.append(s)
        
    print(f"Downloading daily data for {len(yf_symbols)} symbols...")
    
    # We need to make sure we download pairs that aren't in the watchlist
    extra_pairs = ['RSP', 'SLV', 'GLD']
    all_symbols = list(set(yf_symbols + extra_pairs))
    
    data = yf.download(tickers=all_symbols, period="1y", interval="1d", group_by="ticker", auto_adjust=True, prepost=False, threads=True)
    
    results = []
    
    for i, item in enumerate(WATCHLIST):
        sym = item['symbol']
        yf_sym = 'BRK-B' if sym == 'BRK.B' else sym
        
        try:
            if len(symbols_list) == 1:
                df = data
            else:
                df = data[yf_sym].dropna()
                
            if len(df) < 50:
                print(f"Not enough data for {sym}, skipping")
                continue
                
            metrics = compute_metrics(df)
            if metrics:
                entry = item.copy()
                entry.update(metrics)
                # Keep float precision clean
                entry['price'] = round(entry['price'], 2)
                entry['change'] = round(entry['change'], 2)
                entry['sma20'] = round(entry['sma20'], 2)
                entry['sma50'] = round(entry['sma50'], 2)
                results.append(entry)
        except Exception as e:
            print(f"Error processing {sym}: {e}")
            
    print(f"Processed {len(results)} symbols successfully.")
    
    # Build Pairs
    pairs = [
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
        {"pair": "IGV/QQQ", "desc": "Software vs Broad Tech"}
    ]
    
    pair_results = []
    for p in pairs:
        num, den = p['pair'].split('/')
        try:
            ndf = data[num].dropna()
            ddf = data[den].dropna()
            
            # Align dates
            common_idx = ndf.index.intersection(ddf.index)
            if len(common_idx) > 20:
                ratio = ndf.loc[common_idx, 'Close'] / ddf.loc[common_idx, 'Close']
                r_sma20 = ratio.rolling(20).mean().iloc[-1]
                r_curr = ratio.iloc[-1]
                
                if r_curr > r_sma20 * 1.01:
                    signal, color = "↗ RISING", "up"
                elif r_curr < r_sma20 * 0.99:
                    signal, color = "↘ FALLING", "down"
                else:
                    signal, color = "→ FLAT", "neutral"
                    
                pair_results.append({
                    "pair": p['pair'],
                    "desc": p['desc'],
                    "signal": signal,
                    "color": color
                })
        except Exception as e:
            print(f"Error computing pair {p['pair']}: {e}")
            
    # Build Sector Strength (momentum proxy: % above 50SMA)
    sectors = ['XLU','XLE','XLP','XLRE','XLV','XLB','XLI','XLF','XLC','XLY','XLK','IBIT']
    sector_scores = []
    for s in sectors:
        try:
            df = data[s].dropna()
            if len(df) > 50:
                price = df['Close'].iloc[-1]
                sma50 = df['Close'].rolling(50).mean().iloc[-1]
                pct_diff = ((price - sma50) / sma50) * 100
                
                # 30 day change
                price30 = df['Close'].iloc[-21] if len(df) > 21 else df['Close'].iloc[0]
                chg30 = ((price - price30) / price30) * 100
                
                sector_scores.append({
                    "symbol": s,
                    "name": next((i['name'] for i in WATCHLIST if i['symbol'] == s), s),
                    "change": round(chg30, 1),
                    "rs": round(pct_diff * 10, 1) # Amplified for bar width
                })
        except Exception as e:
            pass
            
    # Sort by strength
    sector_scores = sorted(sector_scores, key=lambda x: x['rs'], reverse=True)
    
    # Save outputs
    with open(os.path.join(DATA_DIR, "watchlist.json"), "w") as f:
        json.dump(results, f, indent=2)
        
    with open(os.path.join(DATA_DIR, "pairs.json"), "w") as f:
        json.dump(pair_results, f, indent=2)
        
    with open(os.path.join(DATA_DIR, "sectors.json"), "w") as f:
        json.dump(sector_scores, f, indent=2)
        
    fg = get_fear_greed()
    if fg:
        with open(os.path.join(DATA_DIR, "fear-greed.json"), "w") as f:
            json.dump(fg, f, indent=2)
            
    # Process VIX
    try:
        vix_data = yf.download("^VIX", period="1y", interval="1d")
        if len(vix_data) > 50:
            v_curr = vix_data['Close'].iloc[-1].item()
            v_sma20 = vix_data['Close'].rolling(20).mean().iloc[-1].item()
            v_sma50 = vix_data['Close'].rolling(50).mean().iloc[-1].item()
            v_hist = vix_data['Close'].iloc[-30:].values
            v_pctile = int(np.sum(v_hist < v_curr) / len(v_hist) * 100)
            
            if v_curr < 15:
                regime = "Complacency"
                color = "#00d4aa"
            elif v_curr < 20:
                regime = "Normal"
                color = "#8bc34a"
            elif v_curr < 30:
                regime = "Elevated"
                color = "#ffa726"
            elif v_curr < 40:
                regime = "Fear"
                color = "#ef5350"
            else:
                regime = "Panic"
                color = "#d32f2f"
                
            desc = f"VIX is {regime.lower()}. "
            if v_curr > v_sma20:
                desc += f"Trending above SMA20 ({v_sma20:.2f}), showing rising volatility."
            else:
                desc += f"Trending below SMA20 ({v_sma20:.2f}), volatility is contracting."
                
            vix_out = {
                "current": round(v_curr, 2),
                "sma20": round(v_sma20, 2),
                "sma50": round(v_sma50, 2),
                "percentile30d": v_pctile,
                "regime": regime,
                "color": color,
                "description": desc
            }
            with open(os.path.join(DATA_DIR, "vix.json"), "w") as f:
                json.dump(vix_out, f, indent=2)
    except Exception as e:
        print(f"Error processing VIX: {e}")
            
    # Also write a meta/status file
    meta = {
        "last_run": datetime.now(timezone.utc).isoformat(),
        "symbols_processed": len(results)
    }
    with open(os.path.join(DATA_DIR, "status.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print("Pipeline complete. Output written to data/ directory.")

    # Export sector rotation data (RRG)
    try:
        import subprocess
        sr_script = os.path.join(os.path.dirname(__file__), "export-sector-rotation.py")
        if os.path.exists(sr_script):
            subprocess.run([sys.executable, sr_script], check=True)
            print("Sector rotation export complete.")
    except Exception as e:
        print(f"Error exporting sector rotation: {e}")

if __name__ == "__main__":
    main()