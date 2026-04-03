/**
 * pages/expected-moves.js — Expected Moves page module for BreakingTrades v2
 * Registers as BT.pages['expected-moves'] with render(), init(), destroy()
 */
(function() {
  'use strict';

  var emData = {};
  var emHistoryData = {};
  var watchlistData = [];
  var currentTier = 'weekly';
  var currentFilter = 'all';
  var sortCol = null;
  var sortAsc = false;
  var _collapsibles = [];

  var TOP10_SP = ['AAPL','MSFT','NVDA','AMZN','META','GOOGL','GOOG','TSLA','BRK B','AVGO'];
  var INDICES = ['SPX','SPY','QQQ','IWM','DIA','TLT','HYG','LQD','GLD','USO','UNG','IBIT'];

  var EXCHANGE_MAP = {
    'AAPL':'NASDAQ','AMZN':'NASDAQ','GOOG':'NASDAQ','GOOGL':'NASDAQ','MSFT':'NASDAQ','NVDA':'NASDAQ',
    'META':'NASDAQ','COIN':'NASDAQ','ARM':'NASDAQ','DELL':'NYSE','TSLA':'NASDAQ','NFLX':'NASDAQ',
    'AMD':'NASDAQ','AVGO':'NASDAQ','MU':'NASDAQ','QCOM':'NASDAQ','AMAT':'NASDAQ','LRCX':'NASDAQ',
    'SPX':'SP','SPY':'AMEX','QQQ':'NASDAQ','IWM':'AMEX','DIA':'AMEX','HYG':'AMEX','TLT':'NASDAQ',
    'XLU':'AMEX','XLK':'AMEX','XLE':'AMEX','XLV':'AMEX','XLF':'AMEX','XLP':'AMEX',
    'GLD':'AMEX','SLV':'AMEX','URA':'AMEX','USO':'AMEX','UNG':'AMEX','IBIT':'NASDAQ',
    'EQIX':'NASDAQ','DLR':'NYSE','AMT':'NYSE'
  };

  function getRiskColor(pct) {
    if (pct <= 20) return '#1b5e20';
    if (pct <= 40) return '#4caf50';
    if (pct <= 55) return '#8bc34a';
    if (pct <= 70) return '#ffeb3b';
    if (pct <= 85) return '#ff9800';
    if (pct <= 100) return '#f44336';
    return '#b71c1c';
  }

  function getRiskLabel(pct) {
    if (pct <= 20) return { text: 'LOW', color: '#1b5e20', bg: 'rgba(27,94,32,0.2)' };
    if (pct <= 40) return { text: 'LOW', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' };
    if (pct <= 55) return { text: 'MODERATE', color: '#8bc34a', bg: 'rgba(139,195,74,0.15)' };
    if (pct <= 70) return { text: 'ELEVATED', color: '#ffeb3b', bg: 'rgba(255,235,59,0.15)' };
    if (pct <= 85) return { text: 'HIGH', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' };
    if (pct <= 100) return { text: 'EXTENDED', color: '#f44336', bg: 'rgba(244,67,54,0.15)' };
    return { text: 'ABOVE EM', color: '#b71c1c', bg: 'rgba(183,28,28,0.2)' };
  }

  function render(el) {
    el.innerHTML =
      '<div class="page-content" style="max-width:1400px;margin:0 auto;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">' +
          '<div>' +
            '<h1 style="font-size:20px;color:var(--text-bright);margin:0;"><i data-lucide="ruler"></i> Expected Moves</h1>' +
            '<div style="font-size:12px;color:var(--text-dim);">Options-implied weekly ranges · ATM straddle × 0.85</div>' +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);" id="em-updated"></div>' +
        '</div>' +
        '<div id="section-em-stats">' +
          '<div class="section-title" id="hdr-em-stats" style="font-size:10px;margin-bottom:8px;"><i data-lucide="bar-chart-3"></i> Statistics</div>' +
          '<div id="body-em-stats">' +
            '<div class="em-stats-row" id="em-stats-row">' +
              '<div class="skeleton skeleton-card small"></div><div class="skeleton skeleton-card small"></div><div class="skeleton skeleton-card small"></div><div class="skeleton skeleton-card small"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="section-em-legend">' +
          '<div id="hdr-em-legend" style="font-size:10px;color:var(--text-dim);margin-bottom:8px;cursor:pointer;"><i data-lucide="palette"></i> Color Legend</div>' +
          '<div id="body-em-legend">' +
            '<div class="em-legend">' +
          '<span style="color:var(--text-dim);">Long Risk:</span>' +
          '<div class="em-legend-item"><div class="em-legend-swatch" style="background:#1b5e20;"></div> Low</div>' +
          '<div class="em-legend-item"><div class="em-legend-swatch" style="background:#8bc34a;"></div> Moderate</div>' +
          '<div class="em-legend-item"><div class="em-legend-swatch" style="background:#ffeb3b;"></div> Elevated</div>' +
          '<div class="em-legend-item"><div class="em-legend-swatch" style="background:#ff9800;"></div> High</div>' +
          '<div class="em-legend-item"><div class="em-legend-swatch" style="background:#f44336;"></div> Extended</div>' +
          '<div class="em-legend-item"><div class="em-legend-swatch" style="background:#b71c1c;"></div> Above EM</div>' +
          '</div>' +
          '</div>' +
        '</div>' +
        '<div class="em-tabs-row">' +
          '<div class="em-tier-tabs" id="em-tier-tabs">' +
            '<button class="em-tier-tab active" data-tier="weekly">Weekly</button>' +
            '<button class="em-tier-tab" data-tier="daily">Daily</button>' +
            '<button class="em-tier-tab" data-tier="monthly">Monthly</button>' +
            '<button class="em-tier-tab" data-tier="quarterly">Quarterly</button>' +
          '</div>' +
          '<div class="em-tier-tabs" id="em-filter-tabs">' +
            '<button class="em-tier-tab em-filter-tab active" data-filter="all">All</button>' +
            '<button class="em-tier-tab em-filter-tab" data-filter="indices">Indices</button>' +
            '<button class="em-tier-tab em-filter-tab" data-filter="top10">Top 10 S&amp;P</button>' +
            '<button class="em-tier-tab em-filter-tab" data-filter="watchlist">Watchlist</button>' +
          '</div>' +
        '</div>' +
        '<div class="em-table-wrap">' +
          '<table class="em-table">' +
            '<thead><tr>' +
              '<th data-col="symbol">Ticker</th>' +
              '<th data-col="current">Price</th>' +
              '<th data-col="change">Change</th>' +
              '<th data-col="em">± EM</th>' +
              '<th data-col="pct">EM %</th>' +
              '<th data-col="lower">Low</th>' +
              '<th data-col="upper">High</th>' +
              '<th data-col="position" style="min-width:140px;">Position in Range</th>' +
              '<th data-col="risk">Risk Level</th>' +
              '<th data-col="riskbar" style="min-width:130px;">Risk Meter</th>' +
              '<th data-col="bias">Bias</th>' +
            '</tr></thead>' +
            '<tbody id="em-tbody">' +
              Array(20).join('<tr><td colspan="11"><div class="skeleton skeleton-table-row"></div></td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      // Detail Modal
      '<div class="em-modal-overlay" id="em-modal">' +
        '<div class="em-modal-box">' +
          '<div class="em-modal-header">' +
            '<div class="ticker-info">' +
              '<span class="modal-ticker" id="em-modal-ticker"></span>' +
              '<span class="modal-name" id="em-modal-name"></span>' +
              '<span class="modal-price-tag" id="em-modal-price"></span>' +
              '<span class="em-bias-badge" id="em-modal-bias"></span>' +
            '</div>' +
            '<button class="em-modal-close" id="em-modal-close-btn">✕</button>' +
          '</div>' +
          '<div class="em-modal-body" id="em-modal-body"></div>' +
        '</div>' +
      '</div>';
  }

  function init() {
    // Wire collapsibles
    _collapsibles = [];
    [['em:stats', 'hdr-em-stats', 'body-em-stats'], ['em:legend', 'hdr-em-legend', 'body-em-legend']].forEach(function(s) {
      var hdr = document.getElementById(s[1]);
      var body = document.getElementById(s[2]);
      if (hdr && body) _collapsibles.push(BT.components.collapsible.init(s[0], hdr, body));
    });

    // Bind tier tabs
    document.querySelectorAll('#em-tier-tabs .em-tier-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#em-tier-tabs .em-tier-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentTier = btn.getAttribute('data-tier');
        doRender();
      });
    });

    // Bind filter tabs
    document.querySelectorAll('#em-filter-tabs .em-filter-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#em-filter-tabs .em-filter-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        doRender();
      });
    });

    // Bind sortable headers (3-state)
    document.querySelectorAll('.em-table thead th[data-col]').forEach(function(th) {
      th.addEventListener('click', function() {
        var col = th.getAttribute('data-col');
        document.querySelectorAll('.em-table thead th').forEach(function(h) { h.classList.remove('sort-asc','sort-desc'); });
        if (sortCol === col) {
          if (sortAsc) { sortAsc = false; th.classList.add('sort-desc'); }
          else { sortCol = null; sortAsc = false; }
        } else {
          sortCol = col; sortAsc = true; th.classList.add('sort-asc');
        }
        doRender();
      });
    });

    // Modal
    var modalOverlay = document.getElementById('em-modal');
    if (modalOverlay) modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeEMDetail(); });
    var closeBtn = document.getElementById('em-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeEMDetail);
    document.addEventListener('keydown', _onKeyDown);

    // Bridge for ticker-search
    window.openDetail = openEMDetail;

    loadData();

    // Auto-refresh prices every 5 min during market hours
    var btPricesRef = window.btPrices;
    if (btPricesRef && btPricesRef.startAutoRefresh) {
      btPricesRef.onRefresh(function() {
        // Update the prices label
        var updatedEl = document.getElementById('em-updated');
        if (updatedEl && emData.updated) {
          var updatedDate = new Date(emData.updated);
          var ageHours = (Date.now() - updatedDate.getTime()) / 3600000;
          var label = 'EM Ranges: ' + updatedDate.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/New_York' }) + ' ET';
          if (ageHours > 48) { updatedEl.style.color = 'var(--red)'; label += ' (' + Math.round(ageHours / 24) + 'd old)'; }
          else if (ageHours > 24) { updatedEl.style.color = 'var(--orange)'; label += ' (' + Math.round(ageHours) + 'h ago)'; }
          if (btPricesRef.updatedLabel) label += ' · Prices: ' + btPricesRef.updatedLabel() + ' (live)';
          updatedEl.textContent = label;
        }
        doRender();
      });
      btPricesRef.startAutoRefresh();
    }
  }

  function destroy() {
    document.removeEventListener('keydown', _onKeyDown);
    _collapsibles.forEach(function(c) { if (c && c.destroy) c.destroy(); });
    _collapsibles = [];
    emData = {};
    emHistoryData = {};
    watchlistData = [];
    sortCol = null;
    currentTier = 'weekly';
    currentFilter = 'all';
    var btPricesRef = window.btPrices;
    if (btPricesRef && btPricesRef.stopAutoRefresh) btPricesRef.stopAutoRefresh();
  }

  function _onKeyDown(e) { if (e.key === 'Escape') closeEMDetail(); }

  function loadData() {
    var btPrices = window.btPrices;
    var pricesReady = btPrices && btPrices.load ? btPrices.load() : Promise.resolve();

    Promise.all([
      fetch('data/expected-moves.json').then(function(r) { return r.ok ? r.json() : {}; }),
      fetch('data/watchlist.json').then(function(r) { return r.ok ? r.json() : []; }),
      fetch('data/em-quarterly-history.json').then(function(r) { return r.ok ? r.json() : {}; }).catch(function() { return {}; }),
      pricesReady
    ]).then(function(results) {
      emData = results[0] || {};
      watchlistData = results[1] || [];
      emHistoryData = results[2] || {};

      // Updated timestamp + staleness
      var updatedEl = document.getElementById('em-updated');
      if (updatedEl && emData.updated) {
        var updatedDate = new Date(emData.updated);
        var ageHours = (Date.now() - updatedDate.getTime()) / 3600000;
        var label = 'EM Ranges: ' + updatedDate.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/New_York' }) + ' ET';
        if (ageHours > 48) { updatedEl.style.color = 'var(--red)'; label += ' (' + Math.round(ageHours / 24) + 'd old)'; }
        else if (ageHours > 24) { updatedEl.style.color = 'var(--orange)'; label += ' (' + Math.round(ageHours) + 'h ago)'; }
        if (btPrices && btPrices.updatedLabel) label += ' · Prices: ' + btPrices.updatedLabel();
        updatedEl.textContent = label;
      }

      doRender();
    }).catch(function(err) {
      console.error('Failed to load EM data:', err);
      var tbody = document.getElementById('em-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--red);padding:40px;">Failed to load expected move data</td></tr>';
    });
  }

  function buildRows() {
    var tickers = emData.tickers || {};
    var btPrices = window.btPrices;
    var rows = [];

    var syms = Object.keys(tickers);
    for (var i = 0; i < syms.length; i++) {
      var sym = syms[i];
      var t = tickers[sym];
      var tier = t[currentTier] || {};
      if (!tier.upper || !tier.lower) continue;

      var wl = null;
      for (var j = 0; j < watchlistData.length; j++) {
        if (watchlistData[j].symbol === sym) { wl = watchlistData[j]; break; }
      }

      var currentPrice = (btPrices && btPrices.price ? btPrices.price(sym) : null) || (wl ? wl.price : null) || t.close;
      var change = (btPrices && btPrices.change ? btPrices.change(sym) : null) || (wl ? wl.change : null) || 0;

      // Filter
      if (currentFilter === 'indices' && INDICES.indexOf(sym) === -1) continue;
      if (currentFilter === 'top10' && TOP10_SP.indexOf(sym) === -1) continue;
      if (currentFilter === 'watchlist' && !wl) continue;

      var lo = tier.lower, hi = tier.upper;
      var range = hi - lo;
      var position = range > 0 ? ((currentPrice - lo) / range) * 100 : 50;
      var clampedPos = Math.max(0, Math.min(100, position));
      var risk = getRiskLabel(position);
      var riskColor = getRiskColor(position);

      var biasHtml = '<span style="color:var(--text-dim)">—</span>';
      if (wl) {
        var bias = wl.bias;
        var biasColor = bias === 'bull' ? '#4caf50' : bias === 'bear' ? '#f44336' : '#aaa';
        var biasArrow = bias === 'bull' ? '▲' : bias === 'bear' ? '▼' : '—';
        var above200 = wl.sma200 && currentPrice > wl.sma200;
        var smaTag = above200
          ? '<span style="color:#4caf50;font-size:10px;margin-left:4px;">↑200</span>'
          : '<span style="color:#f44336;font-size:10px;margin-left:4px;">↓200</span>';
        biasHtml = '<span style="color:' + biasColor + ';font-weight:600;">' + biasArrow + ' ' + (bias||'').toUpperCase() + '</span>' + smaTag;
      }

      rows.push({
        symbol: sym, close: t.close, current: currentPrice, change: change,
        em: tier.value, pct: tier.pct, lower: lo, upper: hi,
        position: position, clampedPos: clampedPos,
        risk: risk, riskColor: riskColor,
        proxy: t.futures_proxy, biasHtml: biasHtml
      });
    }
    return rows;
  }

  function sortRows(rows) {
    if (!sortCol) return;
    rows.sort(function(a, b) {
      var va, vb;
      switch(sortCol) {
        case 'symbol': va = a.symbol; vb = b.symbol; break;
        case 'current': va = a.current; vb = b.current; break;
        case 'change': va = a.change; vb = b.change; break;
        case 'em': va = parseFloat(a.em)||0; vb = parseFloat(b.em)||0; break;
        case 'pct': va = a.pct||0; vb = b.pct||0; break;
        case 'lower': va = a.lower; vb = b.lower; break;
        case 'upper': va = a.upper; vb = b.upper; break;
        default: va = a.position; vb = b.position; break;
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }

  function doRender() {
    if (!emData.tickers) return;
    var rows = buildRows();
    sortRows(rows);
    renderStats(rows);
    renderTable(rows);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderStats(rows) {
    var el = document.getElementById('em-stats-row');
    if (!el) return;
    if (!rows.length) { el.innerHTML = ''; return; }

    var avgPct = 0;
    for (var i = 0; i < rows.length; i++) avgPct += (rows[i].pct || 0);
    avgPct /= rows.length;

    var maxEM = rows[0], minEM = rows[0];
    var extended = 0, buyZone = 0;
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i].pct || 0) > (maxEM.pct || 0)) maxEM = rows[i];
      if ((rows[i].pct || 0) < (minEM.pct || 0)) minEM = rows[i];
      if (rows[i].position > 85) extended++;
      if (rows[i].position <= 20) buyZone++;
    }

    el.innerHTML =
      '<div class="em-stat-card">' +
        '<div class="em-stat-label">Avg ' + currentTier + ' EM</div>' +
        '<div class="em-stat-value">' + avgPct.toFixed(1) + '%</div>' +
        '<div class="em-stat-sub">' + rows.length + ' tickers</div>' +
      '</div>' +
      '<div class="em-stat-card">' +
        '<div class="em-stat-label">Highest EM</div>' +
        '<div class="em-stat-value" style="color:var(--orange)">' + maxEM.symbol + '</div>' +
        '<div class="em-stat-sub">±' + maxEM.pct + '% ($' + maxEM.em + ')</div>' +
      '</div>' +
      '<div class="em-stat-card">' +
        '<div class="em-stat-label"><i data-lucide="circle-check-big"></i> Buy Zone</div>' +
        '<div class="em-stat-value" style="color:' + (buyZone > 0 ? '#4caf50' : 'var(--text-dim)') + '">' + buyZone + '</div>' +
        '<div class="em-stat-sub">near low of EM range</div>' +
      '</div>' +
      '<div class="em-stat-card">' +
        '<div class="em-stat-label"><i data-lucide="octagon-alert"></i> Extended</div>' +
        '<div class="em-stat-value" style="color:' + (extended > 0 ? 'var(--red)' : 'var(--text-dim)') + '">' + extended + '</div>' +
        '<div class="em-stat-sub">at/above EM ceiling</div>' +
      '</div>';
  }

  function renderTable(rows) {
    var tbody = document.getElementById('em-tbody');
    if (!tbody) return;

    tbody.innerHTML = rows.map(function(r) {
      var chgClass = r.change >= 0 ? 'up' : 'down';
      var chgSign = r.change >= 0 ? '+' : '';
      var needlePct = Math.max(0, Math.min(100, r.position)).toFixed(1);

      var alertTag = '', rowClass = '';
      if (r.position <= 10) {
        alertTag = '<span class="em-alert-tag" style="color:#4caf50;background:rgba(76,175,80,0.2);border:1px solid #4caf5060;">AT SUPPORT</span>';
        rowClass = 'alert-buy';
      } else if (r.position <= 20) {
        alertTag = '<span class="em-alert-tag" style="color:#8bc34a;background:rgba(139,195,74,0.15);border:1px solid #8bc34a50;">NEAR LOW</span>';
        rowClass = 'alert-buy';
      } else if (r.position < 0) {
        alertTag = '<span class="em-alert-tag" style="color:#00e676;background:rgba(0,230,118,0.15);border:1px solid #00e67660;">BELOW EM</span>';
        rowClass = 'alert-buy';
      } else if (r.position >= 100) {
        alertTag = '<span class="em-alert-tag" style="color:#f44336;background:rgba(244,67,54,0.15);border:1px solid #f4433660;">ABOVE EM</span>';
        rowClass = 'alert-sell';
      } else if (r.position >= 90) {
        alertTag = '<span class="em-alert-tag" style="color:#ff5722;background:rgba(255,87,34,0.15);border:1px solid #ff572260;">AT CEILING</span>';
        rowClass = 'alert-sell';
      }

      return '<tr class="' + rowClass + '" data-sym="' + r.symbol + '">' +
        '<td class="ticker-cell">' + r.symbol + (r.proxy ? ' <span style="color:var(--text-dim);font-size:11px;">(' + r.proxy.futures + ')</span>' : '') + ' ' + alertTag + '</td>' +
        '<td>$' + r.current.toFixed(2) + '</td>' +
        '<td class="' + chgClass + '">' + chgSign + r.change.toFixed(2) + '%</td>' +
        '<td>±$' + r.em + '</td>' +
        '<td style="color:var(--orange)">±' + r.pct + '%</td>' +
        '<td style="color:var(--cyan)">$' + r.lower.toFixed(2) + '</td>' +
        '<td style="color:var(--red)">$' + r.upper.toFixed(2) + '</td>' +
        '<td>' +
          '<div class="em-pos-bar">' +
            '<div class="em-pos-fill" style="width:' + r.clampedPos + '%;background:' + r.riskColor + ';opacity:0.3;"></div>' +
            '<div class="em-pos-marker" style="left:' + r.clampedPos + '%;"></div>' +
          '</div>' +
          '<div style="color:var(--text-dim);font-size:11px;margin-top:3px;">' + r.position.toFixed(0) + '% of range</div>' +
        '</td>' +
        '<td><span class="em-risk-badge" style="color:' + r.risk.color + ';background:' + r.risk.bg + ';border:1px solid ' + r.risk.color + '40;">' + r.risk.text + '</span></td>' +
        '<td><div class="em-risk-bar-wrap"><div class="em-risk-fill" style="width:' + Math.max(4, Math.min(100, r.position)) + '%;background:' + r.riskColor + ';"></div></div></td>' +
        '<td style="white-space:nowrap;">' + r.biasHtml + '</td>' +
      '</tr>';
    }).join('');

    // Bind row clicks
    tbody.querySelectorAll('tr[data-sym]').forEach(function(tr) {
      tr.addEventListener('click', function() { openEMDetail(tr.getAttribute('data-sym')); });
    });
  }

  // === EM Detail Modal ===
  function openEMDetail(symbol) {
    var tickers = emData.tickers || {};
    var t = tickers[symbol];
    var wl = null;
    for (var j = 0; j < watchlistData.length; j++) {
      if (watchlistData[j].symbol === symbol) { wl = watchlistData[j]; break; }
    }
    var isExternal = !t;
    var btPrices = window.btPrices;

    var price = (btPrices && btPrices.price ? btPrices.price(symbol) : null) || (wl ? wl.price : null) || (t ? t.close : null);
    var change = (btPrices && btPrices.change ? btPrices.change(symbol) : null) || (wl ? wl.change : null) || 0;
    var chgClass = change >= 0 ? 'up' : 'down';
    var chgSign = change >= 0 ? '+' : '';
    var bias = wl ? wl.bias : null;
    var exchange = EXCHANGE_MAP[symbol] || 'NYSE';
    var tvSymbol = exchange + ':' + symbol;

    document.getElementById('em-modal-ticker').textContent = symbol;
    document.getElementById('em-modal-name').textContent = isExternal
      ? 'External Ticker · TradingView Data'
      : (wl ? (wl.name || '') + ' · ' + (wl.sector || '') : '');
    document.getElementById('em-modal-price').innerHTML = price
      ? '<span class="' + chgClass + '">$' + price.toFixed(2) + '</span> <span class="' + chgClass + '" style="font-size:12px">' + chgSign + Math.abs(change).toFixed(2) + '%</span>'
      : '<span style="color:var(--text-dim)">—</span>';

    var biasEl = document.getElementById('em-modal-bias');
    if (bias) {
      biasEl.className = 'em-bias-badge';
      biasEl.style.cssText = bias === 'bull' ? 'background:rgba(0,212,170,0.15);color:var(--cyan);' : bias === 'bear' ? 'background:rgba(239,83,80,0.15);color:var(--red);' : 'background:rgba(255,167,38,0.15);color:var(--orange);';
      biasEl.textContent = bias.toUpperCase();
      biasEl.style.display = '';
    } else { biasEl.style.display = 'none'; }

    var bodyHTML;
    if (isExternal) {
      bodyHTML = '<div class="em-chart-box"><div class="em-chart-label">' + symbol + ' — Daily Chart</div><div id="em-tv-chart" style="height:400px;"></div></div>' +
        '<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:12px;">Not in watchlist · No expected move data</div>';
    } else {
      var tiers = [['Daily', t.daily], ['Weekly', t.weekly], ['Monthly', t.monthly], ['Quarterly', t.quarterly]];
      var tierCards = '';
      for (var i = 0; i < tiers.length; i++) {
        var label = tiers[i][0], d = tiers[i][1];
        if (!d || !d.upper) continue;
        var pos = d.upper > d.lower ? ((price - d.lower) / (d.upper - d.lower)) * 100 : 50;
        var cp = Math.max(0, Math.min(100, pos));
        var rc = getRiskColor(pos);
        var rt = getRiskLabel(pos).text;
        tierCards += '<div class="em-info-card">' +
          '<h4>' + label + '</h4>' +
          '<div class="em-detail-level"><span class="em-dl-label">EM ±</span><span class="em-dl-value">$' + d.value + ' (' + d.pct + '%)</span></div>' +
          '<div class="em-detail-level"><span class="em-dl-label">Low</span><span class="em-dl-value" style="color:var(--cyan)">$' + d.lower.toFixed(2) + '</span></div>' +
          '<div class="em-detail-level"><span class="em-dl-label">High</span><span class="em-dl-value" style="color:var(--red)">$' + d.upper.toFixed(2) + '</span></div>' +
          '<div class="em-detail-level"><span class="em-dl-label">Position</span><span class="em-dl-value" style="color:' + rc + '">' + pos.toFixed(0) + '%</span></div>' +
          '<div class="em-pos-bar" style="margin-top:8px;"><div class="em-pos-fill" style="width:' + cp + '%;background:' + rc + ';opacity:0.3;"></div><div class="em-pos-marker" style="left:' + cp + '%;"></div></div>' +
          '<div style="margin-top:4px;font-size:11px;color:' + rc + '">' + rt + '</div>' +
        '</div>';
      }
      bodyHTML = '<div class="em-chart-box"><div class="em-chart-label">' + symbol + ' — Daily Chart</div><div id="em-tv-chart" style="height:400px;"></div></div>' +
        '<div class="em-info-row">' + tierCards + '</div>';
    }

    // Append quarterly history section
    var historyHTML = buildQuarterlyHistory(symbol, price);
    if (historyHTML) bodyHTML += historyHTML;

    document.getElementById('em-modal-body').innerHTML = bodyHTML;

    // Inject TradingView chart
    var chartContainer = document.getElementById('em-tv-chart');
    if (chartContainer) {
      var s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      s.async = true;
      s.innerHTML = JSON.stringify({
        autosize: true, height: 400, symbol: tvSymbol,
        interval: 'D', timezone: 'America/New_York',
        theme: 'dark', style: '1', locale: 'en',
        hide_top_toolbar: false, hide_legend: false,
        allow_symbol_change: false, save_image: false
      });
      chartContainer.appendChild(s);
    }

    document.getElementById('em-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function buildQuarterlyHistory(symbol, currentPrice) {
    var histTickers = (emHistoryData && emHistoryData.tickers) || {};
    var tickerHist = histTickers[symbol];
    if (!tickerHist || !tickerHist.quarters || !tickerHist.quarters.length) return '';

    var quarters = tickerHist.quarters;
    var accuracy = tickerHist.accuracy || {};

    // Find min/max across all quarters for unified scale
    var allMin = Infinity, allMax = -Infinity;
    for (var i = 0; i < quarters.length; i++) {
      var q = quarters[i];
      if (q.quarterly.lower < allMin) allMin = q.quarterly.lower;
      if (q.quarterly.upper > allMax) allMax = q.quarterly.upper;
      if (q.outcome && q.outcome.actual_close < allMin) allMin = q.outcome.actual_close;
      if (q.outcome && q.outcome.actual_close > allMax) allMax = q.outcome.actual_close;
    }
    if (currentPrice < allMin) allMin = currentPrice;
    if (currentPrice > allMax) allMax = currentPrice;
    var range = allMax - allMin;
    var pad = range * 0.08;
    allMin -= pad;
    allMax += pad;
    range = allMax - allMin;

    function toLeftPct(val) {
      return Math.max(0, Math.min(100, ((val - allMin) / range) * 100));
    }

    // Build accuracy badge
    var accBadge = '';
    if (accuracy.total > 0) {
      var accPct = accuracy.pct || 0;
      var accColor = accPct >= 60 ? 'var(--green)' : accPct >= 40 ? 'var(--orange)' : 'var(--red)';
      accBadge = '<span style="font-size:11px;color:' + accColor + ';font-weight:600;margin-left:12px;">' +
        accuracy.within + '/' + accuracy.total + ' within range (' + accPct + '%)' +
      '</span>';
    }

    var html = '<div class="em-qh-section">' +
      '<div class="em-qh-header">' +
        '<span class="em-qh-title"><i data-lucide="calendar-range"></i> Quarterly EM History</span>' +
        accBadge +
      '</div>' +
      '<div class="em-qh-scale">' +
        '<span>$' + allMin.toFixed(0) + '</span>' +
        '<span style="color:var(--text-dim);font-size:10px;">Price Scale</span>' +
        '<span>$' + allMax.toFixed(0) + '</span>' +
      '</div>';

    for (var i = 0; i < quarters.length; i++) {
      var q = quarters[i];
      var lo = q.quarterly.lower;
      var hi = q.quarterly.upper;
      var close = q.close;
      var loLeft = toLeftPct(lo);
      var hiLeft = toLeftPct(hi);
      var barWidth = hiLeft - loLeft;
      var closeLeft = toLeftPct(close);

      // Outcome marker
      var outcomeMarker = '';
      var outcomeLabel = '';
      if (q.outcome) {
        var actual = q.outcome.actual_close;
        var actualLeft = toLeftPct(actual);
        var oc = q.outcome.status === 'within' ? 'var(--green)' : 'var(--red)';
        var statusIcon = q.outcome.status === 'within' ? '\u2713' : '\u2717';
        outcomeMarker = '<div class="em-qh-marker em-qh-outcome" style="left:' + actualLeft + '%;">' +
          '<div class="em-qh-diamond" style="background:' + oc + ';"></div>' +
        '</div>';
        var devSign = q.outcome.deviation_pct >= 0 ? '+' : '';
        outcomeLabel = '<span style="color:' + oc + ';font-size:11px;font-weight:600;">' +
          statusIcon + ' $' + actual.toFixed(0) + ' (' + devSign + q.outcome.deviation_pct + '%)' +
        '</span>';
      } else {
        // Current quarter — show where price is now
        var nowLeft = toLeftPct(currentPrice);
        var nowInRange = currentPrice >= lo && currentPrice <= hi;
        var nowColor = nowInRange ? 'var(--gold)' : 'var(--orange)';
        outcomeMarker = '<div class="em-qh-marker em-qh-now" style="left:' + nowLeft + '%;">' +
          '<div class="em-qh-diamond" style="background:' + nowColor + ';"></div>' +
        '</div>';
        outcomeLabel = '<span style="color:' + nowColor + ';font-size:11px;font-weight:600;">Now: $' + currentPrice.toFixed(0) + '</span>';
      }

      html += '<div class="em-qh-row">' +
        '<div class="em-qh-label">' +
          '<div style="font-weight:600;color:var(--text-bright);">' + q.quarter + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);">' + q.date + ' &middot; IV ' + q.iv + '%</div>' +
        '</div>' +
        '<div class="em-qh-bar-container">' +
          '<div class="em-qh-track">' +
            '<div class="em-qh-range" style="left:' + loLeft + '%;width:' + barWidth + '%;"></div>' +
            '<div class="em-qh-marker em-qh-close" style="left:' + closeLeft + '%;">' +
              '<div class="em-qh-dot"></div>' +
            '</div>' +
            outcomeMarker +
          '</div>' +
          '<div class="em-qh-values">' +
            '<span style="color:var(--cyan);font-size:11px;">$' + lo.toFixed(0) + '</span>' +
            '<span style="color:var(--text-dim);font-size:11px;">$' + close.toFixed(0) + ' \u00b1' + q.quarterly.pct + '%</span>' +
            outcomeLabel +
            '<span style="color:var(--red);font-size:11px;">$' + hi.toFixed(0) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // Legend
    html += '<div class="em-qh-legend">' +
      '<span><span class="em-qh-dot" style="display:inline-block;"></span> Quarter-end close</span>' +
      '<span><span class="em-qh-diamond" style="display:inline-block;background:var(--green);"></span> Outcome (within range)</span>' +
      '<span><span class="em-qh-diamond" style="display:inline-block;background:var(--red);"></span> Outcome (outside range)</span>' +
      '<span><span class="em-qh-diamond" style="display:inline-block;background:var(--gold);"></span> Current price</span>' +
    '</div>';

    html += '</div>';
    return html;
  }

  function closeEMDetail() {
    var modal = document.getElementById('em-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    var chart = document.getElementById('em-tv-chart');
    if (chart) chart.innerHTML = '';
  }

  BT.pages['expected-moves'] = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
