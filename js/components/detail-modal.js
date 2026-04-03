/**
 * components/detail-modal.js — Unified detail modal for signals/watchlist/EM
 * Registers as BT.components.detailModal
 */
(function() {
  'use strict';

  var _weeklyChartTimer = null;
  var _onClose = null;

  function fmtPrice(n) {
    return n >= 1000 ? n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})
      : Number(n).toFixed(2);
  }

  function pctDiff(from, to) {
    return ((to - from) / from * 100).toFixed(1);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function getModalEl() {
    return document.getElementById('detail-modal');
  }

  function open(symbol, options) {
    options = options || {};
    var t = options.tickerData;
    if (!t) return;

    var exchange = options.exchange || 'NASDAQ';
    var sections = options.sections || ['charts', 'ta', 'pattern', 'range', 'levels', 'analysis'];
    _onClose = options.onClose || null;

    var modal = getModalEl();
    if (!modal) return;

    var pc = t.change >= 0 ? 'up' : 'down';
    var arrow = t.change >= 0 ? '▲' : '▼';

    var range = t.t2 - t.stop;
    var pricePct = clamp(((t.price - t.stop) / range) * 100, 2, 98);
    var entryPct = clamp(((t.entry - t.stop) / range) * 100, 5, 95);
    var t1Pct = clamp(((t.t1 - t.stop) / range) * 100, 5, 95);
    var rr = ((t.t1 - t.entry) / (t.entry - t.stop)).toFixed(1);
    var fillColor = t.change >= 0 ? '#00d4aa' : '#ef5350';

    var patClass = t.pattern.type === 'Bearish' ? 'pat-bearish'
      : t.pattern.type.indexOf('Bullish') >= 0 ? 'pat-bullish'
      : t.pattern.type === 'Caution' ? 'pat-caution' : 'pat-neutral';

    var patIcon = t.pattern.type === 'Bearish'
      ? '<i data-lucide="trending-down"></i>'
      : t.pattern.type.indexOf('Bullish') >= 0
      ? '<i data-lucide="trending-up"></i>'
      : '<i data-lucide="bar-chart-3"></i>';

    // Build modal HTML
    var html = '<div class="signals-modal">' +
      '<div class="modal-header">' +
        '<div class="ticker-info">' +
          '<span class="modal-ticker">' + t.symbol + '</span>' +
          '<span class="modal-name">' + t.name + ' · ' + t.sector + '</span>' +
          '<span class="status-badge ' + t.badgeClass + '">' + t.statusIcon + ' ' + t.statusLabel + '</span>' +
          '<span class="bias-badge bias-' + t.bias + '">' + t.bias.toUpperCase() + '</span>' +
          '<span class="modal-price-tag"><span class="' + pc + '">$' + fmtPrice(t.price) + '</span> <span class="change ' + pc + '" style="font-size:12px">' + arrow + ' ' + Math.abs(t.change).toFixed(1) + '%</span></span>' +
        '</div>' +
        '<button class="modal-close" id="detail-modal-close">✕</button>' +
      '</div>' +
      '<div class="modal-body">';

    // Charts
    if (sections.indexOf('charts') >= 0) {
      html += '<div class="chart-row">' +
        '<div class="chart-box">' +
          '<div class="chart-label">Daily <div class="ma-legend"><span><span class="ma-dot sma20"></span> SMA 20</span><span><span class="ma-dot sma50"></span> SMA 50</span><span><span class="ma-dot sma150"></span> SMA 150</span></div></div>' +
          '<div id="detail-chart-daily" style="height:400px;"><div class="chart-skeleton skeleton">Loading chart…</div></div>' +
        '</div>' +
        '<div class="chart-box">' +
          '<div class="chart-label">Weekly <div class="ma-legend"><span><span class="ma-dot sma20"></span> SMA 20</span><span><span class="ma-dot sma50"></span> SMA 50</span></div></div>' +
          '<div id="detail-chart-weekly" style="height:400px;"><div class="chart-skeleton">Waiting for daily chart…</div></div>' +
        '</div>' +
      '</div>';
    }

    // TA + Pattern + Range row
    if (sections.indexOf('ta') >= 0 || sections.indexOf('pattern') >= 0 || sections.indexOf('range') >= 0) {
      html += '<div class="ta-row">';

      if (sections.indexOf('ta') >= 0) {
        html += '<div class="ta-widget-box">' +
          '<div class="ta-widget-label">Technical Analysis</div>' +
          '<div id="detail-ta-widget" style="height:300px;"></div>' +
        '</div>';
      }

      if (sections.indexOf('pattern') >= 0) {
        html += '<div class="modal-pattern" style="flex-direction:column;">' +
          '<div style="font-size:32px;">' + patIcon + '</div>' +
          '<div class="pattern-info" style="text-align:center;">' +
            '<div class="pattern-name">' + t.pattern.name + '</div>' +
            '<div class="pattern-type"><span class="pattern-badge ' + patClass + '" style="font-size:11px;">' + t.pattern.type + '</span></div>' +
            '<div class="pattern-level" style="margin-top:8px;">Key Level: ' + t.pattern.level + '</div>' +
          '</div>' +
        '</div>';
      }

      if (sections.indexOf('range') >= 0) {
        html += '<div class="modal-range" style="display:flex;flex-direction:column;justify-content:center;">' +
          '<h4>Price Target Range</h4>' +
          '<div class="range-bar-container" style="padding-top:22px;">' +
            '<div class="range-bar" style="height:8px;">' +
              '<span class="range-marker stop" style="left:0%;font-size:10px;"><span class="range-dot stop"></span> $' + t.stop + '</span>' +
              '<span class="range-marker entry" style="left:' + entryPct + '%;font-size:10px;"><span class="range-dot entry"></span> $' + t.entry + '</span>' +
              '<span class="range-marker t1" style="left:' + t1Pct + '%;font-size:10px;"><span class="range-dot target"></span> $' + t.t1 + '</span>' +
              '<span class="range-marker t2" style="left:100%;font-size:10px;"><i data-lucide="trophy"></i> $' + t.t2 + '</span>' +
              '<div class="range-fill" style="width:' + pricePct + '%;background:' + fillColor + ';opacity:0.2;"></div>' +
              '<div class="price-dot" style="left:' + pricePct + '%;width:14px;height:14px;top:-3px;transform:translateX(-7px);"></div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:14px;font-size:11px;color:var(--text-dim);">R:R = 1:' + rr + ' · Risk: $' + (t.entry - t.stop).toFixed(2) + '/share</div>' +
        '</div>';
      }

      html += '</div>';
    }

    // Detail grid
    if (sections.indexOf('levels') >= 0) {
      html += '<div class="detail-grid">' +
        '<div class="detail-card"><h4>Setup Levels</h4><div class="detail-levels">' +
          '<div class="detail-level"><span class="dl-label">Entry</span><span class="dl-value" style="color:var(--orange)">$' + fmtPrice(t.entry) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Stop Loss</span><span class="dl-value" style="color:var(--red)">$' + fmtPrice(t.stop) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Target 1</span><span class="dl-value" style="color:var(--cyan)">$' + fmtPrice(t.t1) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Target 2</span><span class="dl-value" style="color:var(--gold)">$' + fmtPrice(t.t2) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Risk/Reward</span><span class="dl-value">1:' + rr + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Risk/Share</span><span class="dl-value" style="color:var(--red)">$' + (t.entry - t.stop).toFixed(2) + '</span></div>' +
        '</div></div>' +
        '<div class="detail-card"><h4>Technical Levels</h4><div class="detail-levels">' +
          '<div class="detail-level"><span class="dl-label">SMA 20</span><span class="dl-value">$' + t.sma20.toFixed(2) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">SMA 50</span><span class="dl-value">$' + t.sma50.toFixed(2) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Weekly 20</span><span class="dl-value">$' + t.w20.toFixed(2) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">RSI (14)</span><span class="dl-value"' + (t.rsi > 70 ? ' style="color:var(--red)"' : t.rsi < 30 ? ' style="color:var(--cyan)"' : '') + '>' + t.rsi + (t.rsi > 70 ? ' OB' : t.rsi < 30 ? ' OS' : '') + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">% from Entry</span><span class="dl-value">' + (pctDiff(t.entry, t.price) > 0 ? '+' : '') + pctDiff(t.entry, t.price) + '%</span></div>' +
          '<div class="detail-level"><span class="dl-label">Bias</span><span class="dl-value">' + t.bias.toUpperCase() + '</span></div>' +
        '</div></div>' +
        '<div class="detail-card"><h4>Volatility &amp; Volume</h4><div class="detail-levels">' +
          '<div class="detail-level"><span class="dl-label">ATR (14)</span><span class="dl-value">$' + t.vol.atr.toFixed(2) + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">ATR %</span><span class="dl-value">' + t.vol.atrPct + '%</span></div>' +
          '<div class="detail-level"><span class="dl-label">Vol Rating</span><span class="dl-value">' + t.vol.rating + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">Volume</span><span class="dl-value">' + t.vol.current + '</span></div>' +
          '<div class="detail-level"><span class="dl-label">vs Avg</span><span class="dl-value">' + t.vol.avgRatio + 'x</span></div>' +
          '<div class="detail-level"><span class="dl-label">Days in Setup</span><span class="dl-value">' + (Math.floor(Math.random() * 20 + 3)) + '</span></div>' +
        '</div></div>' +
      '</div>';
    }

    // Analysis
    if (sections.indexOf('analysis') >= 0) {
      html += '<div class="modal-analysis" style="margin-top:16px;">' +
        '<h4>Analysis — ' + t.symbol + '</h4>' +
        '<p>' + t.analysis + '</p>' +
        (t.exitWarning ? '<p style="color:var(--red);font-weight:600;">⚠ ' + t.exitWarning + '</p>' : '') +
      '</div>';
    }

    html += '</div></div>'; // close modal-body + signals-modal

    modal.className = 'signals-modal-overlay';
    modal.innerHTML = html;

    // Force reflow then open
    modal.offsetHeight;
    modal.classList.add('open');

    // Bind close
    var closeBtn = document.getElementById('detail-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    modal.addEventListener('click', _overlayClick);
    document.addEventListener('keydown', _escHandler);

    // Load charts
    if (sections.indexOf('charts') >= 0) {
      _loadCharts(exchange, symbol);
    }

    // Render Lucide icons in modal
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Load TA widget
    if (sections.indexOf('ta') >= 0) {
      setTimeout(function() { _loadTA(exchange, symbol); }, 100);
    }
  }

  function _overlayClick(e) {
    // Close if clicking the overlay background (not the modal content)
    if (e.target.classList.contains('signals-modal-overlay')) close();
  }

  function _escHandler(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    if (_weeklyChartTimer) { clearTimeout(_weeklyChartTimer); _weeklyChartTimer = null; }
    var modal = getModalEl();
    if (modal) {
      modal.classList.remove('open');
      setTimeout(function() {
        modal.innerHTML = '';
        modal.className = 'signals-modal-overlay';
      }, 350);
    }
    document.removeEventListener('keydown', _escHandler);
    if (modal) modal.removeEventListener('click', _overlayClick);
    if (_onClose) { _onClose(); _onClose = null; }
  }

  function _loadCharts(exchange, symbol) {
    var userTZ = BT.preferences.getPref('timezone') || 'America/New_York';

    if (_weeklyChartTimer) { clearTimeout(_weeklyChartTimer); _weeklyChartTimer = null; }

    var dailyEl = document.getElementById('detail-chart-daily');
    var weeklyEl = document.getElementById('detail-chart-weekly');
    if (!dailyEl || !weeklyEl) return;

    dailyEl.innerHTML = '';
    weeklyEl.innerHTML = '<div class="chart-skeleton">Waiting for daily chart…</div>';

    if (typeof TradingView === 'undefined' || !TradingView.widget) return;

    var dailyWidget = new TradingView.widget({
      autosize: true,
      symbol: exchange + ':' + symbol,
      interval: 'D', timezone: userTZ, theme: 'dark', style: '1', locale: 'en',
      hide_top_toolbar: false, hide_legend: false, allow_symbol_change: false,
      save_image: false, container_id: 'detail-chart-daily',
      height: 400, width: '100%',
      backgroundColor: '#0a0a12', gridColor: '#1a1a2e',
      overrides: { 'mainSeriesProperties.sessionId': 'regular' },
      studies: ['MASimple@tv-basicstudies','MASimple@tv-basicstudies','MASimple@tv-basicstudies','Volume@tv-basicstudies'],
      studies_overrides: {
        'moving average#0.length': 20, 'moving average#0.ma.color': '#9e9e9e', 'moving average#0.ma.linewidth': 2,
        'moving average#1.length': 50, 'moving average#1.ma.color': '#ffeb3b', 'moving average#1.ma.linewidth': 2,
        'moving average#2.length': 150, 'moving average#2.ma.color': '#42a5f5', 'moving average#2.ma.linewidth': 2
      },
      range: '12M'
    });

    var observer = new MutationObserver(function() {
      var iframe = dailyEl.querySelector('iframe');
      if (iframe) {
        observer.disconnect();
        iframe.addEventListener('load', function() {
          weeklyEl.innerHTML = '<div class="chart-skeleton">Loading weekly chart…</div>';
          _weeklyChartTimer = setTimeout(function() { _loadWeekly(exchange, symbol, userTZ); }, 1000);
        });
      }
    });
    observer.observe(dailyEl, { childList: true, subtree: true });

    // Fallback if observer doesn't fire
    setTimeout(function() {
      var modal = getModalEl();
      if (_weeklyChartTimer === null && modal && modal.classList.contains('open')) {
        observer.disconnect();
        weeklyEl.innerHTML = '<div class="chart-skeleton">Loading weekly chart…</div>';
        _weeklyChartTimer = setTimeout(function() { _loadWeekly(exchange, symbol, userTZ); }, 500);
      }
    }, 5000);
  }

  function _loadWeekly(exchange, symbol, userTZ) {
    var modal = getModalEl();
    if (!modal || !modal.classList.contains('open')) return;
    var el = document.getElementById('detail-chart-weekly');
    if (!el) return;
    el.innerHTML = '';

    if (typeof TradingView === 'undefined' || !TradingView.widget) return;

    new TradingView.widget({
      autosize: true,
      symbol: exchange + ':' + symbol,
      interval: 'W', timezone: userTZ, theme: 'dark', style: '1', locale: 'en',
      hide_top_toolbar: false, hide_legend: false, allow_symbol_change: false,
      save_image: false, container_id: 'detail-chart-weekly',
      height: 400, width: '100%',
      backgroundColor: '#0a0a12', gridColor: '#1a1a2e',
      overrides: { 'mainSeriesProperties.sessionId': 'regular' },
      studies: ['MASimple@tv-basicstudies','MASimple@tv-basicstudies','Volume@tv-basicstudies'],
      studies_overrides: {
        'moving average#0.length': 20, 'moving average#0.ma.color': '#9e9e9e', 'moving average#0.ma.linewidth': 2,
        'moving average#1.length': 50, 'moving average#1.ma.color': '#ffeb3b', 'moving average#1.ma.linewidth': 2
      },
      range: '60M'
    });
    _weeklyChartTimer = null;
  }

  function _loadTA(exchange, symbol) {
    var taContainer = document.getElementById('detail-ta-widget');
    if (!taContainer) return;
    taContainer.innerHTML = '';
    var widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container';
    var innerDiv = document.createElement('div');
    innerDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.appendChild(innerDiv);
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.textContent = JSON.stringify({
      interval: '1D', width: '100%', isTransparent: true,
      height: 260, symbol: exchange + ':' + symbol,
      showIntervalTabs: true, displayMode: 'single',
      locale: 'en', colorTheme: 'dark'
    });
    widgetDiv.appendChild(script);
    taContainer.appendChild(widgetDiv);
  }

  BT.components.detailModal = {
    open: open,
    close: close,
    /** Clean up timers */
    destroy: function() {
      if (_weeklyChartTimer) { clearTimeout(_weeklyChartTimer); _weeklyChartTimer = null; }
    }
  };
})();
