/**
 * ticker-tape.js — TradingView real-time ticker tape widget (v3)
 *
 * Public API: mount(target?), destroy(), show(), hide(), isVisible(), isMounted()
 * Symmetric with snapshotStrip so shell.js can swap them mutually-exclusively
 * via the V3 tape-state cycle (off → snapshot → tape → off).
 *
 * Placement: prefers the v3 main content area (visible inside the V3 grid
 * viewport). Falls back to inserting after <nav id="nav"> in legacy chrome.
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

  /** Pick the best insert point based on which chrome is active. */
  function findInsertSlot() {
    // V3 chrome — drop the strip at the top of main so it lives in the viewport.
    var v3Main = document.querySelector('main.v3-main');
    if (v3Main) return { parent: v3Main, before: v3Main.firstChild };
    // Legacy chrome — insert after <nav id="nav">.
    var nav = document.getElementById('nav');
    if (nav && nav.parentNode) return { parent: nav.parentNode, before: nav.nextSibling };
    return null;
  }

  function inject() {
    if (_injected) return;
    var slot = findInsertSlot();
    if (!slot) return;

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
    slot.parent.insertBefore(_wrap, slot.before);
    _injected = true;
  }

  /** Symmetric API with snapshotStrip — bring the tape up. */
  function mount(_target) {
    inject();
    show();
  }

  /** Symmetric API — fully remove the tape so a fresh mount() works after. */
  function destroy() {
    if (_wrap && _wrap.parentNode) {
      _wrap.parentNode.removeChild(_wrap);
    }
    _wrap = null;
    _injected = false;
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

  function isMounted() {
    return !!(_wrap && _wrap.parentNode);
  }

  // Auto-inject on nav:ready ONLY in legacy chrome. In V3 mode the
  // tape-state-change handler in shell.js owns mount/destroy explicitly.
  document.addEventListener('nav:ready', function () {
    if (document.body.classList.contains('v3')) return;
    inject();
  });

  return {
    inject: inject,
    mount: mount,
    destroy: destroy,
    show: show,
    hide: hide,
    isVisible: isVisible,
    isMounted: isMounted,
  };
})();
