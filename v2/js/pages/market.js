/**
 * pages/market.js — Market page module for BreakingTrades v2
 * Registers as BT.pages.market with render(), init(), destroy()
 */
(function() {
  'use strict';

  var breadthColor = BT.utils.breadthColor;
  var _chartInstances = [];
  var _intervals = [];
  var _rrg = null;
  var _collapsibles = [];

  var BREADTH_SECTOR_ORDER = ['COM','CND','CNS','ENE','FIN','HLC','IND','MAT','RLE','TEC','UTL'];

  function render(el) {
    el.innerHTML =
      '<div class="page-content">' +

        // Daily Briefing — hero position
        '<div id="section-briefing">' +
          '<div class="section-title" id="hdr-briefing"><i data-lucide="newspaper"></i> Daily Briefing</div>' +
          '<div id="body-briefing">' +
            '<div class="market-briefing-card" id="market-briefing">' +
              '<div class="skeleton" style="height:180px;border-radius:6px;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Heatmap
        '<div id="section-heatmap">' +
          '<div class="section-title" id="hdr-heatmap"><i data-lucide="map"></i> S&amp;P 500 Sector Heatmap</div>' +
          '<div id="body-heatmap">' +
            '<div class="heatmap-wrap">' +
              '<div class="tradingview-widget-container" style="width:100%;height:500px;">' +
                '<div class="tradingview-widget-container__widget" id="tv-heatmap" style="width:100%;height:100%;"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Sector Rotation RRG
        '<div style="margin-top:24px;" id="section-rrg">' +
          '<div class="section-title" id="hdr-rrg"><i data-lucide="refresh-cw"></i> Sector Rotation — Relative Rotation Graph</div>' +
          '<div id="body-rrg">' +
            '<div class="card" style="padding:16px;">' +
              '<div id="rrg-market"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Fear & Greed + VIX Regime
        '<div style="margin-top:24px;" id="section-fg-vix">' +
          '<div class="section-title" id="hdr-fg-vix"><i data-lucide="gauge"></i> Fear &amp; Greed + VIX</div>' +
          '<div id="body-fg-vix">' +
            '<div class="mid-grid">' +
              '<div class="card">' +
                '<div class="section-title" id="fg-title"><i data-lucide="gauge"></i> Fear &amp; Greed Index</div>' +
                '<div id="fg-gauge"><div class="skeleton skeleton-gauge"></div></div>' +
              '</div>' +
              '<div class="card vix-card">' +
                '<div class="section-title"><i data-lucide="activity"></i> VIX Regime</div>' +
                '<div id="vix-regime"><div class="skeleton skeleton-card" style="height:200px;"></div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Pair Ratios
        '<div style="margin-top:24px;" id="section-pairs">' +
          '<div class="section-title" id="hdr-pairs"><i data-lucide="arrow-left-right"></i> Pair Ratios — Market Health Signals</div>' +
          '<div id="body-pairs">' +
            '<div class="pairs-grid" id="pairs-grid">' +
              Array(8).join('<div class="skeleton skeleton-card" style="height:60px;"></div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        // Sector Rankings
        '<div style="margin-top:24px;" id="section-rankings">' +
          '<div class="section-title" id="hdr-rankings"><i data-lucide="trophy"></i> Sector Strength Rankings</div>' +
          '<div id="body-rankings">' +
            '<div class="card">' +
              '<ul class="sector-rank-list" id="sector-rankings">' +
                Array(11).join('<div class="skeleton skeleton-table-row"></div>') +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Market Breadth
        '<div style="margin-top:24px;" id="section-breadth">' +
          '<div class="section-title" id="hdr-breadth"><i data-lucide="bar-chart-3"></i> Market Breadth</div>' +
          '<div id="body-breadth">' +
            '<div id="breadth-insight-box"></div>' +
            '<div class="breadth-gauge-wrap">' +
              '<div class="breadth-gauge-card" id="breadth-gauge-card">' +
                '<svg viewBox="0 0 300 175" class="breadth-gauge-svg" id="breadth-gauge-svg"></svg>' +
                '<div class="breadth-gauge-value" id="breadth-gauge-value">—</div>' +
                '<div class="breadth-gauge-label" id="breadth-gauge-label">Loading</div>' +
                '<div class="breadth-gauge-sublabel">Avg. Sector Breadth (20d SMA)</div>' +
              '</div>' +
              '<div class="breadth-sector-bars" id="breadth-sector-bars">' +
                '<div class="bsb-title">Sector Breadth — % Above 20d SMA</div>' +
                '<div id="breadth-bars-container">' +
                  Array(11).join('<div class="skeleton skeleton-table-row"></div>') +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="breadth-mbt-wrap">' +
              '<div class="section-title" style="font-size:10px;">Multi-Timeframe Breadth Levels</div>' +
              '<div class="card" style="padding:0; overflow-x:auto;">' +
                '<table class="breadth-table" id="breadth-mbt"></table>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

      '</div>';
  }

  function init(param) {
    loadMarketData();
    loadBriefing();
    initHeatmap();
    initRRG();

    // Wire collapsible sections
    var sections = [
      ['market:briefing', 'hdr-briefing', 'body-briefing'],
      ['market:heatmap', 'hdr-heatmap', 'body-heatmap'],
      ['market:rrg', 'hdr-rrg', 'body-rrg'],
      ['market:fg-vix', 'hdr-fg-vix', 'body-fg-vix'],
      ['market:pairs', 'hdr-pairs', 'body-pairs'],
      ['market:rankings', 'hdr-rankings', 'body-rankings'],
      ['market:breadth', 'hdr-breadth', 'body-breadth']
    ];
    _collapsibles = [];
    sections.forEach(function(s) {
      var hdr = document.getElementById(s[1]);
      var body = document.getElementById(s[2]);
      if (hdr && body) {
        _collapsibles.push(BT.components.collapsible.init(s[0], hdr, body));
      }
    });

    // Render Lucide icons after initial HTML
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function destroy() {
    _chartInstances.forEach(function(c) { try { c.destroy(); } catch(e) {} });
    _chartInstances = [];
    _intervals.forEach(function(id) { clearInterval(id); });
    _intervals = [];
    _collapsibles.forEach(function(c) { if (c && c.destroy) c.destroy(); });
    _collapsibles = [];
  }

  // === Daily Briefing ===
  function loadBriefing() {
    fetch('../data/briefing.json').then(function(r) { return r.ok ? r.json() : null; }).then(function(b) {
      var el = document.getElementById('market-briefing');
      if (!el) return;
      if (!b) {
        el.innerHTML = '<div style="color:var(--text-dim);padding:16px;text-align:center;">No briefing available yet.</div>';
        return;
      }

      // Strip internal rule IDs like (R006) from display text
      function strip(s) { return s ? s.replace(/\s*\(R\d+\)\s*/g, ' ').replace(/\s*R\d{3}\s*/g, ' ').trim() : ''; }

      // Format age
      var age = '';
      if (b.generatedAt) {
        try {
          var d = new Date(b.generatedAt);
          age = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
        } catch(e) {}
      }

      var html = '';

      // Headline
      if (b.headline) {
        html += '<div class="briefing-headline" style="font-size:18px;font-weight:600;color:var(--text);line-height:1.4;margin-bottom:14px;">' + strip(b.headline) + '</div>';
      }

      // Body paragraphs
      if (b.body && b.body.length) {
        html += '<div class="briefing-body" style="font-size:14px;color:var(--text-muted, #aaa);line-height:1.7;">';
        b.body.forEach(function(p) { html += '<p style="margin:0 0 12px;">' + strip(p) + '</p>'; });
        html += '</div>';
      }

      // Key levels callout
      if (b.callout_title && b.callout_body) {
        html += '<div class="briefing-callout" style="margin:16px 0;padding:12px 16px;background:var(--bg);border-left:3px solid var(--cyan);border-radius:0 6px 6px 0;">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan);margin-bottom:8px;font-weight:600;">' + b.callout_title + '</div>' +
          '<div style="font-size:13px;color:var(--text);line-height:1.8;font-family:var(--font-mono);">' + strip(b.callout_body) + '</div>' +
        '</div>';
      }

      // Action items
      if (b.action_items && b.action_items.length) {
        html += '<div class="briefing-actions" style="margin:16px 0;padding:12px 16px;background:var(--bg);border-left:3px solid var(--orange);border-radius:0 6px 6px 0;">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--orange);margin-bottom:8px;font-weight:600;">Action Items</div>' +
          '<div style="font-size:13px;color:var(--text);line-height:1.8;">';
        b.action_items.forEach(function(a) { html += '<div style="margin-bottom:4px;">• ' + strip(a) + '</div>'; });
        html += '</div></div>';
      }

      // Closing quote + timestamp
      var footer = '';
      if (b.closing_quote) {
        footer += '<span style="font-style:italic;">"' + strip(b.closing_quote) + '"</span>';
      }
      if (age) {
        footer += (footer ? ' · ' : '') + '<span>' + age + '</span>';
      }
      if (footer) {
        html += '<div style="margin-top:14px;font-size:12px;color:var(--text-dim);">' + footer + '</div>';
      }

      el.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }).catch(function() {
      var el = document.getElementById('market-briefing');
      if (el) el.innerHTML = '<div style="color:var(--text-dim);padding:16px;text-align:center;">Could not load briefing.</div>';
    });
  }

  // === Data Loading ===
  function loadMarketData() {
    // Fear & Greed
    fetch('../data/fear-greed.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data) {
          BT.components.fearGreed.render('fg-gauge', data);
          // Tooltip on title
          if (data.updated) {
            var fgDate = new Date(data.updated);
            var fgTitleEl = document.getElementById('fg-title');
            if (fgTitleEl) fgTitleEl.title = 'Updated: ' + fgDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
          }
        }
      }).catch(function(e) { console.error(e); });

    // VIX
    var defaultVix = {
      current: 0, sma20: 0, sma50: 0, percentile30d: 0,
      regime: 'Loading...', color: '#888',
      description: 'Loading real-time volatility metrics...'
    };
    fetch('../data/vix.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        var vixData = data ? Object.assign({}, defaultVix, data) : defaultVix;
        BT.components.vixRegime.render('vix-regime', vixData);
      }).catch(function(e) { console.error(e); BT.components.vixRegime.render('vix-regime', defaultVix); });

    // Pairs
    fetch('../data/pairs.json')
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(renderPairs).catch(function(e) { console.error(e); });

    // Sectors
    fetch('../data/sectors.json')
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(renderSectorRankings).catch(function(e) { console.error(e); });

    // Breadth
    fetch('../data/breadth.json')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data) return;
        renderBreadthGauge(data);
        renderBreadthSectorBars(data);
        renderBreadthTable(data);
        renderBreadthInsightBox(data);
      }).catch(function(e) { console.error(e); });
  }

  // === Render Functions ===
  function renderPairs(pairRatios) {
    var el = document.getElementById('pairs-grid');
    if (!el) return;
    el.innerHTML = pairRatios.map(function(p) {
      return '<div class="pair-card">' +
        '<div><div class="pair-name">' + p.pair + '</div><div class="pair-desc">' + p.desc + '</div></div>' +
        '<div class="pair-reading ' + p.color + '" style="font-weight:600;">' + p.signal + '</div>' +
      '</div>';
    }).join('');
  }

  function renderSectorRankings(sectors) {
    var el = document.getElementById('sector-rankings');
    if (!el) return;
    el.innerHTML = sectors.map(function(s, i) {
      var chgClass = s.change > 0 ? 'up' : s.change < 0 ? 'down' : 'neutral';
      var barColor = s.change > 0 ? '#00d4aa' : '#ef5350';
      var barWidth = Math.abs(s.rs);
      return '<li class="sector-rank-item">' +
        '<span class="rank-num">' + (i + 1) + '</span>' +
        '<span class="rank-name">' + s.symbol + ' <span style="color:var(--text-dim);font-weight:400;">' + s.name + '</span></span>' +
        '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + barWidth + '%;background:' + barColor + ';"></div></div>' +
        '<span class="rank-change ' + chgClass + '">' + (s.change > 0 ? '+' : '') + s.change.toFixed(1) + '%</span>' +
      '</li>';
    }).join('');
  }

  function renderBreadthGauge(breadthData) {
    var avg = breadthData.total.average;
    var color = breadthColor(avg);
    var card = document.getElementById('breadth-gauge-card');
    var svg = document.getElementById('breadth-gauge-svg');
    if (!card || !svg) return;

    card.classList.remove('glow-green', 'glow-red');
    if (avg <= 20) card.classList.add('glow-green');
    else if (avg >= 80) card.classList.add('glow-red');

    var cx = 150, cy = 145, r = 120;
    var startAngle = Math.PI;
    var needleAngle = startAngle + (avg / 100) * Math.PI;

    var segments = [
      { from: 0, to: 0.2, color: '#00d4aa' },
      { from: 0.2, to: 0.4, color: '#26a69a' },
      { from: 0.4, to: 0.6, color: '#ffa726' },
      { from: 0.6, to: 0.8, color: '#ff7043' },
      { from: 0.8, to: 1.0, color: '#ef5350' },
    ];

    var arcs = '';
    segments.forEach(function(seg) {
      var a1 = startAngle + seg.from * Math.PI;
      var a2 = startAngle + seg.to * Math.PI;
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      arcs += '<path d="M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 0 1 ' + x2 + ' ' + y2 + '" fill="none" stroke="' + seg.color + '" stroke-width="18" stroke-linecap="butt" opacity="0.25"/>';
    });

    var activeEnd = startAngle + (avg / 100) * Math.PI;
    var ax1 = cx + r * Math.cos(startAngle), ay1 = cy + r * Math.sin(startAngle);
    var ax2 = cx + r * Math.cos(activeEnd), ay2 = cy + r * Math.sin(activeEnd);
    var largeArc = avg > 50 ? 1 : 0;
    arcs += '<path d="M ' + ax1 + ' ' + ay1 + ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + ax2 + ' ' + ay2 + '" fill="none" stroke="' + color + '" stroke-width="18" stroke-linecap="round" opacity="0.9"/>';

    var nx = cx + (r - 30) * Math.cos(needleAngle);
    var ny = cy + (r - 30) * Math.sin(needleAngle);
    arcs += '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx + '" y2="' + ny + '" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>';
    arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#fff" opacity="0.8"/>';

    arcs += '<text x="18" y="' + (cy + 16) + '" fill="#00d4aa" font-size="9" font-family="monospace" font-weight="700">0%</text>';
    arcs += '<text x="270" y="' + (cy + 16) + '" fill="#ef5350" font-size="9" font-family="monospace" font-weight="700" text-anchor="end">100%</text>';
    arcs += '<text x="' + cx + '" y="18" fill="#ffa726" font-size="8" font-family="monospace" text-anchor="middle" opacity="0.6">50%</text>';

    svg.innerHTML = arcs;

    var valEl = document.getElementById('breadth-gauge-value');
    valEl.textContent = avg.toFixed(1) + '%';
    valEl.style.color = color;

    var labelEl = document.getElementById('breadth-gauge-label');
    if (avg <= 20) { labelEl.textContent = ''; labelEl.innerHTML = 'GREEN POND <span class="range-dot target" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00d4aa;margin-left:4px;vertical-align:middle;"></span>'; labelEl.style.color = '#00d4aa'; labelEl.classList.add('breadth-pulse'); }
    else if (avg >= 80) { labelEl.textContent = ''; labelEl.innerHTML = 'OVERBOUGHT <span class="range-dot stop" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef5350;margin-left:4px;vertical-align:middle;"></span>'; labelEl.style.color = '#ef5350'; labelEl.classList.add('breadth-pulse'); }
    else if (avg <= 35) { labelEl.textContent = 'WEAK BREADTH'; labelEl.style.color = '#26a69a'; labelEl.classList.remove('breadth-pulse'); }
    else if (avg >= 65) { labelEl.textContent = 'STRONG BREADTH'; labelEl.style.color = '#ff7043'; labelEl.classList.remove('breadth-pulse'); }
    else { labelEl.textContent = 'NEUTRAL'; labelEl.style.color = 'var(--text-dim)'; labelEl.classList.remove('breadth-pulse'); }
  }

  function renderBreadthSectorBars(breadthData) {
    var container = document.getElementById('breadth-bars-container');
    if (!container) return;
    var sectors = breadthData.sectors;

    var sorted = BREADTH_SECTOR_ORDER.map(function(code) {
      return { code: code, name: sectors[code] ? sectors[code].name : code, val: sectors[code] ? (sectors[code].above_20d || 0) : 0 };
    }).sort(function(a, b) { return a.val - b.val; });

    var html = '';
    sorted.forEach(function(s) {
      var color = breadthColor(s.val);
      html += '<div class="breadth-sector-row">' +
        '<div class="breadth-sector-name">' + s.code + '</div>' +
        '<div class="breadth-sector-bar-bg"><div class="breadth-sector-bar-fill" style="width:' + Math.max(s.val, 1) + '%; background:' + color + ';"></div></div>' +
        '<div class="breadth-sector-val" style="color:' + color + '">' + s.val.toFixed(1) + '%</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  function breadthBadge(val) {
    if (val == null) return '<span class="breadth-badge neutral">—</span>';
    var cls = val <= 20 ? 'oversold' : val >= 80 ? 'overbought' : 'neutral';
    return '<span class="breadth-badge ' + cls + '">' + val.toFixed(1) + '%</span>';
  }

  function renderBreadthTable(breadthData) {
    var el = document.getElementById('breadth-mbt');
    if (!el) return;
    var idx = breadthData.indices;
    var names = { SPX: 'S&P 500', NDX: 'NASDAQ 100', DJI: 'Dow Jones', RUT: 'Russell 2000', VTI: 'Total Market' };
    var html = '<thead><tr><th>Index</th><th>20-Day</th><th>50-Day</th><th>100-Day</th><th>200-Day</th></tr></thead><tbody>';
    var keys = ['SPX','NDX','DJI','RUT','VTI'];
    keys.forEach(function(code) {
      var d = idx[code] || {};
      html += '<tr><td style="font-weight:700;color:var(--text-bright);font-family:var(--font-mono);font-size:12px">' + names[code] + '</td>';
      html += '<td>' + breadthBadge(d['20d']) + '</td><td>' + breadthBadge(d['50d']) + '</td><td>' + breadthBadge(d['100d']) + '</td><td>' + breadthBadge(d['200d']) + '</td></tr>';
    });
    html += '</tbody>';
    el.innerHTML = html;
  }

  function renderBreadthInsightBox(breadthData) {
    var el = document.getElementById('breadth-insight-box');
    if (!el) return;
    var avg = breadthData.total.average;

    if (avg <= 20) {
      el.innerHTML = '<div class="breadth-insight-box green"><span class="breadth-insight-icon"><i data-lucide="circle-check-big"></i></span><span><strong>GREEN POND</strong> — Breadth at ' + avg.toFixed(1) + '%. Historically, market bottoms form at these extreme oversold levels. Watch for reversal signals.</span></div>';
    } else if (avg >= 80) {
      el.innerHTML = '<div class="breadth-insight-box red"><span class="breadth-insight-icon"><i data-lucide="octagon-alert"></i></span><span><strong>OVERBOUGHT</strong> — Breadth at ' + avg.toFixed(1) + '%. Most sectors extended. Consider tightening stops and reducing risk.</span></div>';
    } else if (avg <= 35) {
      el.innerHTML = '<div class="breadth-insight-box dim"><span class="breadth-insight-icon"><i data-lucide="bar-chart-3"></i></span><span>Breadth is weak at ' + avg.toFixed(1) + '% — fewer than a third of stocks trading above their 20-day SMA.</span></div>';
    } else {
      el.innerHTML = '<div class="breadth-insight-box dim"><span class="breadth-insight-icon"><i data-lucide="bar-chart-3"></i></span><span>Market breadth at ' + avg.toFixed(1) + '% — neutral zone. No extreme readings.</span></div>';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // === TradingView Heatmap ===
  function initHeatmap() {
    var container = document.getElementById('tv-heatmap');
    if (!container) return;
    var script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "exchanges": [],
      "dataSource": "SPY500",
      "grouping": "sector",
      "blockSize": "market_cap_basic",
      "blockColor": "change",
      "locale": "en",
      "symbolUrl": "",
      "colorTheme": "dark",
      "hasTopBar": true,
      "isDataSetEnabled": true,
      "isZoomEnabled": true,
      "hasSymbolTooltip": true,
      "isMonoSize": false,
      "width": "100%",
      "height": 500
    });
    container.appendChild(script);
  }

  // === Sector Rotation RRG ===
  function initRRG() {
    if (typeof createRRG === 'function') {
      createRRG('rrg-market', {
        trailLength: 13,
        height: '500px',
        showControls: true,
        showRankings: true,
      });
    }
  }

  BT.pages.market = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
