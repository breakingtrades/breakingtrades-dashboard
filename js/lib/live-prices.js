/**
 * live-prices.js — Free live price fetcher via Yahoo Finance chart endpoint.
 *
 * Why this exists:
 *   - Yahoo's `quote` endpoint (v7) now requires auth as of late 2025.
 *   - The `chart` endpoint (v8) is still free + public, no key, no auth.
 *     Same one yfinance uses internally.
 *   - We use it to top up the canonical data/prices.json snapshot with live
 *     intraday prices during market hours, so the dashboard isn't reading
 *     yesterday's close while the user stares at it midday.
 *
 * Usage:
 *   livePrices.get('SPY').then(q => console.log(q.price, q.previousClose));
 *   livePrices.subscribe(['SPY','QQQ','IWM','VIX','BTC-USD','GC=F'], function(quotes) {
 *     // quotes = { SPY: {price, change, changePct, ...}, ... }
 *   });
 *
 * The .subscribe() helper polls every 60s during market hours, never during
 * pre/post or weekends. Caches by symbol with a 30s soft TTL so multiple
 * components asking for SPY don't double-fetch.
 *
 * Cross-origin note: Yahoo's chart endpoint has open CORS, returns JSON
 * directly to the browser — no proxy needed.
 *
 * Registers as global `livePrices`.
 */
(function() {
  'use strict';

  var BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
  var CACHE_TTL_MS = 30 * 1000; // 30s — multiple subscribers share fetches
  var POLL_INTERVAL_MS = 60 * 1000;
  var _cache = {};   // symbol -> { ts, quote }
  var _inflight = {}; // symbol -> Promise

  // Symbol normalization. Yahoo uses different tickers for futures, crypto, etc.
  // Pass our friendly name in, get the Yahoo symbol out.
  var SYMBOL_MAP = {
    'BTC':   'BTC-USD',
    'ETH':   'ETH-USD',
    'GOLD':  'GC=F',
    'SILVER':'SI=F',
    'OIL':   'CL=F',
    'NATGAS':'NG=F',
    'COPPER':'HG=F',
    'DXY':   'DX-Y.NYB',
    'VIX':   '^VIX',
    'SPX':   '^GSPC',
    'NDX':   '^NDX',
    'RUT':   '^RUT',
    'DJI':   '^DJI'
  };

  function ySymbol(s) { return SYMBOL_MAP[s] || s; }
  function ourSymbol(s, requested) { return requested; }  // echo back the friendly name

  /**
   * Fetch one symbol's live quote. Returns:
   *   { price, previousClose, change, changePct, marketState, currency, exchange, timestamp }
   * Throws on network / parse failure.
   */
  function fetchOne(symbol) {
    var ys = ySymbol(symbol);
    var url = BASE + encodeURIComponent(ys) + '?interval=1m&range=1d';
    return fetch(url, { credentials: 'omit' })
      .then(function(r) {
        if (!r.ok) throw new Error('yahoo chart HTTP ' + r.status);
        return r.json();
      })
      .then(function(j) {
        if (j && j.chart && j.chart.error) {
          throw new Error('yahoo error: ' + (j.chart.error.code || 'unknown'));
        }
        var result = j && j.chart && j.chart.result && j.chart.result[0];
        if (!result || !result.meta) throw new Error('yahoo: empty result');
        var meta = result.meta;
        var price = meta.regularMarketPrice;
        var prev = meta.chartPreviousClose != null ? meta.chartPreviousClose : meta.previousClose;
        var change = (price != null && prev != null) ? (price - prev) : null;
        var changePct = (change != null && prev) ? (change / prev * 100) : null;
        return {
          symbol: symbol,
          ySymbol: ys,
          price: price,
          previousClose: prev,
          change: change,
          changePct: changePct,
          marketState: meta.marketState || null,
          currency: meta.currency || null,
          exchange: meta.exchangeName || null,
          timestamp: Date.now()
        };
      });
  }

  /** Get a quote, using cache when fresh. Returns a Promise. */
  function get(symbol, opts) {
    opts = opts || {};
    var now = Date.now();
    if (!opts.force && _cache[symbol] && (now - _cache[symbol].ts) < CACHE_TTL_MS) {
      return Promise.resolve(_cache[symbol].quote);
    }
    if (_inflight[symbol]) return _inflight[symbol];
    var p = fetchOne(symbol).then(function(q) {
      _cache[symbol] = { ts: Date.now(), quote: q };
      delete _inflight[symbol];
      return q;
    }).catch(function(err) {
      delete _inflight[symbol];
      throw err;
    });
    _inflight[symbol] = p;
    return p;
  }

  /** Fetch many symbols in parallel. Returns Promise of object keyed by symbol.
   *  Failed symbols are simply missing from the result (don't poison the batch). */
  function getMany(symbols, opts) {
    return Promise.all(symbols.map(function(s) {
      return get(s, opts).then(function(q) { return [s, q]; })
        .catch(function(err) {
          // Log but don't reject the whole batch
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('livePrices: ' + s + ' failed:', err.message || err);
          }
          return [s, null];
        });
    })).then(function(pairs) {
      var out = {};
      pairs.forEach(function(p) { if (p[1]) out[p[0]] = p[1]; });
      return out;
    });
  }

  /** Market-hours check (rough, US-only, ignores holidays).
   *  Used to throttle polling — no point hitting Yahoo every 60s on Saturday. */
  function isMarketHours() {
    var now = new Date();
    var et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    var day = et.getDay();
    if (day === 0 || day === 6) return false;
    var minutesSinceMidnight = et.getHours() * 60 + et.getMinutes();
    var marketOpen = 9 * 60 + 30;   // 9:30 AM ET
    var marketClose = 16 * 60;      // 4:00 PM ET
    return minutesSinceMidnight >= marketOpen && minutesSinceMidnight < marketClose;
  }

  /** Subscribe to live updates. Returns an unsubscribe function. */
  function subscribe(symbols, callback, opts) {
    opts = opts || {};
    var alwaysPoll = opts.alwaysPoll || false; // ignore market hours check
    var interval = opts.interval || POLL_INTERVAL_MS;
    var stopped = false;

    function tick() {
      if (stopped) return;
      if (!alwaysPoll && !isMarketHours()) return; // skip silently
      getMany(symbols, { force: true }).then(function(quotes) {
        if (!stopped) callback(quotes);
      });
    }

    // Fire once immediately (regardless of market hours)
    getMany(symbols).then(function(quotes) {
      if (!stopped) callback(quotes);
    });

    var handle = setInterval(tick, interval);
    return function unsubscribe() {
      stopped = true;
      clearInterval(handle);
    };
  }

  // Expose globally
  window.livePrices = {
    get: get,
    getMany: getMany,
    subscribe: subscribe,
    isMarketHours: isMarketHours,
    fetchOne: fetchOne,
    _cache: _cache  // exposed for debugging only
  };
})();
