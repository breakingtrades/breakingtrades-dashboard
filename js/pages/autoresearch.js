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
    NEUTRAL: '#888888', BULL: '#00d4aa', 'STRONG BULL': '#00c853', EUPHORIA: '#ab47bc'
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

  // Regime codes -> human labels
  function regimeHuman(code) {
    var map = {
      CRISIS: 'Crisis', BEAR: 'Bear market', CORRECTION: 'Correction',
      NEUTRAL: 'Neutral', BULL: 'Bull market', STRONG_BULL: 'Strong bull',
      'STRONG BULL': 'Strong bull', EUPHORIA: 'Euphoria'
    };
    var key = (code || '').toUpperCase();
    return map[key] || code || '?';
  }

  // Plain-English context for each known transition condition label
  var TRANSITION_PLAIN = {
    'F&G > 65':               { name: 'Fear & Greed above 65',        hint: 'Sentiment shifts from mixed to broadly bullish' },
    'F&G > 75':               { name: 'Fear & Greed above 75',        hint: 'Crowd euphoria threshold' },
    'F&G < 25':               { name: 'Fear & Greed below 25',        hint: 'Extreme fear — contrarian buy zone' },
    'F&G < 35':               { name: 'Fear & Greed below 35',        hint: 'Fear building — defensive mode' },
    'Breadth > 65%':          { name: 'Market breadth above 65%',     hint: '2 of 3 stocks above their 200-day trend' },
    'Breadth > 70%':          { name: 'Market breadth above 70%',     hint: 'Broad participation — strong rally' },
    'Breadth < 40%':          { name: 'Market breadth below 40%',     hint: 'Most stocks below trend — weak market' },
    'Breadth < 30%':          { name: 'Market breadth below 30%',     hint: 'Broad weakness — bearish tape' },
    'S&P > 5% above D200':    { name: 'S&P 500 more than 5% above its 200-day average', hint: 'Trend strengthening clearly above support' },
    'S&P > 3% above D200':    { name: 'S&P 500 more than 3% above its 200-day average', hint: 'Trend regaining the 200-day zone' },
    'S&P below D200':         { name: 'S&P 500 below its 200-day average', hint: 'Long-term trend breaks down' },
    'VIX > 25':               { name: 'VIX above 25',                 hint: 'Volatility spike — stress emerging' },
    'VIX < 18':               { name: 'VIX below 18',                 hint: 'Volatility cooling — calm returning' },
    'VIX < 15':               { name: 'VIX below 15',                 hint: 'Low-volatility regime — complacency risk' }
  };

  function transitionPlain(rawLabel) {
    return TRANSITION_PLAIN[rawLabel] || { name: rawLabel, hint: '' };
  }

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

        // ===== NEW: Strategy Results (Non-Technical) — shows autoresearch output =====
        '<div id="section-perf">' +
          '<div class="section-title" id="hdr-perf"><i data-lucide="trending-up"></i> How the strategy is performing</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">How our strategy has performed across different market conditions, tested on real history.</p>' +
          '<div id="body-perf">' +
            '<div id="strategy-perf" style="min-height:120px;"><div class="skeleton" style="height:120px;border-radius:6px;"></div></div>' +
          '</div>' +
        '</div>' +

        '<div id="section-findings">' +
          '<div class="section-title" id="hdr-findings"><i data-lucide="flask-conical"></i> What the research found this week</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Plain-language summary of the most recent tuning run.</p>' +
          '<div id="body-findings">' +
            '<div id="research-findings" style="min-height:80px;"><div class="skeleton" style="height:80px;border-radius:6px;"></div></div>' +
          '</div>' +
        '</div>' +

        '<div id="section-rules">' +
          '<div class="section-title" id="hdr-rules"><i data-lucide="check-square"></i> What rules are in play</div>' +
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">The rules our strategy is actively following on every trade.</p>' +
          '<div id="body-rules">' +
            '<div id="strategy-rules" style="min-height:80px;"><div class="skeleton" style="height:80px;border-radius:6px;"></div></div>' +
          '</div>' +
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
          '<p class="section-subtitle" style="margin:-4px 0 12px;font-size:14px;color:var(--text-muted, #aaa);line-height:1.6;">Daily regime scores (0–100) over time — line color shows the active regime. Hover any point for full details.</p>' +
          '<div class="regime-legend" style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:14px;">' +
            '<div class="regime-legend-item" title="Score 0–25: Extreme market stress. Capital preservation priority. Avoid new longs, hold cash or hedges." style="cursor:help;"><span class="regime-legend-dot" style="background:#ef5350;"></span><span class="regime-legend-label">CRISIS <span style="color:#666;font-size:11px;">(0–25)</span></span></div>' +
            '<div class="regime-legend-item" title="Score 26–38: Persistent downtrend, deteriorating internals. Defensive positioning, minimal new longs, reduced size." style="cursor:help;"><span class="regime-legend-dot" style="background:#ffa726;"></span><span class="regime-legend-label">BEAR <span style="color:#666;font-size:11px;">(26–38)</span></span></div>' +
            '<div class="regime-legend-item" title="Score 39–47: Pullback within a broader trend. Reduce size, selective entries, tighter stops. Wait for stabilization." style="cursor:help;"><span class="regime-legend-dot" style="background:#ffeb3b;"></span><span class="regime-legend-label">CORRECTION <span style="color:#666;font-size:11px;">(39–47)</span></span></div>' +
            '<div class="regime-legend-item" title="Score 48–54: Mixed signals, no clear directional edge. Normal sizing, follow individual setups, stay disciplined." style="cursor:help;"><span class="regime-legend-dot" style="background:#888;"></span><span class="regime-legend-label">NEUTRAL <span style="color:#666;font-size:11px;">(48–54)</span></span></div>' +
            '<div class="regime-legend-item" title="Score 55–69: Broad market strength with confirming internals. Full position sizing, trend-following entries, trail stops." style="cursor:help;"><span class="regime-legend-dot" style="background:#00d4aa;"></span><span class="regime-legend-label">BULL <span style="color:#666;font-size:11px;">(55–69)</span></span></div>' +
            '<div class="regime-legend-item" title="Score 70–84: Strong uptrend, wide participation across sectors. Aggressive sizing, let winners run, trail at Weekly 20." style="cursor:help;"><span class="regime-legend-dot" style="background:#00c853;"></span><span class="regime-legend-label">STRONG BULL <span style="color:#666;font-size:11px;">(70–84)</span></span></div>' +
            '<div class="regime-legend-item" title="Score 85–100: Extreme optimism, stretched valuations. Take profits, tighten stops aggressively, watch for reversal signals." style="cursor:help;"><span class="regime-legend-dot" style="background:#ab47bc;"></span><span class="regime-legend-label">EUPHORIA <span style="color:#666;font-size:11px;">(85–100)</span></span></div>' +
          '</div>' +
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
      fetch('data/regime.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch('data/regime-history.jsonl').then(function(r) { return r.ok ? r.text() : null; }).catch(function() { return null; }),
      fetch('data/prices.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch('data/autoresearch-summary.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ];

    Promise.all(fetches).then(function(results) {
      regimeData = results[0];
      if (results[1]) {
        historyData = results[1].trim().split('\n').filter(Boolean).map(function(line) {
          try { return JSON.parse(line); } catch(e) { return null; }
        }).filter(Boolean);
      }
      pricesData = results[2];
      var summaryData = results[3];

      // New result cards render independently of regime data
      renderStrategyPerf(summaryData);
      renderResearchFindings(summaryData);
      renderStrategyRules(summaryData);

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
        ['regime:perf', 'hdr-perf', 'body-perf'],
        ['regime:findings', 'hdr-findings', 'body-findings'],
        ['regime:rules', 'hdr-rules', 'body-rules'],
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

  // ===== NEW: Strategy Performance (non-technical per-regime verdict) =====
  var VERDICT_COLORS = {
    strong:    { color: 'var(--green)',  icon: 'check-circle-2', label: 'Strong' },
    solid:     { color: 'var(--cyan)',   icon: 'check',          label: 'Solid' },
    defensive: { color: 'var(--blue)',   icon: 'shield',         label: 'Defensive' },
    mixed:     { color: 'var(--orange)', icon: 'alert-circle',   label: 'Mixed' },
    weak:      { color: 'var(--red)',    icon: 'x-circle',       label: 'Weak' },
    too_early: { color: 'var(--text-dim)', icon: 'hourglass',    label: 'Too early to tell' }
  };

  function renderStrategyPerf(summary) {
    var el = document.getElementById('strategy-perf');
    if (!el) return;
    if (!summary || !summary.regime_performance || summary.regime_performance.length === 0) {
      el.innerHTML = '<div style="padding:18px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;color:var(--text-dim);font-size:14px;">' +
        '<i data-lucide="info" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px;"></i>' +
        'Strategy tuning data unavailable. Regime analysis continues below.' +
      '</div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    var tuning = summary.last_tuning || {};
    var headerLine = '';
    if (tuning.date) {
      var improvement = '';
      if (tuning.improvement_pct && Math.abs(tuning.improvement_pct) >= 0.5) {
        var sign = tuning.improvement_pct > 0 ? '+' : '';
        improvement = ' — improved <strong style="color:var(--green);">' + sign + tuning.improvement_pct.toFixed(1) + '%</strong> vs previous baseline';
      }
      headerLine = '<div style="font-size:13px;color:var(--text-dim);margin-bottom:12px;">' +
        'Last tuned <strong style="color:var(--text);">' + tuning.date + '</strong>' + improvement +
        ' (' + (tuning.experiments_run || 0) + ' experiments run)' +
      '</div>';
    }

    var rows = summary.regime_performance.map(function(r) {
      var v = VERDICT_COLORS[r.verdict] || VERDICT_COLORS.too_early;
      var verdictBadge = '<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:12px;background:' + v.color + '22;color:' + v.color + ';font-size:12px;font-weight:600;">' +
        '<i data-lucide="' + v.icon + '" style="width:12px;height:12px;"></i>' + (r.verdict_label || v.label) +
      '</span>';

      var stats = '';
      if (r.reliable && r.trades > 0) {
        stats = '<span style="color:var(--text-dim);font-size:12px;">' + r.trades + ' trades·' + r.win_rate + '% avg win rate</span>';
      } else if (!r.reliable) {
        stats = '<span style="color:var(--text-dim);font-size:12px;font-style:italic;">insufficient data</span>';
      }

      return '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);align-items:start;">' +
        '<div>' +
          '<div style="font-weight:600;color:var(--text);margin-bottom:4px;">' + (r.label || r.key) + '</div>' +
          '<div style="font-size:13px;color:var(--text-dim);line-height:1.5;">' + (r.caption || '') + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          verdictBadge +
          '<div style="margin-top:6px;">' + stats + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    el.innerHTML = headerLine +
      '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:6px;overflow:hidden;">' + rows + '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ===== NEW: Research Findings =====
  function renderResearchFindings(summary) {
    var el = document.getElementById('research-findings');
    if (!el) return;
    if (!summary || !summary.last_tuning) {
      el.innerHTML = '<div style="padding:18px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;color:var(--text-dim);font-size:14px;">Research summary unavailable.</div>';
      return;
    }

    var winners = summary.last_tuning.winners || [];
    var deadEnds = summary.last_tuning.dead_ends || [];

    var paragraphs = [];
    if (winners.length === 0) {
      paragraphs.push('<p style="margin:0;color:var(--text-dim);">No meaningful improvements discovered in the last tuning run. Existing rules remain in play.</p>');
    } else {
      var winnerList = winners.map(function(w, i) {
        return '<strong style="color:var(--text);">' + w.plain + '</strong>';
      });
      var joined;
      if (winnerList.length === 1) joined = winnerList[0];
      else if (winnerList.length === 2) joined = winnerList[0] + ' and ' + winnerList[1];
      else joined = winnerList.slice(0, -1).join(', ') + ', and ' + winnerList[winnerList.length - 1];

      paragraphs.push('<p style="margin:0 0 10px;color:var(--text);line-height:1.7;">This week\'s tuning discovered ' +
        (winners.length === 1 ? '<strong>1 improvement</strong>' : '<strong>' + winners.length + ' improvements</strong>') +
        ': ' + joined + '.</p>');
    }

    if (deadEnds.length > 0) {
      paragraphs.push('<p style="margin:0;color:var(--text-dim);font-size:13px;line-height:1.6;"><i data-lucide="minus-circle" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;"></i>' +
        'Things tested without meaningful gains: ' + deadEnds.slice(0, 3).map(function(d) {
          return d.replace(' — tested, no improvement', '');
        }).join('; ') + '.</p>');
    }

    el.innerHTML = '<div style="padding:16px 18px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;">' +
      paragraphs.join('') + '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ===== NEW: Rules in Play =====
  function renderStrategyRules(summary) {
    var el = document.getElementById('strategy-rules');
    if (!el) return;
    var rules = (summary && summary.rules_in_play) || [];
    if (rules.length === 0) {
      el.innerHTML = '<div style="padding:18px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;color:var(--text-dim);font-size:14px;">Strategy rules unavailable.</div>';
      return;
    }
    var items = rules.map(function(r) {
      return '<li style="padding:8px 0;border-bottom:1px solid var(--border);color:var(--text);font-size:14px;line-height:1.5;display:flex;align-items:flex-start;gap:10px;">' +
        '<i data-lucide="check" style="width:16px;height:16px;color:var(--cyan);margin-top:2px;flex-shrink:0;"></i>' +
        '<span>' + r + '</span>' +
      '</li>';
    }).join('');
    el.innerHTML = '<ul style="margin:0;padding:4px 18px;list-style:none;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;">' + items + '</ul>';
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

    var met = ts.conditions_met || 0;
    var total = ts.conditions_total || ((ts.conditions || []).length);
    var staleCount = (ts.conditions || []).filter(function(c) { return c.stale; }).length;
    var pctDone = total > 0 ? Math.round((met / total) * 100) : 0;

    var fromHuman = regimeHuman(d.regime);
    var toHuman   = regimeHuman(ts.target);
    var fromCol   = regimeColor(d.regime);
    var toCol     = REGIME_COLORS[(ts.target || '').toUpperCase().replace('_', ' ')] ||
                    REGIME_COLORS[(ts.target || '').toUpperCase()] || 'var(--cyan)';

    var html = '';

    // Hero header: clear regime-to-regime progression + big progress indicator
    html +=
      '<div class="tx-hero">' +
        '<div class="tx-hero-path">' +
          '<div class="tx-hero-from">' +
            '<div class="tx-hero-label">Current</div>' +
            '<div class="tx-hero-regime" style="color:' + fromCol + ';">' + fromHuman + '</div>' +
          '</div>' +
          '<div class="tx-hero-arrow"><i data-lucide="arrow-right"></i></div>' +
          '<div class="tx-hero-to">' +
            '<div class="tx-hero-label">If all conditions line up</div>' +
            '<div class="tx-hero-regime" style="color:' + toCol + ';">' + toHuman + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tx-hero-progress">' +
          '<div class="tx-hero-progress-track">' +
            '<div class="tx-hero-progress-fill" style="width:' + pctDone + '%;"></div>' +
          '</div>' +
          '<div class="tx-hero-progress-text">' +
            '<strong>' + met + ' of ' + total + '</strong> conditions met' +
            ' <span class="tx-hero-progress-pct">(' + pctDone + '%)</span>' +
            (staleCount > 0 ? ' <span class="tx-hero-stale" title="Data source unavailable — some signals are stale"><i data-lucide="alert-circle"></i> ' + staleCount + ' stale</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';

    // Conditions list
    html += '<div class="tx-conditions">';
    (ts.conditions || []).forEach(function(c) {
      var plain = transitionPlain(c.label);

      // Honest progress: how close are we on a reasonable scale?
      var pct = 0;
      if (c.met) {
        pct = 100;
      } else if (c.current != null && c.target != null) {
        // Normalize against the target magnitude
        var scale = Math.max(Math.abs(c.target), 1);
        var gap = Math.abs(c.target - c.current);
        // 0% when gap >= scale, 100% when gap == 0 (capped at 95 until met)
        pct = Math.max(0, Math.min(95, Math.round((1 - gap / scale) * 100)));
      }

      // Direction hint: are we moving toward the target?
      var direction = '';
      if (!c.met && c.current != null && c.target != null) {
        direction = (c.current < c.target) ? 'needs-up' : 'needs-down';
      }

      var statusIcon = c.met ? 'check-circle-2' : (direction === 'needs-up' ? 'trending-up' : (direction === 'needs-down' ? 'trending-down' : 'minus-circle'));
      var statusCol  = c.met ? 'var(--cyan)' : 'var(--text-dim)';
      var barClass   = c.met ? 'tx-bar-fill met' : 'tx-bar-fill';

      // Stale data: value carried forward from prior run or sentinel. Never lie
      // to the user by showing it alongside real values. Override styling.
      if (c.stale) {
        statusIcon = 'alert-circle';
        statusCol  = 'var(--text-dim)';
        barClass   = 'tx-bar-fill stale';
      }

      // Distance to target, human phrasing
      var gapText = '';
      if (c.stale) {
        gapText = 'Stale';
      } else if (!c.met && c.current != null && c.target != null) {
        var diff = Math.abs(c.target - c.current);
        gapText = diff.toFixed(diff < 10 ? 1 : 0) + ' to go';
      } else if (c.met) {
        gapText = 'Met';
      }

      html +=
        '<div class="tx-card' + (c.met ? ' met' : '') + (c.stale ? ' stale' : '') + '"' +
          (c.stale ? ' title="Data source unavailable — value carried forward from last good run"' : '') + '>' +
          '<div class="tx-card-head">' +
            '<div class="tx-card-icon" style="color:' + statusCol + ';"><i data-lucide="' + statusIcon + '"></i></div>' +
            '<div class="tx-card-title">' + plain.name + '</div>' +
            '<div class="tx-card-gap">' + gapText + '</div>' +
          '</div>' +
          (plain.hint ? '<div class="tx-card-hint">' + plain.hint + '</div>' : '') +
          '<div class="tx-card-meter">' +
            '<div class="tx-card-now">Now <strong>' + fmt(c.current) + '</strong></div>' +
            '<div class="tx-bar"><div class="' + barClass + '" style="width:' + pct + '%;"></div></div>' +
            '<div class="tx-card-target">Target <strong>' + fmt(c.target) + '</strong></div>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';

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
      return REGIME_COLORS[r] || '#888888';
    });

    // Expand 3-char hex (#888) to 6-char (#888888) so alpha suffix is valid
    function normalizeHex(c) {
      if (typeof c !== 'string' || c.charAt(0) !== '#') return c;
      if (c.length === 4) {
        return '#' + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3);
      }
      return c;
    }

    // Build segments for coloring
    var bgColors = scores.map(function(s, i) {
      var c = normalizeHex(colors[i]);
      // Add 20% alpha (0x33 = 51/255)
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
                var r = (d.regime || '').toUpperCase();
                var desc = REGIME_DESCRIPTIONS[r] || '';
                var lines = [
                  '● ' + r + '  |  Score: ' + item.raw,
                ];
                if (d.vix != null)     lines.push('VIX: ' + Number(d.vix).toFixed(1));
                if (d.fg != null)      lines.push('Fear & Greed: ' + Number(d.fg).toFixed(1));
                if (d.breadth != null) lines.push('Breadth: ' + Number(d.breadth).toFixed(1) + '%');
                if (d.cycle)           lines.push('Cycle: ' + d.cycle);
                if (desc)              lines.push('', desc);
                return lines;
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
  BT.pages.airesearcher = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
