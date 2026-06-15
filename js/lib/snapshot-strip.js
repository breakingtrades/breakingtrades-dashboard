/**
 * snapshot-strip.js — Top-of-page live market snapshot strip.
 *
 * Renders 6 instruments (SPY, QQQ, IWM, VIX, Bitcoin, Gold) as a compact
 * horizontal strip below the nav. Each tile shows symbol + live price +
 * change %, color-coded green/red.
 *
 * Uses livePrices (Yahoo chart endpoint) — no TradingView iframe, no
 * subscription, no headless-session breakage. Polls every 60s during
 * market hours, holds last value off-hours.
 *
 * Replaces TradingView ticker tape as the default. TV tape stays toggleable
 * via the eye icon (`ticker-tape-toggle`) for users who want the full
 * scrolling tape.
 *
 * Registers as global `snapshotStrip` with .mount() / .destroy().
 */
(function() {
  'use strict';

  var SYMBOLS = [
    { key: 'SPY',  label: 'S&P 500',  symbol: 'SPY'     },
    { key: 'QQQ',  label: 'Nasdaq',   symbol: 'QQQ'     },
    { key: 'IWM',  label: 'Russell',  symbol: 'IWM'     },
    { key: 'VIX',  label: 'VIX',      symbol: 'VIX'     },
    { key: 'BTC',  label: 'Bitcoin',  symbol: 'BTC'     },
    { key: 'GOLD', label: 'Gold',     symbol: 'GOLD'    }
  ];

  var _unsub = null;
  var _container = null;
  var _lastPrices = {};   // symbol -> price (for flash-on-change detection)

  function fmtPrice(p, sym) {
    if (p == null) return '—';
    if (sym === 'BTC') return Math.round(p).toLocaleString('en-US');
    if (sym === 'VIX') return p.toFixed(2);
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return p.toFixed(2);
  }

  function fmtChangePct(pct) {
    if (pct == null) return '';
    var sign = pct > 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  function colorClass(pct) {
    if (pct == null) return '';
    return pct > 0 ? 'sn-up' : pct < 0 ? 'sn-down' : '';
  }

  function buildHTML() {
    var tiles = SYMBOLS.map(function(s) {
      return '<div class="snap-tile" data-sym="' + s.key + '" data-tradingview="' + tvSymbol(s.key) + '" title="Click to open chart">' +
        '<div class="snap-label">' + s.label + '</div>' +
        '<div class="snap-price" data-price="—">—</div>' +
        '<div class="snap-change">—</div>' +
      '</div>';
    }).join('');
    return '<div class="snap-strip" id="snapshot-strip">' +
      tiles +
      '<div class="snap-clock" id="snap-clock"><span class="snap-clock-time">—</span><span class="snap-clock-status">—</span></div>' +
    '</div>';
  }

  // For click-through to TradingView. Map our keys to tradingview exchange:symbol
  function tvSymbol(key) {
    var map = {
      SPY: 'AMEX:SPY',
      QQQ: 'NASDAQ:QQQ',
      IWM: 'AMEX:IWM',
      VIX: 'TVC:VIX',
      BTC: 'BITSTAMP:BTCUSD',
      GOLD: 'TVC:GOLD'
    };
    return map[key] || key;
  }

  function updateTile(sym, quote) {
    var tile = _container.querySelector('[data-sym="' + sym + '"]');
    if (!tile) return;
    var priceEl = tile.querySelector('.snap-price');
    var changeEl = tile.querySelector('.snap-change');

    var price = quote.price;
    var pct = quote.changePct;
    var prev = _lastPrices[sym];
    var changed = (prev != null && price != null && Math.abs(prev - price) > 0.001);

    // Update strings
    priceEl.textContent = fmtPrice(price, sym);
    priceEl.setAttribute('data-price', price != null ? price.toString() : '—');
    changeEl.textContent = fmtChangePct(pct);
    changeEl.className = 'snap-change ' + colorClass(pct);

    // Flash on change
    if (changed) {
      priceEl.classList.remove('snap-flash-up', 'snap-flash-down');
      void priceEl.offsetWidth; // restart animation
      priceEl.classList.add(price > prev ? 'snap-flash-up' : 'snap-flash-down');
    }
    _lastPrices[sym] = price;
  }

  function updateClock() {
    var clock = document.getElementById('snap-clock');
    if (!clock) return;
    var now = new Date();
    var et = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    var open = window.livePrices && window.livePrices.isMarketHours();
    var status = open ? 'OPEN' : marketStatus();
    clock.querySelector('.snap-clock-time').textContent = et + ' ET';
    var statusEl = clock.querySelector('.snap-clock-status');
    statusEl.textContent = status;
    statusEl.className = 'snap-clock-status ' + (open ? 'sn-up' : 'sn-dim');
  }

  function marketStatus() {
    var now = new Date();
    var et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    var day = et.getDay();
    if (day === 0 || day === 6) return 'WEEKEND';
    var min = et.getHours() * 60 + et.getMinutes();
    if (min < 9 * 60 + 30) return 'PRE-MARKET';
    if (min >= 16 * 60) return 'AFTER-HOURS';
    return 'CLOSED';
  }

  /** Mount the strip into the given container (or replace the existing ticker-tape mount point). */
  function mount(target) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) return;

    // Tape lifecycle is owned by shell.js (V3) / ticker-tape toggle (legacy).
    // Don't reach into ticker-tape's DOM from here — it created a stale
    // orphan wrapper that prevented the tape from coming back after a swap.

    // Inject our strip
    var existing = document.getElementById('snapshot-strip');
    if (existing) existing.parentNode.removeChild(existing);

    var holder = document.createElement('div');
    holder.innerHTML = buildHTML();
    var strip = holder.firstChild;

    // V3 chrome → top of main content (visible). Legacy → after <nav id="nav">.
    var v3Main = document.querySelector('main.v3-main');
    var nav = document.getElementById('nav');
    if (v3Main) {
      v3Main.insertBefore(strip, v3Main.firstChild);
    } else if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(strip, nav.nextSibling);
    } else {
      target.appendChild(strip);
    }
    _container = strip;

    // Bind clicks: open TradingView chart for each tile
    _container.querySelectorAll('.snap-tile').forEach(function(tile) {
      tile.addEventListener('click', function() {
        var tv = tile.getAttribute('data-tradingview');
        if (tv) window.open('https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(tv), '_blank');
      });
    });

    // Initial fetch + subscribe
    if (window.livePrices) {
      _unsub = window.livePrices.subscribe(
        SYMBOLS.map(function(s) { return s.symbol; }),
        function(quotes) {
          SYMBOLS.forEach(function(s) {
            if (quotes[s.symbol]) updateTile(s.key, quotes[s.symbol]);
          });
        }
      );
    }

    // Clock tick
    updateClock();
    if (snapshotStrip._clockHandle) clearInterval(snapshotStrip._clockHandle);
    snapshotStrip._clockHandle = setInterval(updateClock, 15 * 1000);
  }

  function destroy() {
    if (_unsub) { _unsub(); _unsub = null; }
    if (snapshotStrip._clockHandle) { clearInterval(snapshotStrip._clockHandle); snapshotStrip._clockHandle = null; }
    if (_container && _container.parentNode) {
      _container.parentNode.removeChild(_container);
    }
    _container = null;
  }

  function isMounted() {
    return _container && _container.parentNode;
  }

  window.snapshotStrip = {
    mount: mount,
    destroy: destroy,
    isMounted: isMounted,
    SYMBOLS: SYMBOLS
  };
})();
