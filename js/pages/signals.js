/**
 * pages/signals.js — Signals page module for BreakingTrades v2
 * Registers as BT.pages.signals with render(), init(), destroy()
 */
(function() {
  'use strict';

  // === TICKER DATA ===
  // Populated at init() from data/watchlist.json (live). Never hardcoded.
  // See: openspec/changes/signals-page-live-data/OPENSPEC.md
  var TICKERS = [];

  // Recompute days-until-earnings from the canonical earningsDate string.
  // The snapshot's earningsDays goes stale immediately after export, so we
  // never trust it; we derive every render.
  function _liveEarningsDays(earningsDate, fallback) {
    if (!earningsDate) return fallback != null ? fallback : null;
    var parts = String(earningsDate).split('-');
    if (parts.length !== 3) return fallback != null ? fallback : null;
    var now = new Date();
    var todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var earnUTC = Date.UTC(parseInt(parts[0],10), parseInt(parts[1],10) - 1, parseInt(parts[2],10));
    var days = Math.round((earnUTC - todayUTC) / 86400000);
    if (days < -7 || days > 365) return null;
    return days;
  }

  // Sector/exchange fallback map (watchlist.json has sector; exchange is cosmetic).
  var EXCHANGE_HINTS = {
    'NVDA':'NASDAQ','AAPL':'NASDAQ','MSFT':'NASDAQ','META':'NASDAQ','GOOG':'NASDAQ',
    'GOOGL':'NASDAQ','AMZN':'NASDAQ','TSLA':'NASDAQ','NFLX':'NASDAQ','AVGO':'NASDAQ',
    'AMD':'NASDAQ','INTC':'NASDAQ','COIN':'NASDAQ','DELL':'NASDAQ','ARM':'NASDAQ',
    'PFE':'NYSE','ABBV':'NYSE','JPM':'NYSE','V':'NYSE','UNH':'NYSE','XOM':'NYSE',
    'AR':'NYSE','SPY':'AMEX','QQQ':'NASDAQ','IWM':'AMEX','XLU':'AMEX','XLE':'AMEX',
    'XLF':'AMEX','XLK':'AMEX','XLV':'AMEX','XLY':'AMEX','XLP':'AMEX','XLI':'AMEX',
    'XLC':'AMEX','XLRE':'AMEX','XLB':'AMEX'
  };

  /**
   * Map one watchlist.json entry → Signals card shape.
   * Returns null if required fields are missing (skip rendering).
   */
  function mapWatchlistToSignal(w) {
    if (!w || !w.symbol) return null;
    if (!w.status || w.price == null) return null;  // skip broken rows
    return {
      symbol: w.symbol,
      name: w.name || w.symbol,
      sector: w.sector || '',
      group: w.group || '',
      exchange: EXCHANGE_HINTS[w.symbol] || '',
      price: w.price,
      change: w.change == null ? 0 : w.change,
      bias: w.bias || 'mixed',
      status: w.status,           // exit | triggered | approaching | active | watching
      sma20: w.sma20, sma50: w.sma50, sma200: w.sma200, w20: w.w20,
      rsi: w.rsi == null ? null : w.rsi,
      atr: w.atr, atrPct: w.atrPct,
      volRating: w.volRating || 'Normal',
      volume: w.volume, volumeAvg20: w.volumeAvg20, volumeRatio: w.volumeRatio,
      high52w: w.high52w, low52w: w.low52w,
      pctFrom52wHigh: w.pctFrom52wHigh,
      earningsDate: w.earningsDate, earningsDays: _liveEarningsDays(w.earningsDate, w.earningsDays),
      smaCrossover: w.smaCrossover, smaCrossoverDate: w.smaCrossoverDate,
      updated: w.updated,
      _sectorRisk: null  // filled in later from sector-risk.json
    };
  }


  // === SECTOR ROTATION DATA ===
  var sectorRotation = [
    { symbol:'XLU', name:'Utilities', x:30, y:70, px:15, py:45, quadrant:'leading' },
    { symbol:'XLE', name:'Energy', x:25, y:65, px:10, py:35, quadrant:'leading' },
    { symbol:'XLP', name:'Staples', x:5, y:55, px:-5, py:40, quadrant:'improving' },
    { symbol:'XLF', name:'Financials', x:-15, y:-10, px:5, py:15, quadrant:'weakening' },
    { symbol:'XLK', name:'Technology', x:-30, y:-25, px:-10, py:10, quadrant:'lagging' },
    { symbol:'XLY', name:'Discretionary', x:-20, y:-15, px:-5, py:20, quadrant:'weakening' },
    { symbol:'XLV', name:'Healthcare', x:10, y:40, px:-5, py:25, quadrant:'improving' },
    { symbol:'XLI', name:'Industrials', x:-5, y:5, px:10, py:25, quadrant:'weakening' },
    { symbol:'XLC', name:'Communication', x:-25, y:-20, px:-10, py:5, quadrant:'lagging' },
    { symbol:'XLRE', name:'Real Estate', x:15, y:30, px:-5, py:10, quadrant:'improving' },
    { symbol:'XLB', name:'Materials', x:-10, y:10, px:5, py:30, quadrant:'improving' }
  ];

  var STATUS_ORDER = ['triggered','approaching','active','exit','watching'];
  var STATUS_CONFIG = {
    triggered: {
      icon:'<i data-lucide="target"></i>', label:'Triggered',
      filter:'triggered', badgeClass:'triggered-badge',
      tip:'Crossed above a key moving average today — actionable entry.'
    },
    approaching: {
      icon:'<i data-lucide="clock"></i>', label:'Approaching Entry',
      filter:'approaching', badgeClass:'approaching-badge',
      tip:'Within 2% of SMA20 or SMA50 — watching for a trigger.'
    },
    active: {
      icon:'<i data-lucide="trending-up"></i>', label:'Active / Bullish Stack',
      filter:'active', badgeClass:'active-badge',
      tip:'Bull stack + extended >5% above SMA20. Consider trailing stop.'
    },
    exit: {
      icon:'<i data-lucide="triangle-alert"></i>', label:'Exit Signal',
      filter:'exit', badgeClass:'exit-badge',
      tip:'Crossed below SMA20 today — risk management trigger.'
    },
    watching: {
      icon:'<i data-lucide="eye"></i>', label:'Watching',
      filter:'watching', badgeClass:'watching-badge',
      tip:'No active trigger — monitoring conditions.'
    }
  };

  // === PAIR RATIOS CONFIG ===
  var PAIRS = [
    { num:'XLY', den:'XLP', label:'XLY/XLP', upMsg:'Consumer risk-on', downMsg:'Consumer weakening', flatMsg:'Consumer neutral' },
    { num:'HYG', den:'SPY', label:'HYG/SPY', upMsg:'Credit risk-on', downMsg:'Credit stress', flatMsg:'Credit stable' },
    { num:'IWM', den:'SPY', label:'IWM/SPY', upMsg:'Small caps leading', downMsg:'Large caps leading', flatMsg:'Breadth flat' },
    { num:'XLV', den:'SPY', label:'XLV/SPY', upMsg:'Defensive rotation', downMsg:'No defensive rotation', flatMsg:'Healthcare neutral' },
    { num:'XLE', den:'SPY', label:'XLE/SPY', upMsg:'Energy outperforming', downMsg:'Energy lagging', flatMsg:'Energy neutral' },
    { num:'IWM', den:'QQQ', label:'IWM/QQQ', upMsg:'Value > Growth', downMsg:'Growth > Value', flatMsg:'Value/Growth flat' },
    { num:'GLD', den:'SPY', label:'GLD/SPY', upMsg:'Safe haven bid', downMsg:'Risk appetite', flatMsg:'Gold neutral' },
    { num:'TLT', den:'SPY', label:'TLT/SPY', upMsg:'Flight to bonds', downMsg:'Bonds lagging', flatMsg:'Bonds neutral' }
  ];
  var PAIR_THRESHOLD = 0.01;

  // === STATE ===
  var activeStatusFilter = 'all';
  var activeBiasFilters = { bull:true, mixed:true, bear:true };
  var searchQuery = '';
  var sortMode = 'status';
  var _sectorRiskData = {};
  var _rrg = null;
  var _boundHandlers = {};
  var _collapsibles = [];

  // === UTILITY ===
  function getExchange(ticker) {
    if (window.BT && BT.getExchange) {
      var e = BT.getExchange(ticker);
      if (e) return e;
    }
    var nasdaq = ['AAPL','AMZN','GOOG','GOOGL','MSFT','NVDA','META','COIN','ARM','DELL','TSLA','NFLX','AMD','AVGO','MU','QCOM','AMAT','LRCX','MRVL','CRDO','ADSK','CHTR','TMUS','NBIS','SMCI','PLTR','CRWD','PANW','IBIT','EQIX','BILI','JD','PDD','LI'];
    var amex = ['XLU'];
    if (nasdaq.indexOf(ticker) >= 0) return 'NASDAQ';
    if (amex.indexOf(ticker) >= 0) return 'AMEX';
    return 'NYSE';
  }

  function fmtPrice(n) {
    return n >= 1000 ? n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
      : Number(n).toFixed(2);
  }

  function pctDiff(from, to) {
    return ((to - from) / from * 100).toFixed(1);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /** Build a structured, ticker-specific reasoning object for the status badge.
   *
   * Returns:
   *   {
   *     headline: 1-liner,
   *     reasons: [ { ok: true|false|'mixed', text: "..." }, ... ],
   *     stats: ["RSI 63 (neutral)", "ATR 2.8%", ...]
   *   }
   *
   * Used in two places:
   *   - title attribute on the status badge (flattened to multi-line text)
   *   - inline "Why?" popover (rendered as structured HTML)
   */
  function buildStatusReasoning(t) {
    var p = t.price;
    var sma20 = t.sma20, sma50 = t.sma50, sma200 = t.sma200, w20 = t.w20;
    var bias = t.bias;
    var rsi = t.rsi;
    var atrPct = t.atrPct;
    var vol = t.volRating;
    var pctHigh = t.pctFrom52wHigh;
    var ed = t.earningsDays;
    var cross = t.smaCrossover;

    var reasons = [];
    var H = {
      triggered:   'Reclaimed a key MA today — entry signal.',
      approaching: 'Within 2% of SMA20 / SMA50 — watching for reclaim.',
      active:      'Bullish stack — price extended above SMA20.',
      exit:        'Closed below SMA20 — risk-management trigger.',
      watching:    'No active trigger — monitoring conditions.'
    };
    var headline = H[t.status] || 'Monitoring.';

    var pp = function(label, v) {
      if (v == null) return null;
      var pct = ((p - v) / v * 100);
      return { label: label, value: v, above: p > v, pct: pct };
    };
    var mas = [pp('SMA20', sma20), pp('SMA50', sma50), pp('W20', w20), pp('SMA200', sma200)].filter(Boolean);

    // Bias stack interpretation
    if (bias === 'bull') {
      reasons.push({ ok: true, text: 'Bull stack: price above primary MAs (trend follower\u2019s long zone)' });
    } else if (bias === 'bear') {
      reasons.push({ ok: false, text: 'Bear stack: MAs above price \u2014 broader downtrend in force' });
    } else {
      reasons.push({ ok: 'mixed', text: 'Mixed stack: price between MAs, no clean trend yet' });
    }

    // Status-specific reasons
    if (t.status === 'triggered') {
      var sma20Above = sma20 != null && p > sma20;
      reasons.push({ ok: sma20Above,
        text: sma20Above
          ? 'Trigger: price $' + fmt2(p) + ' is ABOVE SMA20 $' + fmt2(sma20) + ' (+' + ((p - sma20) / sma20 * 100).toFixed(2) + '%)'
          : 'Note: status flagged but price NOT above SMA20 \u2014 verify' });
      if (cross === 'golden_cross')   reasons.push({ ok: true,  text: 'Golden cross: SMA50 > SMA200 (medium-term tailwind)' });
      if (cross === 'death_cross')    reasons.push({ ok: false, text: 'Death cross: SMA50 < SMA200 \u2014 broader downtrend not reclaimed yet' });
      if (sma200 != null && p < sma200) reasons.push({ ok: false, text: 'Caveat: still below SMA200 $' + fmt2(sma200) + ' (' + ((p - sma200) / sma200 * 100).toFixed(1) + '%) \u2014 daily reclaim only, not a regime shift' });
    }

    if (t.status === 'approaching') {
      var nearest = mas.filter(function(m) { return m.label === 'SMA20' || m.label === 'SMA50'; })
        .sort(function(a,b){ return Math.abs(a.pct) - Math.abs(b.pct); })[0];
      if (nearest) {
        reasons.push({ ok: 'mixed',
          text: 'Closest MA: ' + nearest.label + ' $' + fmt2(nearest.value) + ' \u2014 price ' + nearest.pct.toFixed(2) + '% ' + (nearest.above ? 'above' : 'below') });
      }
      reasons.push({ ok: 'mixed', text: 'Watching for daily close above the level for a "triggered" promotion' });
    }

    if (t.status === 'active') {
      if (sma20 != null && p > sma20) {
        var ext = ((p - sma20) / sma20 * 100);
        reasons.push({ ok: ext < 8 ? true : 'mixed',
          text: 'Extended +' + ext.toFixed(2) + '% above SMA20' + (ext > 8 ? ' \u2014 stretched, consider trailing stop' : ' \u2014 in trend zone') });
      }
    }

    if (t.status === 'exit') {
      if (sma20 != null) {
        reasons.push({ ok: false,
          text: 'Trigger: price $' + fmt2(p) + ' is BELOW SMA20 $' + fmt2(sma20) + ' (' + ((p - sma20) / sma20 * 100).toFixed(2) + '%)' });
      }
      if (sma50 != null && p < sma50) {
        reasons.push({ ok: false, text: 'Also below SMA50 $' + fmt2(sma50) + ' \u2014 multi-MA breakdown, not a routine pullback' });
      }
    }

    if (t.status === 'watching') {
      mas.slice(0, 2).forEach(function(m) {
        reasons.push({ ok: m.above ? true : false,
          text: m.label + ' $' + fmt2(m.value) + ' \u2014 price ' + (m.above ? 'above' : 'below') + ' (' + m.pct.toFixed(1) + '%)' });
      });
    }

    // Stats context (always shown)
    var stats = [];
    if (rsi != null) {
      var rsiTag = rsi >= 70 ? 'overbought' : rsi <= 30 ? 'oversold' : rsi >= 60 ? 'strong' : rsi <= 40 ? 'weak' : 'neutral';
      stats.push('RSI ' + rsi.toFixed(0) + ' (' + rsiTag + ')');
    }
    if (atrPct != null) stats.push('ATR ' + atrPct.toFixed(1) + '%');
    if (vol) stats.push('Vol ' + vol);
    if (pctHigh != null) stats.push(pctHigh.toFixed(1) + '% from 52w high');
    if (ed != null && ed >= 0 && ed <= 14) {
      stats.push('\u26A0 Earnings in ' + ed + 'd');
    }

    return { headline: headline, reasons: reasons, stats: stats };
  }

  /** Flatten reasoning to a multi-line string for the title attribute. */
  function buildStatusReason(t) {
    var r = buildStatusReasoning(t);
    var lines = [r.headline, ''];
    r.reasons.forEach(function(x) {
      var glyph = x.ok === true ? '\u2713' : x.ok === false ? '\u2717' : '\u2022';
      lines.push(glyph + ' ' + x.text);
    });
    if (r.stats.length) {
      lines.push('');
      lines.push(r.stats.join(' \u2022 '));
    }
    return lines.join('\n');
  }

  /** Render reasoning as inline HTML for the "Why?" popover. */
  function renderStatusReasoningHTML(t) {
    var r = buildStatusReasoning(t);
    var rows = r.reasons.map(function(x) {
      var cls = x.ok === true ? 'why-ok' : x.ok === false ? 'why-bad' : 'why-mixed';
      var glyph = x.ok === true ? '\u2713' : x.ok === false ? '\u2717' : '\u2022';
      return '<li class="' + cls + '"><span class="why-glyph">' + glyph + '</span>' + esc(x.text) + '</li>';
    }).join('');
    var stats = r.stats.length
      ? '<div class="why-stats">' + r.stats.map(esc).join(' \u2022 ') + '</div>'
      : '';
    return '<div class="why-headline">' + esc(r.headline) + '</div>' +
           '<ul class="why-list">' + rows + '</ul>' +
           stats;
  }

  function biasTip(t) {
    var p = t.price;
    var rel = function(label, v) {
      if (v == null) return '';
      return label + ' ' + (p > v ? '>' : '<') + ' $' + fmt2(v);
    };
    var stack = [rel('SMA20', t.sma20), rel('SMA50', t.sma50), rel('W20', t.w20)].filter(Boolean).join(' • ');
    var desc = t.bias === 'bull' ? 'All MAs below price (bull stack)'
             : t.bias === 'bear' ? 'All MAs above price (bear stack)'
             : 'MAs mixed vs price';
    return desc + '. ' + stack;
  }

  function fmt2(n) { return Number(n).toFixed(2); }

  function volRatingClass(r) {
    if (!r) return 'vol-normal';
    var k = String(r).toLowerCase();
    return k === 'extreme' ? 'vol-extreme'
         : k === 'high' ? 'vol-high'
         : k === 'low' ? 'vol-low' : 'vol-normal';
  }

  function generateSparkline(data, bias) {
    var w = 200, h = 36, pad = 2;
    var max = Math.max.apply(null, data), min = Math.min.apply(null, data);
    var range = max - min || 1;
    var pts = data.map(function(v, i) {
      var x = pad + (i / (data.length - 1)) * (w - pad * 2);
      var y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var color = bias === 'bull' ? '#00d4aa' : bias === 'bear' ? '#ef5350' : '#ffa726';
    var gradId = 'sg' + Math.random().toString(36).substr(2,6);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="sparkline-svg" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.15"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<polygon points="' + pts + ' ' + (w-pad) + ',' + h + ' ' + pad + ',' + h + '" fill="url(#' + gradId + ')"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  }

  // === RENDER FUNCTIONS ===
  function renderStatusTabs() {
    var el = document.getElementById('status-tabs');
    if (!el) return;
    var counts = { all: TICKERS.length };
    STATUS_ORDER.forEach(function(s) { counts[s] = TICKERS.filter(function(t) { return t.status === s; }).length; });

    var tabs = [{ key:'all', label:'All', icon:'', tip:'Show every watched ticker.' }];
    STATUS_ORDER.forEach(function(s) {
      var c = STATUS_CONFIG[s];
      tabs.push({ key:s, label:c.label, icon:c.icon + ' ', tip:c.tip });
    });

    el.innerHTML = tabs.map(function(t) {
      return '<div class="status-tab' + (activeStatusFilter === t.key ? ' active' : '') + '" ' +
        'data-filter="' + t.key + '" title="' + esc(t.tip || '') + '">' +
        t.icon + t.label + ' <span class="badge">' + counts[t.key] + '</span></div>';
    }).join('');

    // Bind click handlers
    var tabEls = el.querySelectorAll('.status-tab');
    for (var i = 0; i < tabEls.length; i++) {
      tabEls[i].addEventListener('click', function() {
        activeStatusFilter = this.getAttribute('data-filter');
        _savePref();
        renderStatusTabs();
        renderCards();
      });
    }

    // Render Lucide icons in tabs
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderCard(t, idx) {
    var pc = t.change >= 0 ? 'up' : 'down';
    var arrow = t.change >= 0 ? '▲' : '▼';
    var bc = 'bias-' + t.bias;

    var cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.watching;
    var statusLabel = cfg.label.toUpperCase();
    var statusIcon = cfg.icon;
    var badgeClass = cfg.badgeClass;
    var statusClass = 's-' + t.status;

    // ---- Technical Range bar (52w low ↔ 52w high, with SMA markers) ----
    var rangeBarHtml = '';
    if (t.low52w != null && t.high52w != null && t.high52w > t.low52w) {
      var lo = t.low52w, hi = t.high52w;
      var span = hi - lo;
      var pos = function(v) { return clamp(((v - lo) / span) * 100, 0, 100); };
      var pricePct = pos(t.price);
      var pctHigh = t.pctFrom52wHigh != null ? t.pctFrom52wHigh : ((t.price - hi) / hi * 100);
      var pctLow = ((t.price - lo) / lo) * 100;

      var markers = '';
      var addMarker = function(label, v, cls) {
        if (v == null || v < lo || v > hi) return;
        var tipText = label + ' $' + fmt2(v) + ' (' + (t.price > v ? 'price above' : 'price below') + ', ' + pctDiff(v, t.price) + '% away)';
        markers += '<span class="tr-mark ' + cls + '" style="left:' + pos(v).toFixed(1) + '%" title="' + esc(tipText) + '">' + label + '</span>';
      };
      addMarker('SMA200', t.sma200, 'tr-sma200');
      addMarker('SMA50',  t.sma50,  'tr-sma50');
      addMarker('SMA20',  t.sma20,  'tr-sma20');

      var barTip = '52-week range $' + fmt2(lo) + ' – $' + fmt2(hi) +
        '. Currently ' + pctHigh.toFixed(1) + '% off high, +' + pctLow.toFixed(1) + '% above low.';
      rangeBarHtml =
        '<div class="range-bar-container" title="' + esc(barTip) + '">' +
          '<div class="tech-range-bar">' +
            '<span class="tr-end tr-lo" title="52w low $' + fmt2(lo) + '">$' + fmt2(lo) + '</span>' +
            '<span class="tr-end tr-hi" title="52w high $' + fmt2(hi) + '">$' + fmt2(hi) + '</span>' +
            markers +
            '<div class="tr-fill" style="width:' + pricePct.toFixed(1) + '%"></div>' +
            '<div class="price-dot" style="left:' + pricePct.toFixed(1) + '%" title="Price $' + fmt2(t.price) + '"></div>' +
          '</div>' +
        '</div>';
    }

    // ---- Badges: status + bias (always), RSI (if OB/OS), Earnings (if <=14d), Sector-risk ----
    var statusTip = buildStatusReason(t);
    var biasBadgeTip = biasTip(t);

    var rsiBadge = '';
    if (t.rsi != null && (t.rsi > 70 || t.rsi < 30)) {
      var ob = t.rsi > 70;
      var rTip = 'RSI ' + t.rsi.toFixed(1) + ' — ' + (ob ? 'overbought (>70)' : 'oversold (<30)');
      rsiBadge = '<span class="rsi-badge ' + (ob ? 'rsi-ob' : 'rsi-os') + '" title="' + esc(rTip) + '">' +
        '<i data-lucide="activity"></i> RSI ' + t.rsi.toFixed(0) + (ob ? ' OB' : ' OS') + '</span>';
    }

    var earnBadge = '';
    if (t.earningsDays != null && t.earningsDays <= 14 && t.earningsDays >= 0) {
      var eTip = 'Earnings in ' + t.earningsDays + ' day' + (t.earningsDays === 1 ? '' : 's') +
        (t.earningsDate ? ' — ' + t.earningsDate : '');
      earnBadge = '<span class="earnings-badge" title="' + esc(eTip) + '">' +
        '<i data-lucide="calendar"></i> Earnings ' + t.earningsDays + 'd</span>';
    }

    var sectorRiskHtml = '';
    if (t._sectorRisk) {
      var srTip = (t._sectorRisk.etf || '') + ' sector rotation quadrant: ' + t._sectorRisk.quadrant +
        ' (risk: ' + t._sectorRisk.risk + ')';
      sectorRiskHtml = '<span class="sector-risk-badge sr-' + t._sectorRisk.risk + '" title="' + esc(srTip) + '">' +
        '<i data-lucide="refresh-cw"></i> ' + esc(t._sectorRisk.quadrant) + '</span>';
    }

    // ---- Stats row (volume + ATR with tooltips) ----
    var volTxt = t.volume != null ? (t.volume / 1e6).toFixed(1) + 'M' : '—';
    var volRatioTxt = t.volumeRatio != null ? t.volumeRatio.toFixed(1) + 'x avg' : '';
    var volTip = 'Volume today ' + volTxt + (volRatioTxt ? ' (' + volRatioTxt + '). Rating: ' + t.volRating : '');
    var atrTip = t.atr != null
      ? 'ATR $' + fmt2(t.atr) + ' (' + (t.atrPct != null ? t.atrPct.toFixed(1) : '?') + '% of price) — typical daily range'
      : 'ATR unavailable';

    var sma20Rel = t.sma20 != null ? (t.price > t.sma20 ? 'above' : 'below') : '';
    var sma50Rel = t.sma50 != null ? (t.price > t.sma50 ? 'above' : 'below') : '';
    var w20Rel = t.w20 != null ? (t.price > t.w20 ? 'above' : 'below') : '';
    var sma20Arr = t.price > t.sma20 ? '↑' : '↓';
    var sma50Arr = t.price > t.sma50 ? '↑' : '↓';
    var w20Arr = t.price > t.w20 ? '↑' : '↓';

    return '<div class="setup-card ' + statusClass + ' card-animate" data-ticker="' + t.symbol + '"' +
      ' data-status="' + t.status + '" data-bias="' + t.bias + '" data-sector="' + esc(t.sector) + '"' +
      ' style="animation-delay:' + (idx * 0.04) + 's">' +
      '<div class="card-top">' +
        '<div>' +
          '<div class="card-ticker">' + esc(t.symbol) + '</div>' +
          '<div class="card-name">' + esc(t.name) + ' · ' + esc(t.sector) + '</div>' +
        '</div>' +
        '<div class="card-price">' +
          '<div class="price ' + pc + '" title="Last price $' + fmt2(t.price) + '">$' + fmtPrice(t.price) + '</div>' +
          '<div class="change ' + pc + '" title="Intraday change">' + arrow + ' ' + Math.abs(t.change).toFixed(1) + '%</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-meta">' +
        '<span class="status-badge ' + badgeClass + '" title="' + esc(statusTip) + '" data-why-sym="' + esc(t.symbol) + '">' + statusIcon + ' ' + statusLabel +
        ' <span class="why-affordance" aria-label="Why?" title="Why this signal?">\u24D8</span>' +
        '</span>' +
        '<span class="bias-badge ' + bc + '" title="' + esc(biasBadgeTip) + '">' + t.bias.toUpperCase() + '</span>' +
        rsiBadge +
        earnBadge +
        sectorRiskHtml +
      '</div>' +
      rangeBarHtml +
      '<div class="levels-row">' +
        '<div class="level-pill" title="SMA20 — 20-day simple moving average">' +
          '<div class="dot ' + sma20Rel + '"></div><span class="lbl">SMA20</span>' +
          '<span class="val">$' + (t.sma20 != null ? fmt2(t.sma20) : '—') + ' ' + sma20Arr + '</span></div>' +
        '<div class="level-pill" title="SMA50 — 50-day simple moving average">' +
          '<div class="dot ' + sma50Rel + '"></div><span class="lbl">SMA50</span>' +
          '<span class="val">$' + (t.sma50 != null ? fmt2(t.sma50) : '—') + ' ' + sma50Arr + '</span></div>' +
        '<div class="level-pill" title="Weekly 20 — 20-week moving average (longer trend)">' +
          '<div class="dot ' + w20Rel + '"></div><span class="lbl">W20</span>' +
          '<span class="val">$' + (t.w20 != null ? fmt2(t.w20) : '—') + ' ' + w20Arr + '</span></div>' +
        '<div class="level-pill" title="Relative Strength Index (14) — >70 overbought, <30 oversold">' +
          '<span class="lbl">RSI</span>' +
          '<span class="val">' + (t.rsi != null ? t.rsi.toFixed(1) : '—') + '</span></div>' +
      '</div>' +
      '<div class="card-stats">' +
        '<span title="' + esc(volTip) + '"><i data-lucide="bar-chart-3"></i> Vol: ' + volTxt +
          (volRatioTxt ? ' (' + volRatioTxt + ')' : '') + '</span>' +
        '<span title="' + esc(atrTip) + '"><i data-lucide="zap"></i> ATR: ' +
          (t.atr != null ? '$' + fmt2(t.atr) : '—') +
          (t.atrPct != null ? ' (' + t.atrPct.toFixed(1) + '%)' : '') + '</span>' +
      '</div>' +
    '</div>';
  }

  function getFilteredTickers() {
    var filtered = TICKERS.filter(function(t) {
      if (activeStatusFilter !== 'all' && t.status !== activeStatusFilter) return false;
      if (!activeBiasFilters[t.bias]) return false;
      if (searchQuery && t.symbol.toLowerCase().indexOf(searchQuery) < 0 && t.name.toLowerCase().indexOf(searchQuery) < 0 && t.sector.toLowerCase().indexOf(searchQuery) < 0) return false;
      return true;
    });

    if (sortMode === 'change-desc') filtered.sort(function(a,b) { return b.change - a.change; });
    else if (sortMode === 'change-asc') filtered.sort(function(a,b) { return a.change - b.change; });
    else if (sortMode === 'alpha') filtered.sort(function(a,b) { return a.symbol.localeCompare(b.symbol); });
    else if (sortMode === 'rsi') filtered.sort(function(a,b) { return a.rsi - b.rsi; });

    return filtered;
  }

  function renderCards() {
    var container = document.getElementById('cards-container');
    if (!container) return;
    var filtered = getFilteredTickers();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No setups match your filters.</div>';
      return;
    }

    if (sortMode === 'status' && activeStatusFilter === 'all') {
      var html = '';
      var cardIdx = 0;
      STATUS_ORDER.forEach(function(status) {
        var group = filtered.filter(function(t) { return t.status === status; });
        if (group.length === 0) return;
        var cfg = STATUS_CONFIG[status];
        html += '<div class="group-header"><h3>' + cfg.icon + ' ' + cfg.label + '</h3><span class="cnt">' + group.length + '</span></div>';
        group.forEach(function(t) { html += renderCard(t, cardIdx++); });
      });
      container.innerHTML = html;
    } else {
      var html2 = '';
      filtered.forEach(function(t, i) { html2 += renderCard(t, i); });
      container.innerHTML = html2;
    }

    // Bind card clicks
    var cards = container.querySelectorAll('.setup-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function(ev) {
        // If the click was on a "Why?" affordance, show popover instead of opening detail
        var whyEl = ev.target.closest && ev.target.closest('.why-affordance');
        if (whyEl) {
          ev.stopPropagation();
          var badge = whyEl.closest('.status-badge');
          var sym = badge && badge.getAttribute('data-why-sym');
          if (sym) _showWhyPopover(badge, sym);
          return;
        }
        var sym2 = this.getAttribute('data-ticker');
        _openDetail(sym2);
      });
    }

    // Render Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function _showWhyPopover(anchorEl, symbol) {
    // Find the ticker
    var t = null;
    for (var i = 0; i < TICKERS.length; i++) {
      if (TICKERS[i].symbol === symbol) { t = TICKERS[i]; break; }
    }
    if (!t) return;

    // Remove any existing popover
    var existing = document.getElementById('why-popover');
    if (existing) existing.remove();

    var pop = document.createElement('div');
    pop.id = 'why-popover';
    pop.className = 'why-popover why-status-' + t.status;
    pop.innerHTML =
      '<div class="why-pop-head">' +
        '<span class="why-pop-sym">' + esc(t.symbol) + '</span>' +
        '<span class="why-pop-status">' + esc(String(t.status).toUpperCase()) + '</span>' +
        '<button class="why-pop-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="why-pop-body">' + renderStatusReasoningHTML(t) + '</div>' +
      '<div class="why-pop-foot">Click "View Detail" for chart + full breakdown.' +
        ' <button class="why-pop-detail">View Detail</button>' +
      '</div>';

    document.body.appendChild(pop);

    // Position next to anchor
    var rect = anchorEl.getBoundingClientRect();
    var top = rect.bottom + window.scrollY + 6;
    var left = rect.left + window.scrollX;
    var maxLeft = window.innerWidth - 360 - 16;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';

    var close = function() {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
      document.removeEventListener('click', outsideClick, true);
      document.removeEventListener('keydown', escClose);
    };
    var outsideClick = function(ev) {
      if (!pop.contains(ev.target)) close();
    };
    var escClose = function(ev) {
      if (ev.key === 'Escape') close();
    };
    pop.querySelector('.why-pop-close').addEventListener('click', close);
    pop.querySelector('.why-pop-detail').addEventListener('click', function(ev) {
      ev.stopPropagation();
      close();
      _openDetail(symbol);
    });
    setTimeout(function() {
      document.addEventListener('click', outsideClick, true);
      document.addEventListener('keydown', escClose);
    }, 0);
  }

  function _openDetail(symbol) {
    var t = null;
    for (var i = 0; i < TICKERS.length; i++) {
      if (TICKERS[i].symbol === symbol) { t = TICKERS[i]; break; }
    }
    if (!t) return;
    BT.components.detailModal.open(symbol, {
      tickerData: t,
      tvSymbol: (window.BT && BT.tvSymbol) ? BT.tvSymbol(symbol) : null,
      exchange: getExchange(symbol),
      sections: ['charts', 'ta', 'pattern', 'range', 'levels', 'analysis']
    });
  }

  function renderSectorRotation() {
    var qColors = { leading:'#00d4aa', improving:'#42a5f5', weakening:'#ffa726', lagging:'#ef5350' };
    var qLabels = { leading:'Leading ↗', improving:'Improving ↑', weakening:'Weakening ↓', lagging:'Lagging ↘' };
    var groups = {};
    sectorRotation.forEach(function(s) {
      if (!groups[s.quadrant]) groups[s.quadrant] = [];
      groups[s.quadrant].push(s);
    });

    var order = ['leading', 'improving', 'weakening', 'lagging'];
    var html = '<div class="sr-list">';
    order.forEach(function(q) {
      if (!groups[q] || groups[q].length === 0) return;
      var color = qColors[q];
      html += '<div class="sr-group"><div class="sr-group-label" style="color:' + color + '">' + qLabels[q] + '</div>';
      groups[q].forEach(function(s) {
        var dx = s.x - s.px, dy = s.y - s.py;
        var momentum = Math.sqrt(dx*dx + dy*dy).toFixed(0);
        var arrow = dy > 10 ? '⬆' : dy < -10 ? '⬇' : dx > 10 ? '➡' : dx < -10 ? '⬅' : '●';
        html += '<div class="sr-item">' +
          '<span class="sr-symbol" style="color:' + color + '">' + s.symbol + '</span>' +
          '<span class="sr-name">' + s.name + '</span>' +
          '<span class="sr-arrow" style="color:' + color + '">' + arrow + '</span>' +
          '<span class="sr-momentum" style="color:' + color + ';opacity:0.6;">' + momentum + '</span>' +
        '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    var sqEl = document.getElementById('sector-quadrant');
    if (sqEl) sqEl.innerHTML = html;
  }

  function renderBriefing() {
    fetch('data/briefing.json').then(function(r) { return r.ok ? r.json() : null; }).then(function(b) {
      if (!b) return;
      var titleEl = document.getElementById('hdr-signals-briefing');
      if (titleEl) titleEl.innerHTML = '<i data-lucide="crosshair"></i> ' + (b.title || 'Daily Briefing');
      var html = '';
      if (b.headline) html += '<p><strong>' + b.headline + '</strong></p>';
      if (b.body) b.body.forEach(function(p) { html += '<p>' + p + '</p>'; });
      if (b.callout_title) html += '<div class="callout"><strong>' + b.callout_title + ':</strong><br>' + (b.callout_body || '') + '</div>';
      if (b.action_items && b.action_items.length) {
        html += '<div class="callout"><strong>Action items:</strong><br>';
        b.action_items.forEach(function(a) { html += '• ' + a + '<br>'; });
        html += '</div>';
      }
      if (b.closing_quote) html += '<p style="color:var(--text-dim);font-size:11px;margin-top:12px;">"' + b.closing_quote + '"</p>';
      var contentEl = document.getElementById('briefing-content');
      if (contentEl) contentEl.innerHTML = html;
    }).catch(function() {});
  }

  function renderPairRatios(watchlist) {
    var el = document.getElementById('ratios-strip');
    if (!el) return;

    var map = {};
    for (var i = 0; i < watchlist.length; i++) {
      if (watchlist[i].symbol) map[watchlist[i].symbol] = watchlist[i];
    }

    // Overlay live prices from btPrices
    if (typeof btPrices !== 'undefined' && btPrices.isLoaded && btPrices.isLoaded()) {
      var syms = Object.keys(map);
      for (var j = 0; j < syms.length; j++) {
        var p = btPrices.get(syms[j]);
        if (p) map[syms[j]].price = p.price;
      }
    }

    var html = '';
    for (var k = 0; k < PAIRS.length; k++) {
      var pair = PAIRS[k];
      var n = map[pair.num], d = map[pair.den];
      if (!n || !d || !n.price || !d.price || !n.sma50 || !d.sma50) {
        html += '<div class="ratio-pill"><span class="name">' + pair.label + '</span><span class="signal neutral">— no data</span></div>';
        continue;
      }

      var ratio = n.price / d.price;
      var sma50Ratio = n.sma50 / d.sma50;
      var pctD = (ratio - sma50Ratio) / sma50Ratio;

      var arrowR, msg, cls;
      if (pctD > PAIR_THRESHOLD) {
        arrowR = '↗'; msg = pair.upMsg; cls = 'up';
      } else if (pctD < -PAIR_THRESHOLD) {
        arrowR = '↘'; msg = pair.downMsg; cls = 'down';
      } else {
        arrowR = '→'; msg = pair.flatMsg; cls = 'neutral';
      }

      html += '<div class="ratio-pill"><span class="name">' + pair.label + '</span><span class="signal ' + cls + '">' + arrowR + ' ' + msg + '</span></div>';
    }
    el.innerHTML = html;
  }

  // === PREFERENCES ===
  function _loadPref() {
    var prefs = BT.preferences.getPref('signals') || {};
    activeStatusFilter = prefs.statusFilter || 'all';
    activeBiasFilters = prefs.biasFilters || { bull:true, mixed:true, bear:true };
    sortMode = prefs.sortMode || 'status';
    searchQuery = prefs.searchQuery || '';
  }

  function _savePref() {
    BT.preferences.setPref('signals', {
      statusFilter: activeStatusFilter,
      biasFilters: activeBiasFilters,
      sortMode: sortMode,
      searchQuery: searchQuery
    });
  }

  // === PAGE LIFECYCLE ===
  function render(el) {
    el.innerHTML =
      '<div id="events-strip" style="display:none"></div>' +
      '<div class="ratios-strip" id="ratios-strip"></div>' +
      '<div class="signals-main">' +
        '<div class="watchlist-panel">' +
          '<div class="status-tabs" id="status-tabs"></div>' +
          '<div class="filter-bar">' +
            '<div class="filter-controls">' +
              '<input type="text" class="filter-search" id="search-input" placeholder="Search ticker...">' +
              '<div class="bias-toggles" id="bias-toggles">' +
                '<button class="bias-toggle on-bull" data-bias="bull">BULL</button>' +
                '<button class="bias-toggle on-mixed" data-bias="mixed">MIXED</button>' +
                '<button class="bias-toggle on-bear" data-bias="bear">BEAR</button>' +
              '</div>' +
              '<select class="sort-select" id="sort-select">' +
                '<option value="status">Sort: Status</option>' +
                '<option value="change-desc">Sort: % Change ↓</option>' +
                '<option value="change-asc">Sort: % Change ↑</option>' +
                '<option value="alpha">Sort: A-Z</option>' +
                '<option value="rsi">Sort: RSI</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div id="cards-container">' +
            Array(6).join('<div class="skeleton skeleton-card" style="height:200px;margin-bottom:8px;"></div>') +
          '</div>' +
        '</div>' +
        '<div class="right-panel">' +
          '<div class="fear-greed-section">' +
            '<h3 id="hdr-signals-fg"><i data-lucide="gauge"></i> Fear & Greed Index</h3>' +
            '<div id="body-signals-fg"><div id="fg-gauge"><div class="skeleton skeleton-gauge"></div></div></div>' +
          '</div>' +
          '<div class="sector-rotation-section">' +
            '<h3 id="hdr-signals-rotation"><i data-lucide="refresh-cw"></i> Sector Rotation</h3>' +
            '<div id="body-signals-rotation">' +
              '<div id="rrg-signals"></div>' +
              '<div id="sector-quadrant"></div>' +
            '</div>' +
          '</div>' +
          '<div class="briefing-panel">' +
            '<h3 id="hdr-signals-regime"><i data-lucide="bar-chart-3"></i> Market Regime</h3>' +
            '<div id="body-signals-regime">' +
              '<div class="regime-card">' +
                '<div class="regime-label">Current Regime</div>' +
                '<div class="regime-value" style="color:var(--red);">⚠ CRISIS</div>' +
                '<div class="regime-desc">Geopolitical conflict driving markets. Extreme fear (F&G 14.7). S&P 28% above linear trendline — mean reversion risk. Dark pool clusters at 6500-6600 put wall. Next 60-100 days critical.</div>' +
              '</div>' +
              '<div class="regime-card">' +
                '<div class="regime-label">Risk Level</div>' +
                '<div class="regime-value" style="color:var(--red);"><i data-lucide="octagon-alert"></i> EXTREME</div>' +
                '<div class="regime-desc">VIX elevated. F&G 14.7 (Extreme Fear). Junk bonds falling, CDS rising. Oracle CDS at GFC levels — AI/tech canary. Bears in control: S&P in lower lows/lower highs.</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="toms-daily">' +
            '<h3 id="hdr-signals-briefing"><i data-lucide="crosshair"></i> Daily Briefing</h3>' +
            '<div id="body-signals-briefing">' +
              '<div class="briefing-text" id="briefing-content">' +
                '<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div><div class="skeleton skeleton-text"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function init() {
    _loadPref();

    // Restore filter UI state
    var searchEl = document.getElementById('search-input');
    if (searchEl && searchQuery) searchEl.value = searchQuery;

    var sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = sortMode;

    // Update bias toggle classes
    var biasToggles = document.querySelectorAll('.bias-toggle');
    for (var bt = 0; bt < biasToggles.length; bt++) {
      var bias = biasToggles[bt].getAttribute('data-bias');
      biasToggles[bt].className = 'bias-toggle ' + (activeBiasFilters[bias] ? 'on-' + bias : 'off');
    }

    // Load data in parallel
    Promise.all([
      typeof btPrices !== 'undefined' ? btPrices.load() : Promise.resolve(),
      fetch('data/watchlist.json').then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
      fetch('data/sector-risk.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(results) {
      var watchlist = results[1];
      var sectorRisk = results[2];
      _sectorRiskData = sectorRisk;

      // Build TICKERS live from watchlist.json (replaces legacy hardcoded array).
      TICKERS = (watchlist || [])
        .map(mapWatchlistToSignal)
        .filter(function(x) { return x !== null; });

      TICKERS.forEach(function(t) {
        t._sectorRisk = _sectorRiskData[t.sector] || null;

        // Overlay live intraday prices (bt-prices.js → prices.json)
        if (typeof btPrices !== 'undefined' && btPrices.isLoaded && btPrices.isLoaded()) {
          var p = btPrices.get(t.symbol);
          if (p) {
            t.price = p.price;
            t.change = p.change;
          }
        }
      });

      if (typeof console !== 'undefined' && TICKERS.length === 0) {
        console.warn('[signals] watchlist.json empty or missing — no cards to render');
      }

      renderStatusTabs();
      renderCards();
      renderPairRatios(watchlist);
    });

    // Render initial UI
    renderStatusTabs();
    renderCards();
    renderSectorRotation();
    renderBriefing();

    // Fear & Greed
    BT.components.fearGreed.fetchAndRender('fg-gauge');

    // RRG
    if (typeof createRRG === 'function') {
      _rrg = createRRG('rrg-signals', {
        trailLength: 8,
        height: '350px',
        showControls: true,
        showRankings: false,
        collapsible: true,
        storageKey: 'rrg-signals-collapsed'
      });
    }

    // Wire collapsible right panel sections
    var rSections = [
      ['signals:fg', 'hdr-signals-fg', 'body-signals-fg'],
      ['signals:rotation', 'hdr-signals-rotation', 'body-signals-rotation'],
      ['signals:regime', 'hdr-signals-regime', 'body-signals-regime'],
      ['signals:briefing', 'hdr-signals-briefing', 'body-signals-briefing']
    ];
    _collapsibles = [];
    rSections.forEach(function(s) {
      var hdr = document.getElementById(s[1]);
      var body = document.getElementById(s[2]);
      if (hdr && body) {
        _collapsibles.push(BT.components.collapsible.init(s[0], hdr, body));
      }
    });

    // Events mini strip
    if (typeof initEventsMiniStrip === 'function') {
      try { initEventsMiniStrip(); } catch(e) {}
    }

    // Bind filter controls
    _boundHandlers.searchInput = function(e) {
      searchQuery = e.target.value.toLowerCase().trim();
      _savePref();
      renderCards();
    };
    var si = document.getElementById('search-input');
    if (si) si.addEventListener('input', _boundHandlers.searchInput);

    _boundHandlers.sortChange = function(e) {
      sortMode = e.target.value;
      _savePref();
      renderCards();
    };
    var ss = document.getElementById('sort-select');
    if (ss) ss.addEventListener('change', _boundHandlers.sortChange);

    // Bias toggles
    var btns = document.querySelectorAll('.bias-toggle');
    _boundHandlers.biasClicks = [];
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        var handler = function() {
          var b = btn.getAttribute('data-bias');
          activeBiasFilters[b] = !activeBiasFilters[b];
          btn.className = 'bias-toggle ' + (activeBiasFilters[b] ? 'on-' + b : 'off');
          _savePref();
          renderCards();
        };
        btn.addEventListener('click', handler);
        _boundHandlers.biasClicks.push({ el: btn, handler: handler });
      })(btns[i]);
    }
  }

  function destroy() {
    // Clean up collapsibles
    _collapsibles.forEach(function(c) { if (c && c.destroy) c.destroy(); });
    _collapsibles = [];

    // Clean up detail modal
    if (BT.components.detailModal) BT.components.detailModal.destroy();

    // Remove event listeners
    var si = document.getElementById('search-input');
    if (si && _boundHandlers.searchInput) si.removeEventListener('input', _boundHandlers.searchInput);
    var ss = document.getElementById('sort-select');
    if (ss && _boundHandlers.sortChange) ss.removeEventListener('change', _boundHandlers.sortChange);
    if (_boundHandlers.biasClicks) {
      _boundHandlers.biasClicks.forEach(function(bc) {
        bc.el.removeEventListener('click', bc.handler);
      });
    }
    _boundHandlers = {};

    // Clean up RRG
    _rrg = null;
  }

  BT.pages.signals = {
    render: render,
    init: init,
    destroy: destroy,
    // Exposed for testing / debugging:
    _mapWatchlistToSignal: mapWatchlistToSignal,
    _buildStatusReason: buildStatusReason,
    _biasTip: biasTip
  };
})();
