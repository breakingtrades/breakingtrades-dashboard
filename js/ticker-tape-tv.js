/**
 * ticker-tape-tv.js — TradingView real-time ticker tape widget
 * Injects compact ticker tape after <nav id="nav"> on every page.
 * Shared across all dashboard pages via a single <script> tag.
 */
(function () {
  'use strict';

  const SYMBOLS = [
    { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
    { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq' },
    { proName: 'AMEX:IWM', title: 'Russell' },
    { proName: 'AMEX:DIA', title: 'Dow' },
    { proName: 'TVC:USOIL', title: 'Crude Oil' },
    { proName: 'CAPITALCOM:NATURALGAS', title: 'Nat Gas' },
    { proName: 'TVC:GOLD', title: 'Gold' },
    { proName: 'TVC:SILVER', title: 'Silver' },
    { proName: 'CAPITALCOM:COPPER', title: 'Copper' },
    { proName: 'AMEX:XLE', title: 'Energy' },
    { proName: 'AMEX:UUP', title: 'Dollar' },
    { proName: 'AMEX:UVXY', title: 'VIX' },
    { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
    { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
  ];

  function inject() {
    var nav = document.getElementById('nav');
    if (!nav) return;

    // Create container
    var wrap = document.createElement('div');
    wrap.id = 'tv-ticker-tape';
    wrap.style.cssText = 'border-bottom:1px solid var(--border, #1e1e30);';

    var container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.width = '100%';

    var inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    container.appendChild(inner);

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: SYMBOLS,
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: 'compact',
      colorTheme: 'dark',
      locale: 'en',
    });
    container.appendChild(script);

    wrap.appendChild(container);

    // Insert right after nav
    nav.parentNode.insertBefore(wrap, nav.nextSibling);
  }

  // Wait for nav:ready event (fired by nav.js after building nav)
  document.addEventListener('nav:ready', inject);

  // Fallback: if nav:ready already fired (script loaded late)
  if (document.getElementById('nav') && document.getElementById('nav').className === 'nav-bar') {
    inject();
  }
})();
