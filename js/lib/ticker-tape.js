/**
 * ticker-tape.js — TradingView real-time ticker tape widget (v2)
 * Based on ticker-tape-tv.js with added show()/hide() API.
 * Injects compact ticker tape after <nav id="nav"> on every page.
 */
var tickerTape = (function () {
  'use strict';

  var SYMBOLS = [
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
    { proName: 'TVC:VIX', title: 'VIX' },
    { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
    { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
  ];

  var _injected = false;
  var _wrap = null;

  function inject() {
    if (_injected) return;
    var nav = document.getElementById('nav');
    if (!nav) return;

    _wrap = document.createElement('div');
    _wrap.id = 'tv-ticker-tape';
    _wrap.style.cssText = 'border-bottom:1px solid var(--border, #1e1e30);';

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

    _wrap.appendChild(container);
    nav.parentNode.insertBefore(_wrap, nav.nextSibling);
    _injected = true;
  }

  function show() {
    if (!_injected) inject();
    if (_wrap) _wrap.style.display = '';
  }

  function hide() {
    if (_wrap) _wrap.style.display = 'none';
  }

  function isVisible() {
    return _wrap ? _wrap.style.display !== 'none' : false;
  }

  // Wait for nav:ready event (fired by shell.js after building nav)
  document.addEventListener('nav:ready', inject);

  return { inject: inject, show: show, hide: hide, isVisible: isVisible };
})();
