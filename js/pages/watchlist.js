/**
 * pages/watchlist.js — Watchlist page module for BreakingTrades v2
 * Registers as BT.pages.watchlist with render(), init(), destroy()
 */
(function() {
  'use strict';

  var watchlist = [];
  var emData = {};
  var sortCol = 0;
  var sortDir = 'asc'; // 'asc' | 'desc' | 'none'
  var sortAsc = true;  // kept for back-compat with existing callers

  // === Filter / grouping / column state ===
  var DEFAULT_FILTERS = {
    bias: 'all',       // all | bull | bear | mixed
    status: 'all',     // all | watching | approaching | active | exit
    sector: 'all',
    group: 'all',
    alert: 'all',      // all | earnings14 | earnings7 | rsiOB | rsiOS | bbSqueeze | volSpike | deathCross | goldenCross
    search: ''
  };
  var DEFAULT_COLUMNS = {
    rsi: true, atr: true, volRatio: true, earnings: true, bbWidth: false, pos52w: false
  };
  var activeFilters = Object.assign({}, DEFAULT_FILTERS);
  var visibleCols = Object.assign({}, DEFAULT_COLUMNS);
  var grouping = 'none'; // 'none' | 'sector' | 'group'

  // === Filter engine (exported for tests) ===
  function classifyAlerts(t) {
    var alerts = [];
    if (t.earningsDays != null) {
      if (t.earningsDays <= 7) alerts.push('earnings7');
      if (t.earningsDays <= 14) alerts.push('earnings14');
    }
    if (t.rsi != null) {
      if (t.rsi > 70) alerts.push('rsiOB');
      if (t.rsi < 30) alerts.push('rsiOS');
    }
    if (t.bbWidthPercentile != null && t.bbWidthPercentile < 15) alerts.push('bbSqueeze');
    if (t.volumeRatio != null && t.volumeRatio > 2.0) alerts.push('volSpike');
    if (t.smaCrossover === 'death_cross') alerts.push('deathCross');
    if (t.smaCrossover === 'golden_cross') alerts.push('goldenCross');
    return alerts;
  }

  function applyFilters(list, f) {
    f = f || activeFilters;
    var q = (f.search || '').trim().toLowerCase();
    return list.filter(function(t) {
      if (f.bias !== 'all' && (t.bias || 'mixed') !== f.bias) return false;
      if (f.status !== 'all' && (t.status || 'watching') !== f.status) return false;
      if (f.sector !== 'all' && t.sector !== f.sector) return false;
      if (f.group !== 'all' && t.group !== f.group) return false;
      if (f.alert !== 'all') {
        var a = classifyAlerts(t);
        if (a.indexOf(f.alert) === -1) return false;
      }
      if (q) {
        var hay = (t.symbol + ' ' + (t.name||'')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function computeStats(list) {
    var s = { total: list.length, bull: 0, bear: 0, mixed: 0, watching: 0, approaching: 0, active: 0, exit: 0, earnings14: 0 };
    list.forEach(function(t) {
      var b = t.bias || 'mixed';
      if (s[b] != null) s[b]++;
      var st = t.status || 'watching';
      if (s[st] != null) s[st]++;
      if (t.earningsDays != null && t.earningsDays <= 14) s.earnings14++;
    });
    return s;
  }

  function sectorAggregates(list) {
    var map = {};
    list.forEach(function(t) {
      var key = t.sector || '—';
      if (!map[key]) map[key] = { sector: key, count: 0, bull: 0, bear: 0, mixed: 0, sumChg: 0, sumRsi: 0, rsiN: 0 };
      var m = map[key];
      m.count++;
      var b = t.bias || 'mixed';
      if (m[b] != null) m[b]++;
      if (t.change != null) m.sumChg += t.change;
      if (t.rsi != null) { m.sumRsi += t.rsi; m.rsiN++; }
    });
    return Object.keys(map).map(function(k) {
      var m = map[k];
      m.pctBull = m.count ? Math.round((m.bull / m.count) * 100) : 0;
      m.avgChg = m.count ? m.sumChg / m.count : 0;
      m.avgRsi = m.rsiN ? m.sumRsi / m.rsiN : null;
      return m;
    }).sort(function(a, b) { return b.count - a.count; });
  }

  // Expose for tests (node require or window)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classifyAlerts: classifyAlerts, applyFilters: applyFilters, computeStats: computeStats, sectorAggregates: sectorAggregates };
  } else if (typeof window !== 'undefined') {
    window.BT = window.BT || {};
    window.BT.watchlistEngine = { classifyAlerts: classifyAlerts, applyFilters: applyFilters, computeStats: computeStats, sectorAggregates: sectorAggregates };
  }

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
          '<div class="wl-page-title"><i data-lucide="clipboard-list"></i> Watchlist — <span id="wl-count">0</span> / <span id="wl-total">0</span> Symbols</div>' +
          '<div class="wl-header-actions">' +
            '<div class="wl-group-toggle" role="group" aria-label="Grouping">' +
              '<button class="wl-group-btn active" data-group="none">Flat</button>' +
              '<button class="wl-group-btn" data-group="sector">By Sector</button>' +
              '<button class="wl-group-btn" data-group="group">By Section</button>' +
            '</div>' +
            '<button class="wl-icon-btn" id="wl-col-btn" title="Columns" aria-label="Columns"><i data-lucide="settings-2"></i></button>' +
            '<div class="wl-col-panel" id="wl-col-panel" hidden>' +
              '<div class="wl-col-panel-title">Columns</div>' +
              '<label><input type="checkbox" data-col-toggle="rsi"> RSI</label>' +
              '<label><input type="checkbox" data-col-toggle="atr"> ATR %</label>' +
              '<label><input type="checkbox" data-col-toggle="volRatio"> Vol Ratio</label>' +
              '<label><input type="checkbox" data-col-toggle="earnings"> Earnings</label>' +
              '<label><input type="checkbox" data-col-toggle="bbWidth"> BB Width</label>' +
              '<label><input type="checkbox" data-col-toggle="pos52w"> 52w Pos</label>' +
            '</div>' +
            '<div class="wl-view-toggle">' +
              '<button class="wl-view-btn" id="wl-btn-widget">Widget</button>' +
              '<button class="wl-view-btn active" id="wl-btn-table">Table</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // === Filter Bar ===
        '<div class="wl-filter-bar" id="wl-filter-bar">' +
          '<div class="wl-filter-group" data-filter="bias">' +
            '<span class="wl-filter-label">Bias</span>' +
            '<button class="wl-pill active" data-val="all">All</button>' +
            '<button class="wl-pill" data-val="bull">▲ Bull</button>' +
            '<button class="wl-pill" data-val="bear">▼ Bear</button>' +
            '<button class="wl-pill" data-val="mixed">◆ Mixed</button>' +
          '</div>' +
          '<div class="wl-filter-group" data-filter="status">' +
            '<span class="wl-filter-label">Status</span>' +
            '<button class="wl-pill active" data-val="all">All</button>' +
            '<button class="wl-pill" data-val="watching">Watching</button>' +
            '<button class="wl-pill" data-val="approaching">Approaching</button>' +
            '<button class="wl-pill" data-val="active">Active</button>' +
            '<button class="wl-pill" data-val="exit">Exit</button>' +
          '</div>' +
          '<div class="wl-filter-group" data-filter="alert">' +
            '<span class="wl-filter-label">Alerts</span>' +
            '<button class="wl-pill active" data-val="all">Any</button>' +
            '<button class="wl-pill" data-val="earnings14" title="Earnings within 14 days"><i data-lucide="calendar"></i> Earnings</button>' +
            '<button class="wl-pill" data-val="rsiOB" title="RSI > 70"><i data-lucide="triangle-alert"></i> RSI OB</button>' +
            '<button class="wl-pill" data-val="rsiOS" title="RSI < 30"><i data-lucide="trending-up"></i> RSI OS</button>' +
            '<button class="wl-pill" data-val="bbSqueeze" title="Bollinger Band squeeze"><i data-lucide="zap"></i> BB Squeeze</button>' +
            '<button class="wl-pill" data-val="volSpike" title="Volume > 2x 20d avg"><i data-lucide="flame"></i> Vol Spike</button>' +
            '<button class="wl-pill" data-val="goldenCross" title="Golden cross"><i data-lucide="star"></i> Golden</button>' +
            '<button class="wl-pill" data-val="deathCross" title="Death cross"><i data-lucide="skull"></i> Death</button>' +
          '</div>' +
          '<div class="wl-filter-group wl-filter-selects">' +
            '<select class="wl-select" id="wl-filter-sector" aria-label="Sector filter"><option value="all">All sectors</option></select>' +
            '<select class="wl-select" id="wl-filter-group" aria-label="Section filter"><option value="all">All sections</option></select>' +
            '<div class="wl-search-wrap"><i data-lucide="search"></i><input class="wl-search-input" id="wl-filter-search" type="text" placeholder="Search ticker or name…" aria-label="Search"></div>' +
            '<button class="wl-reset-btn" id="wl-filter-reset" hidden><i data-lucide="x"></i> Reset</button>' +
          '</div>' +
        '</div>' +

        // === Stat Bar ===
        '<div class="wl-stat-bar" id="wl-stat-bar"></div>' +

        // === Sector Cards ===
        '<div class="wl-sector-cards" id="wl-sector-cards" hidden></div>' +

        '<div class="wl-tv-widget-wrap" id="wl-tv-widget-view">' +
          '<div class="tradingview-widget-container" style="width:100%;height:calc(100vh - 200px);">' +
            '<div class="tradingview-widget-container__widget" id="wl-tv-market-overview" style="width:100%;height:100%;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="wl-table-wrap" id="wl-table-view">' +
          '<table class="watchlist-table" id="wl-table">' +
            '<thead><tr>' +
              '<th data-col="0" data-key="symbol">Ticker <span class="sort-arrow"></span></th>' +
              '<th data-col="1" data-key="name">Name <span class="sort-arrow"></span></th>' +
              '<th data-col="2" data-key="sector">Sector <span class="sort-arrow"></span></th>' +
              '<th data-col="3" data-key="price">Price <span class="sort-arrow"></span></th>' +
              '<th data-col="4" data-key="change">Chg % <span class="sort-arrow"></span></th>' +
              '<th data-col="5" data-key="sma20">SMA20 <span class="sort-arrow"></span></th>' +
              '<th data-col="6" data-key="sma50">SMA50 <span class="sort-arrow"></span></th>' +
              '<th data-col="7" data-key="rsi" data-optcol="rsi">RSI <span class="sort-arrow"></span></th>' +
              '<th data-col="8" data-key="atrPct" data-optcol="atr">ATR % <span class="sort-arrow"></span></th>' +
              '<th data-col="9" data-key="volumeRatio" data-optcol="volRatio">Vol x <span class="sort-arrow"></span></th>' +
              '<th data-col="10" data-key="bbWidthPercentile" data-optcol="bbWidth">BB % <span class="sort-arrow"></span></th>' +
              '<th data-col="11" data-key="pctFrom52wHigh" data-optcol="pos52w">52w <span class="sort-arrow"></span></th>' +
              '<th data-col="12" data-key="earningsDays" data-optcol="earnings">Earnings <span class="sort-arrow"></span></th>' +
              '<th data-col="13" data-key="bias">Bias <span class="sort-arrow"></span></th>' +
              '<th data-col="14" data-key="status">Status <span class="sort-arrow"></span></th>' +
            '</tr></thead>' +
            '<tbody id="wl-tbody">' +
              Array(20).join('<tr><td colspan="15"><div class="skeleton skeleton-table-row"></div></td></tr>') +
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
    // Load persisted prefs
    _restorePrefs();

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

    // Filter pills (delegate per filter-group)
    document.querySelectorAll('.wl-filter-group[data-filter]').forEach(function(grp) {
      var key = grp.getAttribute('data-filter');
      grp.querySelectorAll('.wl-pill').forEach(function(btn) {
        btn.addEventListener('click', function() { _setFilter(key, btn.getAttribute('data-val')); });
      });
    });

    // Select filters
    var selSector = document.getElementById('wl-filter-sector');
    var selGroup  = document.getElementById('wl-filter-group');
    if (selSector) selSector.addEventListener('change', function() { _setFilter('sector', selSector.value); });
    if (selGroup)  selGroup.addEventListener('change',  function() { _setFilter('group',  selGroup.value);  });

    // Search
    var search = document.getElementById('wl-filter-search');
    if (search) {
      var dbT;
      search.addEventListener('input', function() {
        clearTimeout(dbT);
        dbT = setTimeout(function() { _setFilter('search', search.value); }, 120);
      });
    }

    // Reset
    var reset = document.getElementById('wl-filter-reset');
    if (reset) reset.addEventListener('click', _resetFilters);

    // Grouping buttons
    document.querySelectorAll('.wl-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { _setGrouping(btn.getAttribute('data-group')); });
    });

    // Column picker
    var colBtn = document.getElementById('wl-col-btn');
    var colPanel = document.getElementById('wl-col-panel');
    if (colBtn && colPanel) {
      colBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        colPanel.hidden = !colPanel.hidden;
      });
      document.addEventListener('click', function(e) {
        if (!colPanel.hidden && !colPanel.contains(e.target) && e.target !== colBtn) colPanel.hidden = true;
      });
      colPanel.querySelectorAll('input[data-col-toggle]').forEach(function(cb) {
        var k = cb.getAttribute('data-col-toggle');
        cb.checked = !!visibleCols[k];
        cb.addEventListener('change', function() {
          visibleCols[k] = cb.checked;
          _savePrefs();
          _applyColumnVisibility();
        });
      });
    }

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

  // === Prefs ===
  function _prefs() { return (window.BT && window.BT.preferences) ? window.BT.preferences : null; }
  function _restorePrefs() {
    var p = _prefs(); if (!p) return;
    var f = p.getPref('watchlist.filters'); if (f) activeFilters = Object.assign({}, DEFAULT_FILTERS, f);
    var c = p.getPref('watchlist.columns'); if (c) visibleCols = Object.assign({}, DEFAULT_COLUMNS, c);
    var g = p.getPref('watchlist.grouping'); if (g) grouping = g;
    var s = p.getPref('watchlist.sort'); if (s) { sortCol = s.col; sortDir = s.dir; sortAsc = s.dir !== 'desc'; }
  }
  function _savePrefs() {
    var p = _prefs(); if (!p) return;
    p.setPref('watchlist.filters', activeFilters);
    p.setPref('watchlist.columns', visibleCols);
    p.setPref('watchlist.grouping', grouping);
    p.setPref('watchlist.sort', { col: sortCol, dir: sortDir });
  }

  function _setFilter(key, val) {
    activeFilters[key] = val;
    _savePrefs();
    _syncFilterUI();
    renderTable();
  }
  function _resetFilters() {
    activeFilters = Object.assign({}, DEFAULT_FILTERS);
    var s = document.getElementById('wl-filter-search'); if (s) s.value = '';
    _savePrefs();
    _syncFilterUI();
    renderTable();
  }
  function _setGrouping(g) {
    grouping = g;
    document.querySelectorAll('.wl-group-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-group') === g);
    });
    _savePrefs();
    renderTable();
  }

  function _syncFilterUI() {
    // Pills
    document.querySelectorAll('.wl-filter-group[data-filter]').forEach(function(grp) {
      var key = grp.getAttribute('data-filter');
      grp.querySelectorAll('.wl-pill').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-val') === activeFilters[key]);
      });
    });
    // Selects
    var selSector = document.getElementById('wl-filter-sector');
    var selGroup  = document.getElementById('wl-filter-group');
    if (selSector) selSector.value = activeFilters.sector;
    if (selGroup)  selGroup.value  = activeFilters.group;
    // Reset visibility
    var anyActive = false;
    for (var k in DEFAULT_FILTERS) { if (activeFilters[k] !== DEFAULT_FILTERS[k]) { anyActive = true; break; } }
    var reset = document.getElementById('wl-filter-reset');
    if (reset) reset.hidden = !anyActive;
    // Grouping
    document.querySelectorAll('.wl-group-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-group') === grouping);
    });
  }

  function _populateSelects() {
    var selSector = document.getElementById('wl-filter-sector');
    var selGroup  = document.getElementById('wl-filter-group');
    if (!selSector || !selGroup) return;
    var sectors = {}, groups = {};
    watchlist.forEach(function(t) {
      if (t.sector) sectors[t.sector] = true;
      if (t.group)  groups[t.group]  = true;
    });
    var sectorOpts = Object.keys(sectors).sort();
    var groupOpts  = Object.keys(groups).sort();
    selSector.innerHTML = '<option value="all">All sectors</option>' + sectorOpts.map(function(s){return '<option value="'+s+'">'+s+'</option>';}).join('');
    selGroup.innerHTML  = '<option value="all">All sections</option>' + groupOpts.map(function(s){return '<option value="'+s+'">'+s+'</option>';}).join('');
    selSector.value = activeFilters.sector;
    selGroup.value  = activeFilters.group;
  }

  function _applyColumnVisibility() {
    var table = document.getElementById('wl-table');
    if (!table) return;
    var ths = table.querySelectorAll('thead th[data-optcol]');
    ths.forEach(function(th, idx) {
      var k = th.getAttribute('data-optcol');
      var show = !!visibleCols[k];
      // Find column index
      var colIdx = Array.prototype.indexOf.call(th.parentNode.children, th);
      th.style.display = show ? '' : 'none';
      table.querySelectorAll('tbody tr').forEach(function(tr) {
        var td = tr.children[colIdx];
        if (td && !td.hasAttribute('colspan')) td.style.display = show ? '' : 'none';
      });
    });
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
      fetch('data/watchlist.json').then(function(r) { return r.ok ? r.json() : []; }),
      fetch('data/expected-moves.json').then(function(r) { return r.ok ? r.json() : {}; }),
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

      var totalEl = document.getElementById('wl-total');
      if (totalEl) totalEl.textContent = watchlist.length;

      _populateSelects();
      _syncFilterUI();
      renderTable();
      _applyColumnVisibility();

      // Deep link: #watchlist/SPY
      if (param) {
        openDetail(param.toUpperCase());
      }
    }).catch(function(err) {
      console.error('Failed to load watchlist data:', err);
      var tbody = document.getElementById('wl-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;color:var(--red);">Error loading data</td></tr>';
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
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = (col === 0 || col === 1 || col === 2) ? 'asc' : 'desc';
    }
    sortAsc = sortDir === 'asc';
    _savePrefs();
    renderTable();
  }

  var COL_KEYS = [
    'symbol','name','sector','price','change','sma20','sma50',
    'rsi','atrPct','volumeRatio','bbWidthPercentile','pctFrom52wHigh','earningsDays',
    'bias','status'
  ];

  function _sortList(list) {
    var key = COL_KEYS[sortCol] || 'symbol';
    var dir = sortAsc ? 1 : -1;
    return list.slice().sort(function(a, b) {
      var va = a[key], vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;  // nulls last
      if (vb == null) return -1;
      if (typeof va === 'string') { va = va.toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      // Stable secondary by symbol
      return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
    });
  }

  function _alertBadges(s) {
    var alerts = classifyAlerts(s);
    var defs = [
      { key: 'earnings7',   icon: 'calendar',        color: 'var(--red)',    title: 'Earnings ≤ 7d' },
      { key: 'earnings14',  icon: 'calendar',        color: 'var(--orange)', title: 'Earnings ≤ 14d' },
      { key: 'rsiOB',       icon: 'triangle-alert',  color: 'var(--red)',    title: 'RSI overbought' },
      { key: 'rsiOS',       icon: 'trending-up',     color: 'var(--cyan)',   title: 'RSI oversold' },
      { key: 'bbSqueeze',   icon: 'zap',             color: 'var(--orange)', title: 'Bollinger squeeze' },
      { key: 'volSpike',    icon: 'flame',           color: 'var(--cyan)',   title: 'Volume spike' },
      { key: 'goldenCross', icon: 'star',            color: 'var(--cyan)',   title: 'Golden cross' },
      { key: 'deathCross',  icon: 'skull',           color: 'var(--red)',    title: 'Death cross' }
    ];
    // earnings7 takes precedence over earnings14 (show only one)
    var has7 = alerts.indexOf('earnings7') >= 0;
    var out = [];
    defs.forEach(function(d) {
      if (alerts.indexOf(d.key) === -1) return;
      if (d.key === 'earnings14' && has7) return;
      out.push('<span class="wl-badge" title="' + d.title + '" style="color:' + d.color + '"><i data-lucide="' + d.icon + '"></i></span>');
    });
    if (out.length > 4) {
      out = out.slice(0, 4).concat(['<span class="wl-badge wl-badge-more">+' + (out.length - 4) + '</span>']);
    }
    return out.length ? '<span class="wl-badges">' + out.join('') + '</span>' : '';
  }

  function _rowHTML(s) {
    var chgClass = s.change > 0 ? 'up' : s.change < 0 ? 'down' : 'neutral';
    var dist20 = s.sma20 ? ((s.price - s.sma20) / s.sma20 * 100).toFixed(1) : '—';
    var dist50 = s.sma50 ? ((s.price - s.sma50) / s.sma50 * 100).toFixed(1) : '—';
    var d20Class = dist20 !== '—' ? (parseFloat(dist20) > 0 ? 'up' : 'down') : '';
    var d50Class = dist50 !== '—' ? (parseFloat(dist50) > 0 ? 'up' : 'down') : '';
    var rsi = s.rsi;
    var rsiCls = rsi == null ? '' : (rsi > 70 ? 'down' : rsi < 30 ? 'up' : '');
    var volCls = s.volumeRatio == null ? '' : (s.volumeRatio > 1.5 ? 'up' : s.volumeRatio < 0.6 ? 'down' : '');
    var bbCls = s.bbWidthPercentile != null && s.bbWidthPercentile < 15 ? 'up' : '';
    var hiCls = s.pctFrom52wHigh != null && s.pctFrom52wHigh < -20 ? 'down' : (s.pctFrom52wHigh != null && s.pctFrom52wHigh > -2 ? 'up' : '');
    var erCls = s.earningsDays != null ? (s.earningsDays <= 7 ? 'down' : s.earningsDays <= 14 ? 'neutral-warn' : '') : '';
    var erTxt = s.earningsDays != null ? (s.earningsDays + 'd') : '—';
    var style = function(k) { return visibleCols[k] ? '' : ' style="display:none"'; };
    return '<tr data-sym="' + s.symbol + '" style="cursor:pointer;">' +
      '<td class="ticker-cell">' + s.symbol + _alertBadges(s) + '</td>' +
      '<td style="color:var(--text-dim);font-size:11px;">' + (s.name || '') + '</td>' +
      '<td class="sector-cell">' + (s.sector || '') + '</td>' +
      '<td>$' + (s.price ? s.price.toFixed(2) : '—') + '</td>' +
      '<td class="' + chgClass + '">' + (s.change > 0 ? '+' : '') + (s.change != null ? s.change.toFixed(1) : '—') + '%</td>' +
      '<td><span class="' + d20Class + '">' + (dist20 !== '—' && parseFloat(dist20) > 0 ? '+' : '') + dist20 + '%</span> <span style="color:var(--text-dim);font-size:10px;">($' + (s.sma20 ? s.sma20.toFixed(0) : '—') + ')</span></td>' +
      '<td><span class="' + d50Class + '">' + (dist50 !== '—' && parseFloat(dist50) > 0 ? '+' : '') + dist50 + '%</span> <span style="color:var(--text-dim);font-size:10px;">($' + (s.sma50 ? s.sma50.toFixed(0) : '—') + ')</span></td>' +
      '<td class="' + rsiCls + '"' + style('rsi') + '>' + (rsi != null ? rsi : '—') + '</td>' +
      '<td' + style('atr') + '>' + (s.atrPct != null ? s.atrPct + '%' : '—') + '</td>' +
      '<td class="' + volCls + '"' + style('volRatio') + '>' + (s.volumeRatio != null ? s.volumeRatio.toFixed(2) + 'x' : '—') + '</td>' +
      '<td class="' + bbCls + '"' + style('bbWidth') + '>' + (s.bbWidthPercentile != null ? s.bbWidthPercentile + '%' : '—') + '</td>' +
      '<td class="' + hiCls + '"' + style('pos52w') + '>' + (s.pctFrom52wHigh != null ? s.pctFrom52wHigh.toFixed(1) + '%' : '—') + '</td>' +
      '<td class="' + erCls + '"' + style('earnings') + '>' + erTxt + '</td>' +
      '<td><span class="bias-badge ' + (s.bias || 'mixed') + '">' + (s.bias || 'mixed').toUpperCase() + '</span></td>' +
      '<td><span class="status-badge ' + (s.status || 'watching') + '">' + (s.status || 'watching').toUpperCase() + '</span></td>' +
    '</tr>';
  }

  function _updateSortArrows() {
    document.querySelectorAll('#wl-table thead th[data-col]').forEach(function(th) {
      var col = parseInt(th.getAttribute('data-col'), 10);
      th.classList.toggle('active-sort', col === sortCol);
      var arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = col === sortCol ? (sortAsc ? '▲' : '▼') : '';
    });
  }

  function _renderStatBar(list) {
    var bar = document.getElementById('wl-stat-bar');
    if (!bar) return;
    var s = computeStats(list);
    bar.innerHTML =
      '<span class="wl-stat"><strong>' + s.total + '</strong> symbols</span>' +
      '<span class="wl-stat up">▲ ' + s.bull + ' Bull</span>' +
      '<span class="wl-stat down">▼ ' + s.bear + ' Bear</span>' +
      '<span class="wl-stat">◆ ' + s.mixed + ' Mixed</span>' +
      '<span class="wl-stat">' + s.approaching + ' Approaching</span>' +
      '<span class="wl-stat">' + s.active + ' Active</span>' +
      '<span class="wl-stat">' + s.earnings14 + ' Earnings ≤14d</span>';
  }

  function _renderSectorCards(list) {
    var host = document.getElementById('wl-sector-cards');
    if (!host) return;
    if (grouping !== 'none' || activeFilters.sector !== 'all') {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    var aggs = sectorAggregates(list);
    if (!aggs.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = aggs.map(function(a) {
      var chgCls = a.avgChg > 0 ? 'up' : a.avgChg < 0 ? 'down' : '';
      return '<button class="wl-sector-card" data-sector="' + a.sector + '" title="Filter ' + a.sector + '">' +
        '<div class="wl-sc-head"><span class="wl-sc-name">' + a.sector + '</span><span class="wl-sc-count">' + a.count + '</span></div>' +
        '<div class="wl-sc-bar"><div class="wl-sc-bar-fill" style="width:' + a.pctBull + '%"></div></div>' +
        '<div class="wl-sc-foot"><span class="' + chgCls + '">' + (a.avgChg > 0 ? '+' : '') + a.avgChg.toFixed(2) + '%</span>' +
          '<span class="wl-sc-dim">' + a.pctBull + '% bull</span>' +
          (a.avgRsi != null ? '<span class="wl-sc-dim">RSI ' + a.avgRsi.toFixed(0) + '</span>' : '') +
        '</div>' +
      '</button>';
    }).join('');
    host.querySelectorAll('.wl-sector-card').forEach(function(card) {
      card.addEventListener('click', function() { _setFilter('sector', card.getAttribute('data-sector')); });
    });
  }

  function renderTable() {
    var tbody = document.getElementById('wl-tbody');
    if (!tbody) return;

    var filtered = applyFilters(watchlist);
    var sorted = _sortList(filtered);

    // Update counts
    var countEl = document.getElementById('wl-count');
    if (countEl) countEl.textContent = filtered.length;

    _updateSortArrows();
    _renderStatBar(filtered);
    _renderSectorCards(filtered);

    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;color:var(--text-dim);padding:32px;">No symbols match the current filters</td></tr>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      _applyColumnVisibility();
      return;
    }

    if (grouping === 'none') {
      tbody.innerHTML = sorted.map(_rowHTML).join('');
    } else {
      var groupKey = grouping === 'sector' ? 'sector' : 'group';
      var groups = {};
      var order = [];
      sorted.forEach(function(s) {
        var k = s[groupKey] || '—';
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(s);
      });
      tbody.innerHTML = order.map(function(k) {
        var rows = groups[k];
        var bull = rows.filter(function(r) { return r.bias === 'bull'; }).length;
        var pctBull = Math.round((bull / rows.length) * 100);
        var sumChg = 0, cn = 0;
        rows.forEach(function(r) { if (r.change != null) { sumChg += r.change; cn++; } });
        var avgChg = cn ? sumChg / cn : 0;
        var chgCls = avgChg > 0 ? 'up' : avgChg < 0 ? 'down' : '';
        return '<tr class="wl-group-header"><td colspan="15">' +
            '<span class="wl-gh-name">' + k + '</span>' +
            '<span class="wl-gh-count">' + rows.length + '</span>' +
            '<span class="wl-gh-bull">' + pctBull + '% bull</span>' +
            '<span class="wl-gh-chg ' + chgCls + '">' + (avgChg > 0 ? '+' : '') + avgChg.toFixed(2) + '%</span>' +
          '</td></tr>' +
          rows.map(_rowHTML).join('');
      }).join('');
    }

    // Bind row clicks
    tbody.querySelectorAll('tr[data-sym]').forEach(function(tr) {
      tr.addEventListener('click', function() { openDetail(tr.getAttribute('data-sym')); });
    });

    _applyColumnVisibility();

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

  // Register page (browser only)
  if (typeof window !== 'undefined' && window.BT) {
    window.BT.pages = window.BT.pages || {};
    window.BT.pages.watchlist = {
      render: render,
      init: init,
      destroy: destroy
    };

    // Bridge for ticker-search
    window.openDetail = function(sym) {
      if (window.BT.pages.watchlist && watchlist.length) openDetail(sym);
    };
  }
})();
