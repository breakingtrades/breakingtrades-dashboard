/**
 * BreakingTrades — Futures Ticker Tape (TradingView Widget)
 * Real-time streaming prices for futures, indices, and macro.
 * 
 * Usage: Include this script, then call initTickerTape('container-id')
 * or let it auto-init on elements with id="tv-ticker-tape"
 */

function initTickerTape(containerId) {
  const el = document.getElementById(containerId || 'tv-ticker-tape');
  if (!el) return;

  const symbols = [
    // Index Futures
    { proName: "CME_MINI:ES1!", title: "S&P 500" },
    { proName: "CME_MINI:NQ1!", title: "Nasdaq 100" },
    { proName: "CBOT_MINI:YM1!", title: "Dow Jones" },
    { proName: "CME_MINI:RTY1!", title: "Russell 2000" },
    // Volatility
    { proName: "CBOE:VIX", title: "VIX" },
    // Commodities
    { proName: "NYMEX:CL1!", title: "Crude Oil" },
    { proName: "COMEX:GC1!", title: "Gold" },
    { proName: "COMEX:SI1!", title: "Silver" },
    // Rates & Dollar
    { proName: "CBOT:ZN1!", title: "10Y Note" },
    { proName: "CBOT:ZT1!", title: "2Y Note" },
    { proName: "TVC:DXY", title: "DXY" },
    // Crypto
    { proName: "COINBASE:BTCUSD", title: "Bitcoin" },
    { proName: "COINBASE:ETHUSD", title: "Ethereum" },
  ];

  const config = {
    symbols,
    showSymbolLogo: false,
    isTransparent: true,
    displayMode: "compact",
    colorTheme: "dark",
    locale: "en",
    largeChartUrl: "",
  };

  const wrapper = document.createElement('div');
  wrapper.className = 'tradingview-widget-container';
  wrapper.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
  
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
  script.async = true;
  script.textContent = JSON.stringify(config);
  
  wrapper.appendChild(script);
  el.innerHTML = '';
  el.appendChild(wrapper);
}

// Auto-init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initTickerTape());
} else {
  initTickerTape();
}
