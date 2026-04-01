/**
 * pages/autoresearch.js — AI Researcher: Regime Intelligence dashboard for BreakingTrades v2
 * Registers as BT.pages.autoresearch with render(), init(), destroy()
 */
(function() {
  'use strict';

  var _charts = [];
  var _collapsibles = [];

  // ===== Constants =====
  var REGIME_COLORS = {
    CRISIS: '#ef5350', BEAR: '#ffa726', CORRECTION: '#ffeb3b',
    NEUTRAL: '#888', BULL: '#00d4aa', 'STRONG BULL': '#00c853', EUPHORIA: '#ab47bc'
  };
  var REGIME_CSS = {
    CRISIS: 'crisis', BEAR: 'bear', CORRECTION: 'correction',
    NEUTRAL: 'neutral', BULL: 'bull', 'STRONG BULL': 'strong-bull', EUPHORIA: 'euphoria'
  };

  var SIGNAL_META = {
    move:         { name: 'MOVE',       icon: 'activity' },
    vix:          { name: 'VIX',        icon: 'flame' },
    fear_greed:   { name: 'F&G',        icon: 'gauge' },
    breadth:      { name: 'Breadth',    icon: 'bar-chart-3' },
    sp_vs_d200:   { name: 'S&P/D200',  icon: 'trending-down' },
    hyg_spy:      { name: 'HYG/SPY',   icon: 'landmark' },
    xlf_spy:      { name: 'XLF/SPY',   icon: 'building-2' },
    dxy:          { name: 'DXY',        icon: 'dollar-sign' },
    yield_curve:  { name: 'Yield Curve',icon: 'git-branch' },
    growth_value: { name: 'Growth/Val', icon: 'scale' },
    rsp_spy:      { name: 'RSP/SPY',   icon: 'users' },
    put_call:     { name: 'Put/Call',   icon: 'phone-call' },
    copper_gold:  { name: 'Cu/Au',      icon: 'gem' },
    international:{ name: 'Intl',       icon: 'globe' },
    xly_xlp:      { name: 'XLY/XLP',   icon: 'shopping-cart' }
  };

  var RULE_DESCRIPTIONS = {
    R001: 'Bonds breaking down → reduce exposure immediately',
    R003: 'Smart/Dumb Money at extremes → contrarian signal',
    R006: 'Daily close below 20 MA = exit position',
    R007: 'W20 mean reversion — buy dips at weekly 20 MA',
    R008: 'Yield curve un-inversion = MORE dangerous than inversion',
    R010: 'Don\'t chase extended moves — wait for pullback',
    R011: 'Put/Call + drawdown combo = strongest buy signal',
    R013: 'F&G extremes: <25 = opportunity, >75 = caution',
    R025: 'Defensive sector leadership = rising risk',
    R026: 'Leveraged ETF warning — excess building',
    R029: 'Trailing stops in trend — protect gains',
    R043: 'Sector rotation confirmation needed before entry',
    R054: 'Below D200 + W50 = bears in full control',
    R056: 'Buy the V, not the dip — wait for reversal structure',
    R057: 'MOVE Index collapse = bottom confirmed'
  };

  var CYCLE_PHASES = ['TROUGH', 'RECOVERY', 'EXPANSION', 'PEAK', 'CONTRACTION'];

  // ===== Helpers =====
  function fmt(n, d) { return n != null ? Number(n).toFixed(d == null ? 2 : d) : '—'; }
  function pct(n) { return n != null ? (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%' : '—'; }
  function signalClass(score) {
    if (score <= 30) return 'bearish';
    if (score >= 65) return 'bullish';
    return 'neutral';
  }
  function signalColor(score) {
    if (score <= 30) return 'var(--red)';
    if (score >= 65) return 'var(--cyan)';
    return '#888';
  }
  function formatSignal(s) {
    return (s || '').replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }
  function daysSinceLabel(since, days) {
    if (!since) return '';
    var d = new Date(since + 'T00:00:00');
    var mon = d.toLocaleString('en-US', { month: 'short' });
    return mon + ' ' + d.getDate() + ' (' + days + ' day' + (days !== 1 ? 's' : '') + ')';
  }
  var REGIME_DESCRIPTIONS = {
    CRISIS: 'Extreme stress across all signals — capital preservation is the priority.',
    BEAR: 'Persistent downtrend with deteriorating internals — defensive positioning, minimal new longs.',
    CORRECTION: 'Pullback within a broader trend — reduced size, selective entries, tighter stops.',
    NEUTRAL: 'Mixed signals, no clear directional edge — normal positioning, follow individual setups.',
    BULL: 'Broad strength with confirming internals — full position sizing, trend-following entries.',
    'STRONG BULL': 'Strong uptrend with wide participation — aggressive positioning, let winners run.',
    EUPHORIA: 'Extreme optimism and stretched valuations — take profits, tighten stops, watch for reversal.'
  };

  function regimeColor(regime) { return REGIME_COLORS[(regime || '').toUpperCase()] || '#888'; }
  function regimeCss(regime) { return REGIME_CSS[(regime || '').toUpperCase()] || 'neutral'; }

  // ===== Render =====
  function render(el) {
    el.innerHTML =
      '<div class="page-content" style="max-width:1400px;margin:0 auto;">' +

        // Page intro
        '<div class="regime-page-intro" style="margin-bottom:20px;padding:14px 18px;border-left:3px solid var(--cyan);background:var(--card-bg);border-radius:0 6px 6px 0;">' +
          '<p style="margin:0;font-size:15px;color:var(--text-muted, #aaa);line-height:1.7;">' +
            'Our AI analyzes <strong style="color:var(--text);">15 market signals</strong> across volatility, sentiment, breadth, credit, and macro — weighted and scored into a single regime classification. ' +
            'The result: a clear read on the current market environment, what rules to follow, and what conditions would change the outlook.' +
          '</p>' +
        '</div>' +

        // Hero
        '<div id="regime-hero" class="regime-hero">' +
          '<div class="regime-hero-left"><div class="skeleton" style="width:180px;height:48px;border-radius:6px;"></div></div>' +
          '<div class="regime-hero-right"><div class="skeleton" style="width:100%;height:60px;border-radius:6px;"></div></div>' +
        '</div>' +

        // Components
        '<div id="section-components">' +
          '<div class="section-title" id="hdr-components"><i data-lucide="layers"></i> Regime Score Components</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Each signal is scored 0–100 and weighted by importance. Combined, they produce the overall regime score above.</p>' +
          '<div id="body-components">' +
            '<div class="regime-components-grid" id="regime-components">' +
              Array(16).join('<div class="skeleton" style="height:110px;border-radius:6px;"></div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        // Playbook + Rules
        '<div id="section-playbook">' +
          '<div class="section-title" id="hdr-playbook"><i data-lucide="book-open"></i> Playbook &amp; Active Rules</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Position sizing, sector bias, and entry/exit rules — automatically adjusted for the current regime.</p>' +
          '<div id="body-playbook">' +
            '<div class="regime-dual-cards">' +
              '<div class="skeleton" style="height:200px;border-radius:6px;"></div>' +
              '<div class="skeleton" style="height:200px;border-radius:6px;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Market Internals
        '<div id="section-internals">' +
          '<div class="section-title" id="hdr-internals"><i data-lucide="bar-chart-2"></i> Market Internals</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Key instruments and global indices that confirm or diverge from the regime signal.</p>' +
          '<div id="body-internals">' +
            '<div class="regime-internals-grid" id="regime-internals">' +
              Array(12).join('<div class="skeleton" style="height:90px;border-radius:6px;"></div>') +
            '</div>' +
          '</div>' +
        '</div>' +

        // Commodity Chain
        '<div id="section-commodity">' +
          '<div class="section-title" id="hdr-commodity"><i data-lucide="link"></i> Commodity Chain (Late-Cycle Sequence)</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Inflation flows through commodities in sequence: Gold → Copper → Energy → Agriculture. Tracking where the chain is breaking helps identify cycle turning points.</p>' +
          '<div id="body-commodity">' +
            '<div class="regime-commodity-chain" id="regime-commodity"><div class="skeleton" style="width:100%;height:80px;border-radius:6px;"></div></div>' +
          '</div>' +
        '</div>' +

        // Transition Signals
        '<div id="section-transition">' +
          '<div class="section-title" id="hdr-transition"><i data-lucide="arrow-right-circle"></i> Transition Signals</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Conditions that need to be met before the regime can shift. When all bars fill, expect a regime change.</p>' +
          '<div id="body-transition">' +
            '<div id="regime-transition"><div class="skeleton" style="height:160px;border-radius:6px;"></div></div>' +
          '</div>' +
        '</div>' +

        // Business Cycle
        '<div id="section-cycle">' +
          '<div class="section-title" id="hdr-cycle"><i data-lucide="activity"></i> Business Cycle Position</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Where we sit in the macro economic cycle — drives which sectors and strategies outperform historically.</p>' +
          '<div id="body-cycle">' +
            '<div id="regime-cycle" class="regime-cycle-card"><div class="skeleton" style="height:200px;border-radius:6px;"></div></div>' +
          '</div>' +
        '</div>' +

        // History
        '<div id="section-history">' +
          '<div class="section-title" id="hdr-history"><i data-lucide="clock"></i> Regime History</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Daily regime scores over time — reveals trends, regime transitions, and how long each environment persists.</p>' +
          '<div id="body-history">' +
            '<div class="regime-history-container" id="regime-history"><div class="skeleton" style="height:200px;border-radius:6px;"></div></div>' +
          '</div>' +
        '</div>' +

      '</div>';
  }

  // ===== Init =====
  function init() {
    var regimeData = null;
    var historyData = [];
    var pricesData = null;

    // Fetch all data in parallel
    var fetches = [
      fetch('../data/regime.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch('../data/regime-history.jsonl').then(function(r) { return r.ok ? r.text() : null; }).catch(function() { return null; }),
      fetch('../data/prices.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ];

    Promise.all(fetches).then(function(results) {
      regimeData = results[0];
      if (results[1]) {
        historyData = results[1].trim().split('\n').filter(Boolean).map(function(line) {
          try { return JSON.parse(line); } catch(e) { return null; }
        }).filter(Boolean);
      }
      pricesData = results[2];

      if (!regimeData) {
        renderNoData();
        return;
      }

      renderHero(regimeData);
      renderComponents(regimeData);
      renderPlaybookAndRules(regimeData);
      renderInternals(regimeData, pricesData);
      renderCommodityChain(pricesData);
      renderTransition(regimeData);
      renderCycle(regimeData);
      renderHistory(historyData);

      // Collapsibles
      var sections = [
        ['regime:components', 'hdr-components', 'body-components'],
        ['regime:playbook', 'hdr-playbook', 'body-playbook'],
        ['regime:internals', 'hdr-internals', 'body-internals'],
        ['regime:commodity', 'hdr-commodity', 'body-commodity'],
        ['regime:transition', 'hdr-transition', 'body-transition'],
        ['regime:cycle', 'hdr-cycle', 'body-cycle'],
        ['regime:history', 'hdr-history', 'body-history']
      ];
      _collapsibles = [];
      sections.forEach(function(s) {
        var hdr = document.getElementById(s[1]);
        var body = document.getElementById(s[2]);
        if (hdr && body) {
          _collapsibles.push(BT.components.collapsible.init(s[0], hdr, body));
        }
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  // ===== No Data =====
  function renderNoData() {
    var hero = document.getElementById('regime-hero');
    if (hero) {
      hero.innerHTML = '<div class="regime-no-data" style="width:100%;">' +
        '<i data-lucide="alert-triangle" style="width:32px;height:32px;color:var(--orange);"></i>' +
        '<h2 style="margin:12px 0 8px;color:var(--text);">Regime data not available</h2>' +
        '<p style="color:var(--text-dim);">The AI Researcher needs data to analyze. Regime scoring runs daily as part of the EOD pipeline.</p>' +
      '</div>';
    }
    // Clear skeletons in other sections
    ['regime-components', 'body-playbook', 'regime-internals', 'regime-commodity',
     'regime-transition', 'regime-cycle', 'regime-history'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ===== Hero =====
  function renderHero(d) {
    var el = document.getElementById('regime-hero');
    if (!el) return;
    var css = regimeCss(d.regime);
    var color = regimeColor(d.regime);
    var cycleLabel = d.cycle ? d.cycle.phase : '';
    var regimeDesc = REGIME_DESCRIPTIONS[(d.regime || '').toUpperCase()] || '';

    el.className = 'regime-hero regime-bg-' + css;
    el.innerHTML =
      '<div class="regime-hero-left">' +
        '<div class="regime-hero-name regime-' + css + '">' + (d.regime || '—') + '</div>' +
        (regimeDesc ? '<div style="font-size:15px;color:var(--text-muted, #aaa);margin:8px 0 10px;line-height:1.6;max-width:420px;">' + regimeDesc + '</div>' : '') +
        '<div class="regime-hero-since"><i data-lucide="calendar" style="width:12px;height:12px;"></i> Active since: ' + daysSinceLabel(d.since, d.duration_days) + '</div>' +
        (cycleLabel ? '<div class="regime-cycle-badge"><i data-lucide="refresh-cw" style="width:10px;height:10px;"></i> ' + cycleLabel + '</div>' : '') +
      '</div>' +
      '<div class="regime-hero-right">' +
        '<div class="regime-score-label">Regime Score</div>' +
        '<div class="regime-score-value" style="color:' + color + ';">' + (d.score != null ? d.score : '—') + '<span style="font-size:16px;color:var(--text-dim);font-weight:400;"> / 100</span></div>' +
        '<div class="regime-score-bar">' +
          '<div class="regime-score-bar-fill" style="width:100%;"></div>' +
          '<div class="regime-score-bar-indicator" style="left:' + (d.score || 0) + '%;"></div>' +
        '</div>' +
        '<div class="regime-score-labels">' +
          '<span>Crisis</span><span>Bear</span><span>Correction</span><span>Neutral</span><span>Bull</span><span>Strong</span><span>Euphoria</span>' +
        '</div>' +
      '</div>';
  }

  // ===== Components =====
  function renderComponents(d) {
    var el = document.getElementById('regime-components');
    if (!el || !d.components) return;
    var keys = Object.keys(SIGNAL_META);
    var html = '';
    keys.forEach(function(key) {
      var comp = d.components[key];
      if (!comp) return;
      var meta = SIGNAL_META[key];
      var sc = signalClass(comp.score);
      var col = signalColor(comp.score);
      var icon = meta.icon;
      // For S&P/D200, pick trending-up if bullish
      if (key === 'sp_vs_d200' && comp.score >= 50) icon = 'trending-up';

      html += '<div class="regime-signal-card ' + sc + '">' +
        '<div class="regime-signal-header">' +
          '<i data-lucide="' + icon + '"></i>' +
          '<span class="regime-signal-name">' + meta.name + '</span>' +
        '</div>' +
        '<div class="regime-signal-value" style="color:' + col + ';">' + fmt(comp.value) + '</div>' +
        '<div class="regime-signal-minibar"><div class="regime-signal-minibar-fill" style="width:' + (comp.score || 0) + '%;background:' + col + ';"></div></div>' +
        '<div class="regime-signal-label" style="color:' + col + ';">' + formatSignal(comp.signal) + '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  // ===== Playbook + Rules =====
  function renderPlaybookAndRules(d) {
    var el = document.getElementById('body-playbook');
    if (!el) return;
    var pb = d.playbook || {};
    var posSize = Math.round((pb.position_size || 0) * 100);
    // Strip internal rule IDs like (R006) from display text
    function stripRuleIds(s) { return s ? s.replace(/\s*\(R\d+\)\s*/g, ' ').trim() : '—'; }
    var sectorBias = (pb.sector_bias || []).map(function(s) { return '<span class="regime-pill favor">' + s + '</span>'; }).join('');
    var avoidSectors = (pb.avoid_sectors || []).map(function(s) { return '<span class="regime-pill avoid">' + s + '</span>'; }).join('');

    var rulesHtml = (d.active_rules || []).map(function(id) {
      var desc = RULE_DESCRIPTIONS[id] || 'Active rule';
      return '<div class="regime-rule-item">' +
        '<span class="regime-rule-text">' + desc + '</span>' +
      '</div>';
    }).join('');

    el.innerHTML =
      '<div class="regime-dual-cards">' +
        '<div class="regime-playbook-card">' +
          '<div class="section-title" style="font-size:10px;"><i data-lucide="book-open"></i> Playbook (' + (d.regime || '') + ')</div>' +
          '<div class="regime-playbook-row">' +
            '<span class="regime-playbook-label">Position</span>' +
            '<span class="regime-playbook-value">' + posSize + '% of normal' +
              '<div class="regime-position-bar"><div class="regime-position-bar-fill" style="width:' + posSize + '%;"></div></div>' +
            '</span>' +
          '</div>' +
          '<div class="regime-playbook-row">' +
            '<span class="regime-playbook-label">Favor</span>' +
            '<span class="regime-playbook-value">' + (sectorBias || '—') + '</span>' +
          '</div>' +
          '<div class="regime-playbook-row">' +
            '<span class="regime-playbook-label">Avoid</span>' +
            '<span class="regime-playbook-value">' + (avoidSectors || '—') + '</span>' +
          '</div>' +
          '<div class="regime-playbook-row">' +
            '<span class="regime-playbook-label">Stop</span>' +
            '<span class="regime-playbook-value">' + stripRuleIds(pb.stop_rule) + '</span>' +
          '</div>' +
          '<div class="regime-playbook-row">' +
            '<span class="regime-playbook-label">Entry</span>' +
            '<span class="regime-playbook-value">' + stripRuleIds(pb.entry_rule) + '</span>' +
          '</div>' +
          '<div class="regime-playbook-row">' +
            '<span class="regime-playbook-label">Watch</span>' +
            '<span class="regime-playbook-value" style="color:var(--cyan);">' + stripRuleIds(pb.key_watch) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="regime-rules-card">' +
          '<div class="section-title" style="font-size:10px;"><i data-lucide="shield"></i> Active Rules (' + (d.active_rules || []).length + ')</div>' +
          (rulesHtml || '<div class="regime-no-data">No active rules</div>') +
        '</div>' +
      '</div>';
  }

  // ===== Market Internals =====
  function renderInternals(d, prices) {
    var el = document.getElementById('regime-internals');
    if (!el) return;
    // Unwrap nested { tickers: {...} } format from prices.json
    if (prices && prices.tickers) prices = prices.tickers;

    var tickers = [
      { key: '^MOVE', label: 'MOVE', signal: d.components && d.components.move ? d.components.move.signal : '' },
      { key: 'yield_curve', label: 'Yield Spread', value: d.components && d.components.yield_curve ? d.components.yield_curve.value : null, signal: d.components && d.components.yield_curve ? d.components.yield_curve.signal : '' },
      { key: 'DX-Y.NYB', label: 'DXY', signal: d.components && d.components.dxy ? d.components.dxy.signal : '' },
      { key: 'copper_gold', label: 'Cu/Au Ratio', value: d.components && d.components.copper_gold ? d.components.copper_gold.value : null, signal: d.components && d.components.copper_gold ? d.components.copper_gold.signal : '' },
      { key: '^DJT', label: 'Transports' },
      { key: 'SMH', label: 'Semiconductors' },
      { key: '^GDAXI', label: 'DAX' },
      { key: '^KS11', label: 'KOSPI' },
      { key: '^HSI', label: 'Hang Seng' },
      { key: '^AXJO', label: 'ASX 200' },
      { key: 'FXI', label: 'China (FXI)' }
    ];

    var html = '';
    tickers.forEach(function(t) {
      var price = null, chg = null, sigLabel = t.signal || '';
      if (t.value != null) {
        price = t.value;
      } else if (prices && prices[t.key]) {
        var p = prices[t.key];
        price = p.price || p.close || p.last;
        chg = p.changePercent || p.change_pct || p.change || p.pct;
      }
      var col = 'var(--text)';
      if (chg != null) col = chg >= 0 ? 'var(--cyan)' : 'var(--red)';
      if (sigLabel) {
        var sc = t.value != null && d.components ? (d.components[t.key.replace('^', '').toLowerCase()] || {}).score : null;
        if (sc != null) col = signalColor(sc);
      }

      html += '<div class="regime-internal-card">' +
        '<div class="regime-internal-ticker">' + t.label + '</div>' +
        '<div class="regime-internal-value" style="color:' + col + ';">' + (price != null ? fmt(price) : '—') + '</div>' +
        (chg != null ? '<div class="regime-internal-change" style="color:' + (chg >= 0 ? 'var(--cyan)' : 'var(--red)') + ';">' + pct(chg) + '</div>' : '') +
        (sigLabel ? '<div class="regime-internal-signal" style="color:' + col + ';">' + formatSignal(sigLabel) + '</div>' : '') +
      '</div>';
    });
    el.innerHTML = html;
  }

  // ===== Commodity Chain =====
  function renderCommodityChain(prices) {
    var el = document.getElementById('regime-commodity');
    if (!el) return;
    // Unwrap nested { tickers: {...} } format from prices.json
    if (prices && prices.tickers) prices = prices.tickers;

    var commodities = [
      { name: 'Gold', ticker: 'GLD', icon: 'gem' },
      { name: 'Copper', ticker: 'CPER', icon: 'hexagon' },
      { name: 'Energy', ticker: 'XLE', icon: 'zap' },
      { name: 'Agriculture', ticker: 'ADM', icon: 'wheat' }
    ];

    var html = '';
    commodities.forEach(function(c, i) {
      var price = null, chg = null;
      if (prices && prices[c.ticker]) {
        var p = prices[c.ticker];
        price = p.price || p.close || p.last;
        chg = p.changePercent || p.change_pct || p.change || p.pct;
      }
      // Determine status based on change
      var statusIcon = 'minus', statusLabel = 'No Data', statusCol = 'var(--text-dim)';
      if (chg != null) {
        if (chg > 3) { statusIcon = 'check-circle'; statusLabel = 'Moved'; statusCol = 'var(--cyan)'; }
        else if (chg > 0) { statusIcon = 'loader'; statusLabel = 'In Progress'; statusCol = 'var(--orange)'; }
        else if (chg > -2) { statusIcon = 'alert-triangle'; statusLabel = 'Breaking'; statusCol = 'var(--yellow)'; }
        else { statusIcon = 'minus-circle'; statusLabel = 'Not Yet'; statusCol = 'var(--text-dim)'; }
      }

      if (i > 0) {
        html += '<div class="regime-commodity-arrow"><i data-lucide="chevron-right"></i></div>';
      }
      html += '<div class="regime-commodity-node">' +
        '<i data-lucide="' + c.icon + '" style="color:' + statusCol + ';"></i>' +
        '<div class="regime-commodity-name">' + c.name + '</div>' +
        (price != null ? '<div style="font-family:var(--font-mono);font-size:11px;color:var(--text);">' + fmt(price) + '</div>' : '') +
        '<div class="regime-commodity-status" style="color:' + statusCol + ';"><i data-lucide="' + statusIcon + '" style="width:10px;height:10px;"></i> ' + statusLabel + '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  // ===== Transition Signals =====
  function renderTransition(d) {
    var el = document.getElementById('regime-transition');
    if (!el || !d.transition_signals) return;
    var ts = d.transition_signals;
    var html = '<div style="margin-bottom:10px;font-size:14px;color:var(--text-muted, #aaa);text-transform:uppercase;letter-spacing:1px;">What needs to change — <strong style="color:' + regimeColor(d.regime) + ';">' + d.regime + '</strong> → <strong>' + (ts.target || '?') + '</strong></div>';
    html += '<div class="regime-transition-list">';
    (ts.conditions || []).forEach(function(c) {
      var progress = 0;
      if (c.target != null && c.current != null) {
        // Calculate progress toward target
        var range = Math.abs(c.target - c.current);
        var max = Math.max(Math.abs(c.target), Math.abs(c.current)) || 1;
        progress = c.met ? 100 : Math.max(0, Math.min(95, (1 - range / max) * 100));
      }
      var icon = c.met ? 'check-circle' : 'circle';
      var iconCol = c.met ? 'var(--cyan)' : 'var(--text-dim)';
      var barCol = c.met ? 'var(--cyan)' : 'var(--orange)';

      html += '<div class="regime-transition-item">' +
        '<div class="regime-transition-icon"><i data-lucide="' + icon + '" style="color:' + iconCol + ';"></i></div>' +
        '<div class="regime-transition-label">' + c.label + '</div>' +
        '<div class="regime-transition-values">' + fmt(c.current) + ' → ' + fmt(c.target) + '</div>' +
        '<div class="regime-transition-bar"><div class="regime-transition-bar-fill" style="width:' + progress + '%;background:' + barCol + ';"></div></div>' +
      '</div>';
    });
    html += '</div>';
    html += '<div class="regime-transition-summary">' + (ts.conditions_met || 0) + ' of ' + (ts.conditions_total || 0) + ' conditions met</div>';
    el.innerHTML = html;
  }

  // ===== Business Cycle =====
  function renderCycle(d) {
    var el = document.getElementById('regime-cycle');
    if (!el) return;
    var phase = d.cycle ? d.cycle.phase : 'EXPANSION';
    var phaseIdx = CYCLE_PHASES.indexOf(phase.toUpperCase());
    if (phaseIdx < 0) phaseIdx = 2;

    // SVG wave with positioned dot
    var points = [
      { x: 50, y: 160, label: 'TROUGH' },
      { x: 175, y: 80, label: 'RECOVERY' },
      { x: 300, y: 30, label: 'EXPANSION' },
      { x: 425, y: 40, label: 'PEAK' },
      { x: 550, y: 160, label: 'CONTRACTION' }
    ];
    var dot = points[phaseIdx];

    var svg = '<svg viewBox="0 0 600 200" class="regime-cycle-svg" xmlns="http://www.w3.org/2000/svg">';
    // Wave path
    svg += '<path d="M 50 160 Q 112 80, 175 80 Q 237 80, 300 30 Q 362 -10, 425 40 Q 488 90, 550 160" fill="none" stroke="#2a2a50" stroke-width="3"/>';
    // Phase labels
    points.forEach(function(p, i) {
      var col = i === phaseIdx ? regimeColor(d.regime) : '#555';
      var fw = i === phaseIdx ? '700' : '400';
      var ty = p.y > 100 ? p.y + 24 : p.y - 14;
      svg += '<text x="' + p.x + '" y="' + ty + '" text-anchor="middle" fill="' + col + '" font-size="11" font-weight="' + fw + '" font-family="var(--font-mono)">' + p.label + '</text>';
    });
    // Dot
    svg += '<circle cx="' + dot.x + '" cy="' + dot.y + '" r="8" fill="' + regimeColor(d.regime) + '" stroke="#fff" stroke-width="2">';
    svg += '<animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite"/>';
    svg += '</circle>';
    svg += '</svg>';

    el.innerHTML = svg +
      '<div class="regime-cycle-phase-label" style="color:' + regimeColor(d.regime) + ';">' + phase + '</div>';
  }

  // ===== History Timeline =====
  function renderHistory(data) {
    var el = document.getElementById('regime-history');
    if (!el) return;
    if (!data || data.length === 0) {
      el.innerHTML = '<div class="regime-no-data"><i data-lucide="clock" style="width:24px;height:24px;"></i><p>Regime history builds automatically over time as the AI scores each trading day.</p></div>';
      return;
    }

    el.innerHTML = '<canvas id="regime-history-canvas" class="regime-history-canvas"></canvas>';
    var canvas = document.getElementById('regime-history-canvas');
    if (!canvas || typeof Chart === 'undefined') return;

    var labels = data.map(function(d) { return d.date; });
    var scores = data.map(function(d) { return d.score; });
    var colors = data.map(function(d) {
      var r = (d.regime || '').toUpperCase();
      return REGIME_COLORS[r] || '#888';
    });

    // Build segments for coloring
    var bgColors = scores.map(function(s, i) {
      var c = colors[i];
      // Add alpha
      return c + '33';
    });

    var chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Regime Score',
          data: scores,
          borderColor: colors.length === 1 ? colors[0] : 'var(--cyan)',
          backgroundColor: bgColors.length === 1 ? bgColors[0] : 'rgba(0,212,170,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: data.length > 30 ? 0 : 4,
          pointBackgroundColor: colors,
          borderWidth: 2,
          segment: {
            borderColor: function(ctx) { return colors[ctx.p0DataIndex] || 'var(--cyan)'; },
            backgroundColor: function(ctx) { return bgColors[ctx.p0DataIndex] || 'rgba(0,212,170,0.1)'; }
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function(items) { return items[0].label; },
              label: function(item) {
                var d = data[item.dataIndex];
                return (d.regime || '') + ' — Score: ' + item.raw;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#1a1a2e' },
            ticks: { color: '#666', font: { size: 10, family: 'var(--font-mono)' } }
          },
          y: {
            min: 0, max: 100,
            grid: { color: '#1a1a2e' },
            ticks: { color: '#666', font: { size: 10, family: 'var(--font-mono)' }, stepSize: 25 }
          }
        }
      }
    });
    _charts.push(chart);
  }

  // ===== Destroy =====
  function destroy() {
    _charts.forEach(function(c) { try { c.destroy(); } catch(e) {} });
    _charts = [];
    _collapsibles.forEach(function(c) { if (c && c.destroy) c.destroy(); });
    _collapsibles = [];
  }

  // ===== Register =====
  BT.pages.autoresearch = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
