/**
 * pages/watchlist.js — Watchlist page module for BreakingTrades v2
 * Registers as BT.pages.watchlist with render(), init(), destroy()
 */
(function() {
  'use strict';

  var watchlist = [];
  var emData = {};
  var sortCol = 0;
  var sortAsc = true;

  var EXCHANGE_MAP = {
    'AAPL':'NASDAQ','AMZN':'NASDAQ','GOOG':'NASDAQ','GOOGL':'NASDAQ','MSFT':'NASDAQ','NVDA':'NASDAQ',
    'META':'NASDAQ','COIN':'NASDAQ','ARM':'NASDAQ','DELL':'NYSE','TSLA':'NASDAQ','NFLX':'NASDAQ',
    'AMD':'NASDAQ','AVGO':'NASDAQ','MU':'NASDAQ','QCOM':'NASDAQ','AMAT':'NASDAQ','LRCX':'NASDAQ',
    'MRVL':'NASDAQ','CRDO':'NASDAQ','ANET':'NYSE','VRT':'NYSE','CIEN':'NYSE','APH':'NYSE',
    'ADSK':'NASDAQ','CHTR':'NASDAQ','TMUS':'NASDAQ',
    'SPY':'AMEX','QQQ':'NASDAQ','IWM':'AMEX','DIA':'AMEX','HYG':'AMEX','TLT':'NASDAQ',
    'XLU':'AMEX','XLK':'AMEX','XLE':'AMEX','XLV':'AMEX','XLF':'AMEX','XLP':'AMEX',
    'XLY':'AMEX','XLI':'AMEX','XLC':'AMEX','XLRE':'AMEX','RSP':'AMEX','IGV':'AMEX',
    'IWF':'AMEX','IWD':'AMEX','GLD':'AMEX','SLV':'AMEX','URA':'AMEX','OIH':'AMEX','MOO':'AMEX',
    'EQIX':'NASDAQ','DLR':'NYSE','AMT':'NYSE',
    'KHC':'NASDAQ','CAG':'NYSE','TAP':'NYSE','SYK':'NYSE','KMB':'NYSE'
  };

  function getExchange(sym) { return EXCHANGE_MAP[sym] || 'NYSE'; }

  function fmtVol(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return String(n);
  }

  function render(el) {
    el.innerHTML =
      '<div class="page-content">' +
        '<div class="wl-page-header">' +
          '<div class="wl-page-title"><i data-lucide="clipboard-list"></i> Watchlist — <span id="wl-count">0</span> Symbols</div>' +
          '<div class="wl-view-toggle">' +
            '<button class="wl-view-btn" id="wl-btn-widget">Widget</button>' +
            '<button class="wl-view-btn active" id="wl-btn-table">Table</button>' +
          '</div>' +
        '</div>' +
        '<div class="wl-tv-widget-wrap" id="wl-tv-widget-view">' +
          '<div class="tradingview-widget-container" style="width:100%;height:calc(100vh - 200px);">' +
            '<div class="tradingview-widget-container__widget" id="wl-tv-market-overview" style="width:100%;height:100%;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="wl-table-wrap" id="wl-table-view">' +
          '<table class="watchlist-table" id="wl-table">' +
            '<thead><tr>' +
              '<th data-col="0">Ticker <span class="sort-arrow">▼</span></th>' +
              '<th>Name</th>' +
              '<th data-col="2">Sector</th>' +
              '<th data-col="3">Price</th>' +
              '<th data-col="4">Change %</th>' +
              '<th data-col="5">SMA20</th>' +
              '<th data-col="6">SMA50</th>' +
              '<th data-col="7">Bias</th>' +
              '<th data-col="8">Status</th>' +
            '</tr></thead>' +
            '<tbody id="wl-tbody">' +
              Array(20).join('<tr><td colspan="9"><div class="skeleton skeleton-table-row"></div></td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      // Detail Modal
      '<div class="wl-modal-overlay" id="wl-modal">' +
        '<div class="wl-modal">' +
          '<div class="wl-modal-header">' +
            '<div class="ticker-info">' +
              '<span class="modal-ticker" id="wl-modal-ticker"></span>' +
              '<span class="modal-name" id="wl-modal-name"></span>' +
              '<span class="modal-price-tag" id="wl-modal-price"></span>' +
              '<span class="bias-badge" id="wl-modal-bias"></span>' +
            '</div>' +
            '<button class="wl-modal-close" id="wl-modal-close-btn">✕</button>' +
          '</div>' +
          '<div class="wl-modal-body" id="wl-modal-body"></div>' +
        '</div>' +
      '</div>';
  }

  function init(param) {
    // Bind view toggle
    var btnWidget = document.getElementById('wl-btn-widget');
    var btnTable = document.getElementById('wl-btn-table');
    if (btnWidget) btnWidget.addEventListener('click', function() { showView('widget'); });
    if (btnTable) btnTable.addEventListener('click', function() { showView('table'); });

    // Bind sortable headers
    var ths = document.querySelectorAll('#wl-table thead th[data-col]');
    ths.forEach(function(th) {
      th.addEventListener('click', function() { doSort(parseInt(th.getAttribute('data-col'), 10)); });
    });

    // Modal overlay close
    var modalOverlay = document.getElementById('wl-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) closeDetail();
      });
    }
    var closeBtn = document.getElementById('wl-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeDetail);

    // Escape key
    document.addEventListener('keydown', _onKeyDown);

    // Hash change
    window.addEventListener('hashchange', _onHashChange);

    loadData(param);
    initTVWidget();
  }

  function destroy() {
    document.removeEventListener('keydown', _onKeyDown);
    window.removeEventListener('hashchange', _onHashChange);
    watchlist = [];
    emData = {};
  }

  function _onKeyDown(e) {
    if (e.key === 'Escape') closeDetail();
  }

  function _onHashChange() {
    var h = location.hash.replace('#', '');
    var parts = h.split('/');
    if (parts[0] === 'watchlist' && parts[1]) {
      openDetail(parts[1].toUpperCase());
    }
  }

  // === Data Loading ===
  function loadData(param) {
    var btPrices = window.btPrices;
    var pricesReady = btPrices && btPrices.load ? btPrices.load() : Promise.resolve();

    Promise.all([
      fetch('../data/watchlist.json').then(function(r) { return r.ok ? r.json() : []; }),
      fetch('../data/expected-moves.json').then(function(r) { return r.ok ? r.json() : {}; }),
      pricesReady
    ]).then(function(results) {
      watchlist = results[0] || [];
      var emRaw = results[1] || {};
      emData = emRaw.tickers || {};

      // Overlay btPrices
      if (btPrices) {
        watchlist.forEach(function(item) {
          var p = btPrices.get ? btPrices.get(item.symbol) : null;
          if (p) {
            item.price = p.price;
            item.change = p.change;
          }
        });
      }

      var countEl = document.getElementById('wl-count');
      if (countEl) countEl.textContent = watchlist.length;

      renderTable();

      // Deep link: #watchlist/SPY
      if (param) {
        openDetail(param.toUpperCase());
      }
    }).catch(function(err) {
      console.error('Failed to load watchlist data:', err);
      var tbody = document.getElementById('wl-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--red);">Error loading data</td></tr>';
    });
  }

  // === View Toggle ===
  function showView(view) {
    var tvWrap = document.getElementById('wl-tv-widget-view');
    var tableWrap = document.getElementById('wl-table-view');
    var btnW = document.getElementById('wl-btn-widget');
    var btnT = document.getElementById('wl-btn-table');
    if (tvWrap) tvWrap.style.display = view === 'widget' ? 'block' : 'none';
    if (tableWrap) tableWrap.style.display = view === 'table' ? 'block' : 'none';
    if (btnW) btnW.classList.toggle('active', view === 'widget');
    if (btnT) btnT.classList.toggle('active', view === 'table');
  }

  // === Sorting ===
  function doSort(col) {
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    renderTable();
  }

  function renderTable() {
    var keys = ['symbol','name','sector','price','change','sma20','sma50','bias','status'];
    var sorted = watchlist.slice().sort(function(a, b) {
      var key = keys[sortCol];
      var va = a[key], vb = b[key];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    var tbody = document.getElementById('wl-tbody');
    if (!tbody) return;

    tbody.innerHTML = sorted.map(function(s) {
      var chgClass = s.change > 0 ? 'up' : s.change < 0 ? 'down' : 'neutral';
      var dist20 = s.sma20 ? ((s.price - s.sma20) / s.sma20 * 100).toFixed(1) : '—';
      var dist50 = s.sma50 ? ((s.price - s.sma50) / s.sma50 * 100).toFixed(1) : '—';
      var d20Class = dist20 !== '—' ? (parseFloat(dist20) > 0 ? 'up' : 'down') : '';
      var d50Class = dist50 !== '—' ? (parseFloat(dist50) > 0 ? 'up' : 'down') : '';
      return '<tr data-sym="' + s.symbol + '" style="cursor:pointer;">' +
        '<td class="ticker-cell">' + s.symbol + '</td>' +
        '<td style="color:var(--text-dim);font-size:11px;">' + (s.name || '') + '</td>' +
        '<td class="sector-cell">' + (s.sector || '') + '</td>' +
        '<td>$' + (s.price ? s.price.toFixed(2) : '—') + '</td>' +
        '<td class="' + chgClass + '">' + (s.change > 0 ? '+' : '') + (s.change != null ? s.change.toFixed(1) : '—') + '%</td>' +
        '<td><span class="' + d20Class + '">' + (dist20 !== '—' && parseFloat(dist20) > 0 ? '+' : '') + dist20 + '%</span> <span style="color:var(--text-dim);font-size:10px;">($' + (s.sma20 ? s.sma20.toFixed(0) : '—') + ')</span></td>' +
        '<td><span class="' + d50Class + '">' + (dist50 !== '—' && parseFloat(dist50) > 0 ? '+' : '') + dist50 + '%</span> <span style="color:var(--text-dim);font-size:10px;">($' + (s.sma50 ? s.sma50.toFixed(0) : '—') + ')</span></td>' +
        '<td><span class="bias-badge ' + (s.bias || 'mixed') + '">' + (s.bias || 'mixed').toUpperCase() + '</span></td>' +
        '<td><span class="status-badge ' + (s.status || 'watching') + '">' + (s.status || 'watching').toUpperCase() + '</span></td>' +
      '</tr>';
    }).join('');

    // Bind row clicks
    tbody.querySelectorAll('tr[data-sym]').forEach(function(tr) {
      tr.addEventListener('click', function() { openDetail(tr.getAttribute('data-sym')); });
    });

    // Render Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // === TradingView Widget ===
  function initTVWidget() {
    var container = document.getElementById('wl-tv-market-overview');
    if (!container) return;
    var script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "colorTheme": "dark",
      "dateRange": "12M",
      "showChart": true,
      "locale": "en",
      "width": "100%",
      "height": "100%",
      "largeChartUrl": "",
      "isTransparent": true,
      "showSymbolLogo": true,
      "showFloatingTooltip": true,
      "plotLineColorGrowing": "rgba(0, 212, 170, 1)",
      "plotLineColorFalling": "rgba(255, 71, 87, 1)",
      "tabs": [
        { "title": "Quality Stocks", "symbols": [
          {"s":"NASDAQ:AAPL","d":"Apple"},{"s":"NASDAQ:MSFT","d":"Microsoft"},{"s":"NASDAQ:NVDA","d":"NVIDIA"},
          {"s":"NASDAQ:GOOGL","d":"Alphabet"},{"s":"NASDAQ:AMZN","d":"Amazon"},{"s":"NASDAQ:META","d":"Meta"},
          {"s":"NYSE:DELL","d":"Dell"},{"s":"NASDAQ:COIN","d":"Coinbase"},{"s":"NASDAQ:ARM","d":"ARM Holdings"}
        ]},
        { "title": "Sector ETFs", "symbols": [
          {"s":"AMEX:XLU","d":"Utilities"},{"s":"AMEX:XLK","d":"Technology"},{"s":"AMEX:XLE","d":"Energy"},
          {"s":"AMEX:XLV","d":"Healthcare"},{"s":"AMEX:XLF","d":"Financials"},{"s":"AMEX:XLP","d":"Staples"},
          {"s":"AMEX:XLY","d":"Discretionary"},{"s":"AMEX:XLI","d":"Industrials"},{"s":"AMEX:XLC","d":"Communication"}
        ]},
        { "title": "Macro / Index", "symbols": [
          {"s":"AMEX:SPY","d":"S&P 500"},{"s":"NASDAQ:QQQ","d":"Nasdaq 100"},{"s":"AMEX:IWM","d":"Russell 2000"},
          {"s":"AMEX:DIA","d":"Dow 30"},{"s":"TVC:VIX","d":"VIX"},{"s":"TVC:DXY","d":"Dollar Index"}
        ]}
      ]
    });
    container.appendChild(script);
  }

  // === Detail Modal ===
  function openDetail(symbol) {
    var t = null;
    for (var i = 0; i < watchlist.length; i++) {
      if (watchlist[i].symbol === symbol) { t = watchlist[i]; break; }
    }
    if (!t) return;

    var exchange = getExchange(symbol);
    var pc = (t.change || 0) >= 0 ? 'up' : 'down';
    var tvSymbol = exchange + ':' + symbol;

    document.getElementById('wl-modal-ticker').textContent = t.symbol;
    document.getElementById('wl-modal-name').textContent = (t.name || '') + ' · ' + (t.sector || '');
    document.getElementById('wl-modal-price').innerHTML =
      '<span class="' + pc + '">$' + (t.price ? t.price.toFixed(2) : '—') + '</span>' +
      ' <span class="' + pc + '" style="font-size:12px">' + ((t.change||0) >= 0 ? '▲' : '▼') + ' ' + Math.abs(t.change||0).toFixed(2) + '%</span>';
    var biasEl = document.getElementById('wl-modal-bias');
    biasEl.className = 'bias-badge ' + (t.bias || 'mixed');
    biasEl.textContent = (t.bias || 'mixed').toUpperCase();

    // Build key levels
    var levels = [
      ['SMA 20', t.sma20], ['SMA 50', t.sma50], ['SMA 200', t.sma200],
      ['Weekly 20', t.w20], ['52w High', t.high52w], ['52w Low', t.low52w]
    ].filter(function(l) { return l[1] != null; });

    var levelsHTML = levels.map(function(l) {
      var color = l[0] === '52w High' ? 'var(--cyan)' : l[0] === '52w Low' ? 'var(--red)' : 'var(--text)';
      return '<div class="wl-detail-level"><span class="wl-dl-label">' + l[0] + '</span><span class="wl-dl-value" style="color:' + color + '">$' + l[1].toFixed(2) + '</span></div>';
    }).join('');

    // Build volatility card
    var volItems = [
      ['RSI (14)', t.rsi != null ? t.rsi + '' : '—', ''],
      ['ATR (14)', t.atr != null ? '$' + t.atr.toFixed(2) : '—', ''],
      ['ATR %', t.atrPct != null ? t.atrPct + '%' : '—', ''],
      ['Volume', t.volume != null ? fmtVol(t.volume) : '—', ''],
      ['vs 20d Avg', t.volumeRatio != null ? t.volumeRatio + 'x' : '—',
        t.volumeRatio > 1.5 ? 'color:var(--cyan)' : t.volumeRatio < 0.6 ? 'color:var(--red)' : ''],
      ['From 52w High', t.pctFrom52wHigh != null ? t.pctFrom52wHigh.toFixed(1) + '%' : '—',
        (t.pctFrom52wHigh||0) < -20 ? 'color:var(--red)' : (t.pctFrom52wHigh||0) < -10 ? 'color:var(--orange)' : '']
    ];
    var volHTML = volItems.map(function(v) {
      return '<div class="wl-detail-level"><span class="wl-dl-label">' + v[0] + '</span><span class="wl-dl-value"' + (v[2] ? ' style="' + v[2] + '"' : '') + '>' + v[1] + '</span></div>';
    }).join('');

    // Signals
    var signals = generateSignals(t);
    var signalsHTML = signals.map(function(s) {
      return '<div class="wl-signal-item wl-signal-' + s.cls.replace('signal-','') + '">' + s.icon + ' ' + s.text + '</div>';
    }).join('') || '<div class="wl-signal-item wl-signal-neutral">No notable signals</div>';

    // Earnings banner
    var earningsHTML = t.earningsDays != null ?
      '<div style="margin-bottom:16px;padding:10px 16px;border-radius:6px;border:1px solid ' + (t.earningsDays <= 14 ? 'var(--red)' : 'var(--orange)') + ';background:' + (t.earningsDays <= 14 ? 'rgba(239,83,80,0.1)' : 'rgba(255,167,38,0.08)') + ';">' +
        '<span style="font-size:12px;font-weight:600;color:' + (t.earningsDays <= 14 ? 'var(--red)' : 'var(--orange)') + ';">' +
          '<i data-lucide="calendar"></i> Earnings: ' + t.earningsDate + ' (' + t.earningsDays + ' day' + (t.earningsDays !== 1 ? 's' : '') + ')' +
        '</span>' +
      '</div>' : '';

    // Expected move banner
    var emHTML = buildExpectedMoveHTML(symbol, t.price);

    document.getElementById('wl-modal-body').innerHTML =
      earningsHTML +
      emHTML +
      '<div class="wl-chart-row">' +
        '<div class="wl-chart-box"><div class="wl-chart-label">Daily</div><div id="wl-chart-daily" style="height:400px;"></div></div>' +
        '<div class="wl-chart-box"><div class="wl-chart-label">Weekly</div><div id="wl-chart-weekly" style="height:400px;"></div></div>' +
      '</div>' +
      '<div class="wl-info-row">' +
        '<div class="wl-info-card"><h4>Technical Analysis</h4><div id="wl-ta-widget" style="height:280px;"></div></div>' +
        '<div class="wl-info-card"><h4>Key Levels</h4>' + levelsHTML + '</div>' +
        '<div class="wl-info-card"><h4>Volatility & Volume</h4>' + volHTML + '</div>' +
      '</div>' +
      '<div class="wl-signals-section"><h4><i data-lucide="bar-chart-3"></i> Technical Signals</h4>' + signalsHTML + '</div>';

    // Embed charts
    embedTVChart('wl-chart-daily', tvSymbol, 'D');
    embedTVChart('wl-chart-weekly', tvSymbol, 'W');
    embedTAWidget('wl-ta-widget', tvSymbol);

    document.getElementById('wl-modal').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Render Lucide icons in modal
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closeDetail() {
    var modal = document.getElementById('wl-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    ['wl-chart-daily','wl-chart-weekly','wl-ta-widget'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }

  function embedTVChart(containerId, symbol, interval) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "symbol": symbol, "interval": interval, "timezone": "America/New_York",
      "theme": "dark", "style": "1", "locale": "en",
      "backgroundColor": "#0a0a0f", "gridColor": "rgba(255,255,255,0.03)",
      "hide_side_toolbar": false, "allow_symbol_change": false,
      "studies": ["STD;SMA@tv-basicstudies|20","STD;SMA@tv-basicstudies|50"],
      "width": "100%", "height": "100%"
    });
    var wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container';
    wrapper.style.cssText = 'width:100%;height:100%;';
    var inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.cssText = 'width:100%;height:100%;';
    wrapper.appendChild(inner);
    wrapper.appendChild(script);
    container.appendChild(wrapper);
  }

  function embedTAWidget(containerId, symbol) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "interval": "1D", "width": "100%", "height": "100%",
      "isTransparent": true, "symbol": symbol,
      "showIntervalTabs": true, "colorTheme": "dark", "locale": "en"
    });
    var wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container';
    wrapper.style.cssText = 'width:100%;height:100%;';
    var inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.cssText = 'width:100%;height:100%;';
    wrapper.appendChild(inner);
    wrapper.appendChild(script);
    container.appendChild(wrapper);
  }

  // === Expected Move HTML ===
  function buildExpectedMoveHTML(symbol, currentPrice) {
    var em = emData[symbol];
    if (!em) return '';
    var close = em.close;
    var price = currentPrice || close;
    var d = em.daily || {};
    var w = em.weekly || {};
    var m = em.monthly || {};
    var q = em.quarterly || {};
    if (!w.upper || !w.lower) return '';

    var lo = w.lower, hi = w.upper;
    var range = hi - lo;
    var pad = range * 0.15;
    var viewLo = lo - pad, viewHi = hi + pad;
    var viewRange = viewHi - viewLo;
    var pctLo = ((lo - viewLo) / viewRange * 100).toFixed(1);
    var pctMid = ((close - viewLo) / viewRange * 100).toFixed(1);
    var pctHi = ((hi - viewLo) / viewRange * 100).toFixed(1);
    var pctCur = Math.max(0, Math.min(100, ((price - viewLo) / viewRange * 100))).toFixed(1);

    var outside = price > hi ? 'above' : price < lo ? 'below' : null;
    var outsideTag = outside
      ? '<span style="color:' + (outside === 'above' ? 'var(--cyan)' : 'var(--red)') + ';font-size:11px;font-weight:600;margin-left:8px;">● ' + (outside === 'above' ? 'ABOVE' : 'BELOW') + ' weekly EM</span>'
      : '';

    return '<div class="em-banner">' +
      '<h4><i data-lucide="ruler"></i> Expected Move' + outsideTag + '</h4>' +
      '<div class="em-band-visual">' +
        '<div class="em-band-line low" style="left:' + pctLo + '%"></div>' +
        '<div class="em-band-label top" style="left:' + pctLo + '%;color:var(--red);transform:translateX(-50%)">L $' + lo.toFixed(0) + '</div>' +
        '<div class="em-band-line mid" style="left:' + pctMid + '%"></div>' +
        '<div class="em-band-label bottom" style="left:' + pctMid + '%;color:var(--text-dim);transform:translateX(-50%)">Mid $' + close.toFixed(0) + '</div>' +
        '<div class="em-band-line high" style="left:' + pctHi + '%"></div>' +
        '<div class="em-band-label top" style="left:' + pctHi + '%;color:var(--cyan);transform:translateX(-50%)">H $' + hi.toFixed(0) + '</div>' +
        '<div class="em-band-line current" style="left:' + pctCur + '%"></div>' +
        '<div class="em-band-label bottom" style="left:' + pctCur + '%;color:var(--gold);transform:translateX(-50%);font-size:11px;">▲ $' + price.toFixed(2) + '</div>' +
      '</div>' +
      '<div class="em-tiers">' +
        buildTierCard('Daily', d) +
        buildTierCard('Weekly', w, true) +
        buildTierCard('Monthly', m) +
        buildTierCard('Quarterly', q) +
      '</div>' +
    '</div>';
  }

  function buildTierCard(label, d, active) {
    return '<div class="em-tier' + (active ? ' active' : '') + '">' +
      '<div class="tier-label">' + label + '</div>' +
      '<div class="tier-value">±$' + (d.value || '—') + '</div>' +
      '<div class="tier-pct">' + (d.pct || '—') + '%</div>' +
      '<div class="tier-range">$' + (d.lower ? d.lower.toFixed(0) : '—') + '–$' + (d.upper ? d.upper.toFixed(0) : '—') + '</div>' +
    '</div>';
  }

  // === Signal Generation ===
  function generateSignals(t) {
    var signals = [];
    if (t.smaCrossover === 'death_cross') {
      signals.push({ icon: '<i data-lucide="skull"></i>', text: 'Death cross: SMA20 < SMA50' + (t.smaCrossoverDate ? ' (since ~' + t.smaCrossoverDate + ')' : ''), cls: 'signal-warn', priority: 2 });
    } else if (t.smaCrossover === 'golden_cross') {
      signals.push({ icon: '<i data-lucide="sparkles"></i>', text: 'Golden cross: SMA20 > SMA50' + (t.smaCrossoverDate ? ' (since ~' + t.smaCrossoverDate + ')' : ''), cls: 'signal-bull', priority: 2 });
    } else if (t.smaCrossover === 'compression') {
      signals.push({ icon: '<i data-lucide="refresh-cw"></i>', text: 'SMA compression: 20/50 converging', cls: 'signal-neutral', priority: 3 });
    }
    if (t.pctFrom52wHigh != null) {
      if (t.pctFrom52wHigh < -20) signals.push({ icon: '<i data-lucide="trending-down"></i>', text: 'Correction: ' + t.pctFrom52wHigh.toFixed(1) + '% from 52w high', cls: 'signal-warn', priority: 1 });
      else if (t.pctFrom52wHigh < -10) signals.push({ icon: '<i data-lucide="trending-down"></i>', text: t.pctFrom52wHigh.toFixed(1) + '% below 52w high', cls: 'signal-neutral', priority: 4 });
      else if (t.pctFrom52wHigh > -2) signals.push({ icon: '<i data-lucide="mountain"></i>', text: 'Near 52w high (' + t.pctFrom52wHigh.toFixed(1) + '%)', cls: 'signal-bull', priority: 3 });
    }
    if (t.rsi != null) {
      if (t.rsi > 70) signals.push({ icon: '<i data-lucide="triangle-alert"></i>', text: 'RSI ' + t.rsi + ' — overbought', cls: 'signal-warn', priority: 1 });
      else if (t.rsi < 30) signals.push({ icon: '<i data-lucide="circle-check-big"></i>', text: 'RSI ' + t.rsi + ' — oversold', cls: 'signal-bull', priority: 1 });
    }
    if (t.bbWidthPercentile != null && t.bbWidthPercentile < 15) {
      signals.push({ icon: '<i data-lucide="battery-charging"></i>', text: 'Bollinger squeeze (' + t.bbWidthPercentile + 'th pct)', cls: 'signal-neutral', priority: 2 });
    }
    if (t.volumeRatio != null && t.volumeRatio > 2.0) {
      signals.push({ icon: '<i data-lucide="flame"></i>', text: 'Heavy volume (' + t.volumeRatio + 'x avg)', cls: 'signal-bull', priority: 2 });
    }
    if (t.earningsDays != null && t.earningsDays <= 14) {
      signals.push({ icon: '<i data-lucide="triangle-alert"></i>', text: 'Earnings in ' + t.earningsDays + ' days (' + t.earningsDate + ')', cls: 'signal-warn', priority: 0 });
    }
    signals.sort(function(a, b) { return a.priority - b.priority; });
    return signals.slice(0, 6);
  }

  // Register page
  BT.pages.watchlist = {
    render: render,
    init: init,
    destroy: destroy
  };

  // Bridge for ticker-search
  window.openDetail = function(sym) {
    if (BT.pages.watchlist && watchlist.length) openDetail(sym);
  };
})();
