/**
 * pages/week-ahead.js — Week Ahead page module for BreakingTrades v2
 *
 * Renders:
 *   1. Tom's Sunday-night brief (data/week-ahead.json) as the hero
 *   2. Hot Days strip (per-day intensity bar)
 *   3. Catalysts grid — 4 columns: Macro/Fed, Earnings, IPOs, Geopolitical
 *   4. Index expected moves with breach annotations
 *
 * Data:
 *   - data/weekly-catalysts.json (orchestrator output)
 *   - data/week-ahead.json (Tom's narrative; optional — page renders without it)
 *
 * Registers as BT.pages['week-ahead'] with render(), init(), destroy().
 */
(function() {
  'use strict';

  var _countdownInterval = null;

  var SEVERITY_COLORS = {
    critical: '#ef5350',
    high: '#ffa726',
    medium: '#ffd700',
    low: '#64748b'
  };

  var CAT_META = {
    macro:        { icon: 'bar-chart-3', label: 'Macro',        color: '#ffa726' },
    fed:          { icon: 'landmark',    label: 'Fed',          color: '#ab47bc' },
    earnings:     { icon: 'dollar-sign', label: 'Earnings',     color: '#26a69a' },
    ipo:          { icon: 'rocket',      label: 'IPOs',         color: '#42a5f5' },
    geopolitical: { icon: 'globe',       label: 'Geopolitical', color: '#ef5350' }
  };

  function fmtCountdown(deadlineISO) {
    var dl = new Date(deadlineISO).getTime();
    var now = Date.now();
    var diff = dl - now;
    if (diff <= 0) return 'PASSED';
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    return m + 'm ' + s + 's';
  }

  function fmtDeadline(deadlineISO) {
    try {
      var d = new Date(deadlineISO);
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (e) { return deadlineISO; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(el) {
    el.innerHTML =
      '<div class="page-content week-ahead-page" style="max-width:1500px;margin:0 auto;padding:16px;">' +
        '<div class="wa-header">' +
          '<div>' +
            '<h2 class="wa-title"><i data-lucide="calendar-clock"></i> Week Ahead</h2>' +
            '<div class="wa-subtitle" id="wa-subtitle">Loading…</div>' +
          '</div>' +
          '<div class="wa-stats" id="wa-stats"></div>' +
        '</div>' +

        // Tom brief hero
        '<section class="wa-brief" id="wa-brief">' +
          '<div class="skeleton skeleton-card" style="height:220px;"></div>' +
        '</section>' +

        // Hot days strip
        '<section class="wa-section">' +
          '<h3 class="wa-section-title"><i data-lucide="flame"></i> Hot Days</h3>' +
          '<div class="wa-hotdays" id="wa-hotdays">' +
            '<div class="skeleton skeleton-card" style="height:80px;"></div>' +
          '</div>' +
        '</section>' +

        // Catalyst grid
        '<section class="wa-section">' +
          '<h3 class="wa-section-title"><i data-lucide="layers"></i> Catalysts</h3>' +
          '<div class="wa-grid" id="wa-grid">' +
            '<div class="skeleton skeleton-card" style="height:200px;"></div>' +
            '<div class="skeleton skeleton-card" style="height:200px;"></div>' +
            '<div class="skeleton skeleton-card" style="height:200px;"></div>' +
            '<div class="skeleton skeleton-card" style="height:200px;"></div>' +
          '</div>' +
        '</section>' +

        // Index EMs
        '<section class="wa-section">' +
          '<h3 class="wa-section-title"><i data-lucide="bar-chart-2"></i> Index & Sector Expected Moves</h3>' +
          '<div class="wa-emoves" id="wa-emoves">' +
            '<div class="skeleton skeleton-card" style="height:120px;"></div>' +
          '</div>' +
        '</section>' +

        // Recent IPO performance — regime tell for upcoming IPOs
        '<section class="wa-section">' +
          '<h3 class="wa-section-title"><i data-lucide="rocket"></i> Recent IPO Performance <span class="wa-section-sub">(regime tell)</span></h3>' +
          '<div class="wa-ipo-tracker" id="wa-ipo-tracker">' +
            '<div class="skeleton skeleton-card" style="height:140px;"></div>' +
          '</div>' +
        '</section>' +

        // Footer attribution
        '<div class="wa-footer" id="wa-footer"></div>' +
      '</div>';
  }

  function init() {
    loadAndRender();
    _countdownInterval = setInterval(updateCountdowns, 1000);
  }

  function destroy() {
    if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
  }

  function loadAndRender() {
    Promise.all([
      fetch('data/weekly-catalysts.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch('data/week-ahead.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ]).then(function(results) {
      var catalysts = results[0];
      var brief = results[1];

      if (!catalysts) {
        document.getElementById('wa-brief').innerHTML =
          '<div class="wa-empty">No <code>weekly-catalysts.json</code> found. ' +
          'Run <code>python3 scripts/weekly-catalyst-scan.py</code>.</div>';
        document.getElementById('wa-subtitle').textContent = 'Data unavailable';
        return;
      }

      renderHeader(catalysts);
      renderBrief(brief, catalysts);
      renderHotDays(catalysts);
      renderCatalystGrid(catalysts);
      renderEMoves(catalysts);
      renderIpoTracker(catalysts);
      renderFooter(catalysts, brief);

      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    });
  }

  function renderHeader(c) {
    var weekOf = new Date(c.week_of + 'T00:00:00');
    var weekEnd = new Date(weekOf.getTime() + 4 * 86400000); // Mon..Fri
    var fmt = function(d) { return d.toLocaleString('en-US', { month: 'short', day: 'numeric' }); };
    document.getElementById('wa-subtitle').textContent =
      'Week of ' + fmt(weekOf) + ' – ' + fmt(weekEnd) + ' · scanned ' + new Date(c.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    var bc = (c.summary && c.summary.by_category) || {};
    var stats = document.getElementById('wa-stats');
    var pieces = [
      { k: 'macro', v: bc.macro || 0 },
      { k: 'fed', v: bc.fed || 0 },
      { k: 'earnings', v: bc.earnings || 0 },
      { k: 'ipo', v: bc.ipo || 0 },
      { k: 'geopolitical', v: bc.geopolitical || 0 }
    ];
    stats.innerHTML = pieces.map(function(p) {
      var meta = CAT_META[p.k];
      return '<div class="wa-stat-pill" style="--c:' + meta.color + ';">' +
        '<i data-lucide="' + meta.icon + '"></i>' +
        '<span class="wa-stat-n">' + p.v + '</span>' +
        '<span class="wa-stat-l">' + meta.label + '</span>' +
        '</div>';
    }).join('');
  }

  function renderBrief(brief, catalysts) {
    var el = document.getElementById('wa-brief');
    if (!brief || !brief.headline) {
      var hottest = catalysts.summary && catalysts.summary.hottest_day;
      el.innerHTML =
        '<div class="wa-brief-fallback">' +
          '<div class="wa-brief-label"><i data-lucide="info"></i> No Tom brief generated yet</div>' +
          '<div class="wa-brief-fallback-body">' +
            (hottest ? '<strong>Hottest day:</strong> ' + hottest.date + ' — ' + hottest.event_count + ' events.<br>' : '') +
            'Run <code>python3 scripts/generate-week-ahead-brief.py</code> to populate.' +
          '</div>' +
        '</div>';
      return;
    }
    var thesis = (brief.thesis || []).map(function(t) {
      return '<li>' + escapeHtml(t) + '</li>';
    }).join('');
    var hotDays = (brief.hot_days || []).map(function(h) {
      return '<div class="wa-brief-hotday">' +
        '<div class="wa-hotday-date">' + escapeHtml(h.weekday || '') + ' ' + escapeHtml(h.date) + '</div>' +
        '<div class="wa-hotday-reason">' + escapeHtml(h.reason || '') + '</div>' +
        '</div>';
    }).join('');
    var rules = (brief.rule_triggers || []).map(function(r) {
      return '<div class="wa-rule">' + escapeHtml(r) + '</div>';
    }).join('');
    var watching = brief.what_im_watching || {};
    var tickers = (watching.tickers || []).map(function(t) {
      return '<span class="wa-ticker">' + escapeHtml(t) + '</span>';
    }).join(' ');
    el.innerHTML =
      '<div class="wa-brief-card">' +
        '<div class="wa-brief-label"><i data-lucide="message-square-quote"></i> Tom\u2019s Read &mdash; Sunday Night</div>' +
        '<h3 class="wa-brief-title">' + escapeHtml(brief.title || 'Week Ahead') + '</h3>' +
        '<p class="wa-brief-headline">' + escapeHtml(brief.headline || '') + '</p>' +
        (thesis ? '<ul class="wa-brief-thesis">' + thesis + '</ul>' : '') +
        (hotDays ? '<div class="wa-brief-hotdays">' + hotDays + '</div>' : '') +
        (rules ? '<div class="wa-brief-rules"><div class="wa-brief-sublabel">Rule Triggers</div>' + rules + '</div>' : '') +
        (tickers ? '<div class="wa-brief-watching"><div class="wa-brief-sublabel">Watching</div>' + tickers + (watching.levels ? '<div class="wa-brief-levels">' + escapeHtml(watching.levels) + '</div>' : '') + '</div>' : '') +
        (brief.what_im_skipping ? '<div class="wa-brief-skipping"><strong>Skipping:</strong> ' + escapeHtml(brief.what_im_skipping) + '</div>' : '') +
        (brief.closing_quote ? '<blockquote class="wa-brief-quote">&ldquo;' + escapeHtml(brief.closing_quote) + '&rdquo;</blockquote>' : '') +
      '</div>';
  }

  function renderHotDays(c) {
    var perDay = (c.summary && c.summary.per_day) || [];
    var el = document.getElementById('wa-hotdays');
    if (!perDay.length) {
      el.innerHTML = '<div class="wa-empty">No catalysts in window.</div>';
      return;
    }
    var maxCount = perDay.reduce(function(m, d) { return Math.max(m, d.event_count); }, 1);
    el.innerHTML = perDay.map(function(d) {
      var heightPct = Math.round((d.event_count / maxCount) * 100);
      var sevColor = SEVERITY_COLORS[d.max_severity] || SEVERITY_COLORS.medium;
      var headlines = (d.headline_events || []).map(function(h) {
        return escapeHtml(h.title);
      }).join('<br>');
      var badges = Object.keys(d.by_category).map(function(k) {
        var meta = CAT_META[k] || { color: '#888' };
        return '<span class="wa-hotday-cat" style="background:' + meta.color + '20;color:' + meta.color + '">' +
          d.by_category[k] + ' ' + (meta.label || k) +
          '</span>';
      }).join(' ');
      return '<div class="wa-hotday-card" title="' + escapeHtml(headlines.replace(/<br>/g, ' \u2022 ')) + '">' +
        '<div class="wa-hotday-bar"><div class="wa-hotday-fill" style="height:' + heightPct + '%;background:' + sevColor + ';"></div></div>' +
        '<div class="wa-hotday-meta">' +
          '<div class="wa-hotday-day">' + escapeHtml(d.weekday) + '</div>' +
          '<div class="wa-hotday-date">' + escapeHtml(d.date.slice(5)) + '</div>' +
          '<div class="wa-hotday-count">' + d.event_count + ' events</div>' +
          '<div class="wa-hotday-badges">' + badges + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderCatalystGrid(c) {
    var cats = c.categories || {};
    var grid = document.getElementById('wa-grid');
    var columns = [
      { key: 'macro_fed', label: 'Macro & Fed', icon: 'bar-chart-3', items: (cats.fed || []).concat(cats.macro || []) },
      { key: 'earnings',  label: 'Earnings',    icon: 'dollar-sign', items: cats.earnings || [] },
      { key: 'ipo',       label: 'IPOs',        icon: 'rocket',      items: cats.ipo || [] },
      { key: 'geopolitical', label: 'Geopolitical', icon: 'globe',   items: cats.geopolitical || [] }
    ];
    grid.innerHTML = columns.map(function(col) {
      var items = col.items.slice().sort(function(a, b) {
        return (a.deadline || '') < (b.deadline || '') ? -1 : 1;
      });
      var cards = items.length
        ? items.map(renderEventCard).join('')
        : '<div class="wa-col-empty">No catalysts this week.</div>';
      return '<div class="wa-col">' +
        '<div class="wa-col-head"><i data-lucide="' + col.icon + '"></i> ' + col.label +
        '<span class="wa-col-count">' + items.length + '</span></div>' +
        '<div class="wa-col-body">' + cards + '</div>' +
      '</div>';
    }).join('');
  }

  function renderEventCard(e) {
    var sev = e.severity || 'medium';
    var color = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;
    var meta = CAT_META[e.category] || CAT_META.macro;
    var tickers = (e.tickers || []).slice(0, 6).map(function(t) {
      return '<span class="wa-card-tk">' + escapeHtml(t) + '</span>';
    }).join('');
    var extraBits = [];
    var ex = e.extra || {};
    if (ex.forecast) extraBits.push('fc <strong>' + escapeHtml(ex.forecast) + '</strong>');
    if (ex.previous) extraBits.push('prev ' + escapeHtml(ex.previous));
    if (ex.market_cap_b) extraBits.push('$' + Number(ex.market_cap_b).toFixed(1) + 'B');
    if (ex.bmo_amc) extraBits.push(escapeHtml(ex.bmo_amc));
    if (ex.eps_forecast && ex.eps_forecast !== '--') extraBits.push('EPS fc ' + escapeHtml(ex.eps_forecast));
    if (ex.press_conference) extraBits.push('Press Conf');
    var extraLine = extraBits.length ? '<div class="wa-card-extra">' + extraBits.join(' \u00b7 ') + '</div>' : '';

    var countdown = e.deadline ? '<span class="wa-card-countdown" data-deadline="' + escapeHtml(e.deadline) + '">' + fmtCountdown(e.deadline) + '</span>' : '';

    return '<div class="wa-card" style="border-left-color:' + color + ';">' +
      '<div class="wa-card-top">' +
        '<span class="wa-card-sev" style="background:' + color + '20;color:' + color + '">' +
          '<i data-lucide="' + meta.icon + '"></i> ' + sev.toUpperCase() +
        '</span>' +
        countdown +
      '</div>' +
      '<div class="wa-card-title">' + escapeHtml(e.title) + '</div>' +
      (e.context ? '<div class="wa-card-context">' + escapeHtml(e.context) + '</div>' : '') +
      extraLine +
      (tickers ? '<div class="wa-card-tickers">' + tickers + '</div>' : '') +
      (e.deadline ? '<div class="wa-card-deadline">' + fmtDeadline(e.deadline) + '</div>' : '') +
    '</div>';
  }

  function renderEMoves(c) {
    var em = c.index_expected_moves || {};
    var el = document.getElementById('wa-emoves');
    var symbols = Object.keys(em);
    if (!symbols.length) {
      el.innerHTML = '<div class="wa-empty">No expected moves data.</div>';
      return;
    }
    el.innerHTML = '<div class="wa-em-grid">' + symbols.map(function(sym) {
      var d = em[sym];
      var spot = d.spot, lo = d.lower, hi = d.upper, pct = d.pct;
      if (!spot || !lo || !hi) {
        return '<div class="wa-em-card"><div class="wa-em-sym">' + escapeHtml(sym) + '</div><div class="wa-em-empty">no data</div></div>';
      }
      var range = hi - lo;
      var pos = ((spot - lo) / range) * 100;
      var posClamped = Math.max(0, Math.min(100, pos));
      var statusLabel = '', statusColor = '#26a69a';
      if (pos < 0) { statusLabel = 'BREACH DOWN'; statusColor = '#26a69a'; }
      else if (pos > 100) { statusLabel = 'BREACH UP'; statusColor = '#ef5350'; }
      else if (pos < 25) { statusLabel = 'BUY ZONE'; statusColor = '#26a69a'; }
      else if (pos > 75) { statusLabel = 'EXTENDED'; statusColor = '#ffa726'; }
      else { statusLabel = 'MID'; statusColor = '#64748b'; }
      return '<div class="wa-em-card">' +
        '<div class="wa-em-head">' +
          '<span class="wa-em-sym">' + escapeHtml(sym) + '</span>' +
          '<span class="wa-em-pct">\u00b1' + Number(pct).toFixed(2) + '%</span>' +
        '</div>' +
        '<div class="wa-em-range">' +
          '<span class="wa-em-lo">$' + Number(lo).toFixed(2) + '</span>' +
          '<div class="wa-em-track">' +
            '<div class="wa-em-marker" style="left:' + posClamped + '%;"></div>' +
          '</div>' +
          '<span class="wa-em-hi">$' + Number(hi).toFixed(2) + '</span>' +
        '</div>' +
        '<div class="wa-em-status" style="color:' + statusColor + ';">' +
          '<strong>$' + Number(spot).toFixed(2) + '</strong> &bull; ' + statusLabel +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderIpoTracker(c) {
    var el = document.getElementById('wa-ipo-tracker');
    if (!el) return;
    var regime = c.ipo_regime || null;
    var ipos = c.recent_ipos || [];

    if (!ipos.length && !regime) {
      el.innerHTML = '<div class="wa-empty">No recent IPO data. Run <code>python3 scripts/track-ipo-performance.py</code>.</div>';
      return;
    }

    // Regime banner — exhaustion / mixed / robust
    var regimeColor = '#64748b';
    var regimeIcon = 'minus';
    if (regime) {
      if (regime.signal === 'exhaustion') { regimeColor = '#ef5350'; regimeIcon = 'trending-down'; }
      else if (regime.signal === 'robust') { regimeColor = '#26a69a'; regimeIcon = 'trending-up'; }
      else if (regime.signal === 'mixed') { regimeColor = '#ffa726'; regimeIcon = 'activity'; }
    }
    var regimeBanner = regime ? (
      '<div class="wa-ipo-regime" style="border-color:' + regimeColor + ';">' +
        '<div class="wa-ipo-regime-head">' +
          '<i data-lucide="' + regimeIcon + '" style="color:' + regimeColor + ';"></i>' +
          '<span class="wa-ipo-regime-label" style="color:' + regimeColor + ';">' +
            'Regime: ' + escapeHtml(String(regime.signal || 'unknown').toUpperCase()) +
          '</span>' +
          '<span class="wa-ipo-regime-stats">' +
            (regime.ipos_tracked || 0) + ' tracked &middot; ' +
            (regime.broke_ipo_price_count || 0) + ' broke IPO (' +
            (regime.broke_ipo_price_pct != null ? Number(regime.broke_ipo_price_pct).toFixed(0) : '?') + '%) &middot; ' +
            'avg ' + (regime.avg_return_from_ipo_pct != null ? (regime.avg_return_from_ipo_pct >= 0 ? '+' : '') + Number(regime.avg_return_from_ipo_pct).toFixed(1) + '%' : 'n/a') +
          '</span>' +
        '</div>' +
        '<div class="wa-ipo-regime-interp">' + escapeHtml(regime.interpretation || '') + '</div>' +
      '</div>'
    ) : '';

    // Status tag → color + label
    var TAG_META = {
      'blowout-pop':       { color: '#26a69a', label: 'BLOWOUT' },
      'solid-pop':         { color: '#26a69a', label: 'POP' },
      'pop-and-hold':      { color: '#26a69a', label: 'POP+HOLD' },
      'holding-IPO':       { color: '#a5d6a7', label: 'HOLDING' },
      'flat-debut':        { color: '#64748b', label: 'FLAT' },
      'pop-and-fade':      { color: '#ffa726', label: 'POP+FADE' },
      'below-IPO':         { color: '#ef5350', label: 'BELOW IPO' },
      'sub-IPO-fade':      { color: '#ef5350', label: 'SUB-IPO FADE' },
      'broken-ipo-day-1':  { color: '#ef5350', label: 'BROKE DAY 1' },
      'crashed':           { color: '#b71c1c', label: 'CRASHED' },
      'unknown':           { color: '#64748b', label: '—' }
    };

    var cards = ipos.map(function(rec) {
      var m = rec.metrics || null;
      if (!m) {
        return '<div class="wa-ipo-card wa-ipo-card-error">' +
          '<div class="wa-ipo-sym">' + escapeHtml(rec.symbol || '?') + '</div>' +
          '<div class="wa-ipo-name">' + escapeHtml(rec.name || '') + '</div>' +
          '<div class="wa-ipo-err">no data (' + escapeHtml(rec.error || '') + ')</div>' +
        '</div>';
      }
      var tag = TAG_META[m.status_tag] || TAG_META.unknown;
      var lastPct = m.return_from_ipo_pct;
      var lastPctClass = lastPct == null ? '' : (lastPct >= 0 ? 'pos' : 'neg');
      var d1HighPct = m.day1_high_pct;
      var d1HighClass = d1HighPct == null ? '' : (d1HighPct >= 0 ? 'pos' : 'neg');
      var dropFromHigh = m.return_from_d1_high_pct;
      var dropClass = dropFromHigh == null ? '' : (dropFromHigh >= 0 ? 'pos' : 'neg');
      var brokeBadge = m.broke_ipo_price
        ? '<span class="wa-ipo-broke" title="Closed below IPO price on a post-debut session">BROKE</span>'
        : '';
      var volCollapseStr = '';
      if (m.volume_collapse_pct != null && m.volume_d1) {
        var sign = m.volume_collapse_pct >= 0 ? '+' : '';
        volCollapseStr = '<div class="wa-ipo-vol">vol ' + sign + Number(m.volume_collapse_pct).toFixed(0) + '% vs d1</div>';
      }
      return '<div class="wa-ipo-card">' +
        '<div class="wa-ipo-card-head">' +
          '<div>' +
            '<div class="wa-ipo-sym">' + escapeHtml(rec.symbol) + '</div>' +
            '<div class="wa-ipo-name">' + escapeHtml(rec.name || '') + '</div>' +
          '</div>' +
          '<div class="wa-ipo-tag-wrap">' +
            '<span class="wa-ipo-tag" style="background:' + tag.color + '22;color:' + tag.color + ';border-color:' + tag.color + ';">' +
              escapeHtml(tag.label) +
            '</span>' +
            brokeBadge +
          '</div>' +
        '</div>' +
        '<div class="wa-ipo-meta">' +
          '<span>' + escapeHtml(rec.ipo_date) + ' &middot; $' + Number(rec.ipo_price).toFixed(2) + ' IPO &middot; ' +
          m.days_since_ipo + 'd ago</span>' +
        '</div>' +
        '<div class="wa-ipo-stats">' +
          '<div class="wa-ipo-stat">' +
            '<div class="wa-ipo-stat-label">Day-1 high</div>' +
            '<div class="wa-ipo-stat-val ' + d1HighClass + '">' +
              (d1HighPct != null ? (d1HighPct >= 0 ? '+' : '') + Number(d1HighPct).toFixed(1) + '%' : '—') +
            '</div>' +
          '</div>' +
          '<div class="wa-ipo-stat">' +
            '<div class="wa-ipo-stat-label">Now vs IPO</div>' +
            '<div class="wa-ipo-stat-val ' + lastPctClass + '">' +
              (lastPct != null ? (lastPct >= 0 ? '+' : '') + Number(lastPct).toFixed(1) + '%' : '—') +
            '</div>' +
          '</div>' +
          '<div class="wa-ipo-stat">' +
            '<div class="wa-ipo-stat-label">From d1 high</div>' +
            '<div class="wa-ipo-stat-val ' + dropClass + '">' +
              (dropFromHigh != null ? (dropFromHigh >= 0 ? '+' : '') + Number(dropFromHigh).toFixed(1) + '%' : '—') +
            '</div>' +
          '</div>' +
        '</div>' +
        (rec.category ? '<div class="wa-ipo-cat">' + escapeHtml(rec.category) + '</div>' : '') +
        volCollapseStr +
      '</div>';
    }).join('');

    el.innerHTML = regimeBanner + '<div class="wa-ipo-grid">' + cards + '</div>';
  }

  function renderFooter(catalysts, brief) {
    var producers = catalysts.producers || [];
    var bits = producers.map(function(p) {
      return '<span class="wa-footer-prod' + (p.ok ? '' : ' fail') + '">' +
        (p.ok ? '\u2713' : '\u2717') + ' ' + escapeHtml(p.name) +
      '</span>';
    }).join('');
    var briefMeta = brief && brief.generatedAt
      ? ' &bull; brief ' + new Date(brief.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' (' + (brief.model || '?') + ')'
      : '';
    document.getElementById('wa-footer').innerHTML =
      'Producers: ' + (bits || '—') + briefMeta;
  }

  function updateCountdowns() {
    var els = document.querySelectorAll('[data-deadline]');
    els.forEach(function(el) {
      var dl = el.getAttribute('data-deadline');
      if (dl) el.textContent = fmtCountdown(dl);
    });
  }

  // Register
  if (typeof BT !== 'undefined') {
    BT.pages = BT.pages || {};
    BT.pages['week-ahead'] = { render: render, init: init, destroy: destroy };
  }
})();
