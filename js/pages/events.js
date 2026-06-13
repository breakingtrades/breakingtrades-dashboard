/**
 * pages/events.js — Events & Calendar page module for BreakingTrades v2
 * Registers as BT.pages.events with render(), init(), destroy()
 */
(function() {
  'use strict';

  var _countdownInterval = null;
  var _refreshInterval = null;

  var SEVERITY_COLORS = {
    critical: '#ef5350',
    high: '#ffa726',
    medium: '#ffd700',
    low: '#64748b'
  };

  var CAT_BADGES = {
    geopolitical: '<i data-lucide="globe"></i>',
    macro: '<i data-lucide="bar-chart-3"></i>',
    fed: '<i data-lucide="landmark"></i>',
    earnings: '<i data-lucide="dollar-sign"></i>',
    technical: '<i data-lucide="trending-up"></i>',
    analyst_flag: '<i data-lucide="search"></i>'
  };

  var CAT_LABELS = {
    geopolitical: 'Geo',
    macro: 'Macro',
    fed: 'Fed',
    earnings: 'Earnings',
    technical: 'Technical',
    analyst_flag: 'Intel'
  };

  function render(el) {
    el.innerHTML =
      '<div class="page-content" style="max-width:1400px;margin:0 auto;">' +
        '<div class="events-page-header">' +
          '<span class="events-page-title"><i data-lucide="calendar"></i> Events & Calendar</span>' +
        '</div>' +
        '<div class="events-filter-tabs" id="events-filter-tabs"></div>' +
        '<div class="events-grid">' +
          '<div>' +
            '<h3 class="events-col-title"><i data-lucide="timer"></i> Live Countdowns</h3>' +
            '<div id="events-live-countdowns">' +
              '<div class="skeleton skeleton-card" style="height:100px;margin-bottom:8px;"></div>' +
              '<div class="skeleton skeleton-card" style="height:100px;margin-bottom:8px;"></div>' +
              '<div class="skeleton skeleton-card" style="height:100px;"></div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<h3 class="events-col-title"><i data-lucide="calendar-days"></i> Upcoming — Next 7 Days</h3>' +
            '<div id="events-upcoming">' +
              '<div class="skeleton skeleton-card" style="height:100px;margin-bottom:8px;"></div>' +
              '<div class="skeleton skeleton-card" style="height:100px;margin-bottom:8px;"></div>' +
              '<div class="skeleton skeleton-card" style="height:100px;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="events-analyst-intel"></div>' +
        '<details id="events-resolved-section" style="margin-top:20px;">' +
          '<summary>Resolved & Expired (last 7 days)</summary>' +
          '<div id="events-resolved"></div>' +
        '</details>' +
      '</div>';
  }

  function init() {
    loadAndRender();
    _refreshInterval = setInterval(loadAndRender, 60000);
  }

  function destroy() {
    if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
    if (_refreshInterval) { clearInterval(_refreshInterval); _refreshInterval = null; }
  }

  function loadEvents() {
    return Promise.all([
      fetch('data/events.jsonl').then(function(r) { return r.text(); }),
      fetch('data/market-hours.json').then(function(r) { return r.json(); }).catch(function() { return null; }),
      fetch('data/economic-calendar.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch('data/watchlist.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; }),
      fetch('data/fomc-calendar.json').then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; })
    ]).then(function(results) {
      var text = results[0];
      var mh = results[1];
      var econ = results[2];
      var wl = results[3];
      var fomc = results[4];
      var events = text.trim().split('\n')
        .filter(function(l) { return l.trim() && !l.startsWith('#'); })
        .map(function(l) { return JSON.parse(l); });

      // Inject US 3-star economic calendar events (Investing.com), max 3 upcoming
      if (econ && Array.isArray(econ.events)) {
        econ.events.forEach(function(e) {
          events.push({
            id: e.id,
            title: e.title + (e.forecast ? ' — fc ' + e.forecast + (e.previous ? ' / prev ' + e.previous : '') : (e.previous ? ' — prev ' + e.previous : '')),
            category: 'macro',
            severity: e.severity || 'high',
            status: 'active',
            deadline: e.deadline,
            created: econ.fetched_at || new Date().toISOString(),
            countdown: true,
            market_impact: 'US 3-star economic data release. High-volatility window for SPY, QQQ, TLT, DXY, GLD.',
            tickers: ['SPY','QQQ','TLT','DXY','GLD'],
            notes: '★★★ from Investing.com economic calendar' + (e.forecast ? ' · forecast: ' + e.forecast : '') + (e.previous ? ' · previous: ' + e.previous : ''),
            _econ: true
          });
        });
      }

      // Inject FOMC meetings + Powell press conferences (federalreserve.gov).
      // FOMC rate decisions are the single highest-impact macro events on the
      // calendar — ±2-3% SPX moves are common in the 30 minutes after the
      // statement drops. We inject the next 3 upcoming meetings + Fed speeches
      // happening within the next 14 days.
      if (fomc) {
        var now = Date.now();
        var horizon14 = now + 14 * 86400000;
        var horizon90 = now + 90 * 86400000;

        // Meetings (rate decisions)
        (fomc.upcoming_meetings || []).forEach(function(m) {
          if (!m.datetime_utc) return;
          var ms = new Date(m.datetime_utc).getTime();
          if (isNaN(ms) || ms < now || ms > horizon90) return;
          var daysUntil = Math.round((ms - now) / 86400000);
          // Critical if within 7 days, high if within 30
          var sev = daysUntil <= 7 ? 'critical' : (daysUntil <= 30 ? 'high' : 'medium');
          var pressLabel = m.press_conference ? ' + Press Conference' : '';
          events.push({
            id: 'fomc-' + m.year + '-' + m.month + '-' + m.day,
            title: 'FOMC Rate Decision' + pressLabel,
            category: 'fed',
            severity: sev,
            status: 'active',
            deadline: m.datetime_utc,
            created: fomc.fetched_at || new Date().toISOString(),
            countdown: daysUntil <= 14,
            market_impact: 'Federal Reserve interest-rate decision' +
              (m.press_conference ? ' followed by Chair Powell press conference (30min after).' : '.') +
              ' Highest single-event vol catalyst on the calendar — typical SPX move ±1.5–3% in the 30 minutes after the 2pm ET statement.',
            tickers: ['SPY','QQQ','IWM','TLT','DXY','GLD','XLF'],
            notes: 'Source: federalreserve.gov · ' + daysUntil + 'd away' +
              (m.press_conference ? ' · press conference scheduled' : ' · no press conference'),
            _fomc: true
          });
        });

        // Speeches (within next 14 days only)
        (fomc.events || []).forEach(function(ev) {
          if (!ev.datetime_utc && !ev.date) return;
          var dtStr = ev.datetime_utc || (ev.date + 'T17:00:00Z');
          var ms = new Date(dtStr).getTime();
          if (isNaN(ms) || ms < now || ms > horizon14) return;
          var speaker = ev.speaker || ev.title || 'Fed speaker';
          var isPowell = /powell/i.test(speaker);
          var daysUntil = Math.round((ms - now) / 86400000);
          events.push({
            id: 'fed-speech-' + (ev.id || (ev.speaker_slug || 'unknown') + '-' + dtStr),
            title: 'Fed Speech — ' + speaker,
            category: 'fed',
            severity: isPowell ? 'high' : 'medium',
            status: 'active',
            deadline: dtStr,
            created: fomc.fetched_at || new Date().toISOString(),
            countdown: daysUntil <= 7,
            market_impact: 'Federal Reserve official remarks — watch for rate-path / inflation language. ' +
              (isPowell ? 'Chair Powell speeches move markets directly.' : 'Voting members can shift expectations at the margin.'),
            tickers: ['SPY','QQQ','TLT','DXY'],
            notes: 'Source: federalreserve.gov' + (ev.url ? ' · ' + ev.url : ''),
            _fed_speech: true
          });
        });

        // Recent speeches (last 7 days) — keep them visible for context with status='past'
        (fomc.recent_speeches || []).forEach(function(sp) {
          if (!sp.date) return;
          var ms = new Date(sp.date + 'T17:00:00Z').getTime();
          if (isNaN(ms) || ms > now || ms < now - 7 * 86400000) return;
          events.push({
            id: 'fed-recent-' + sp.speaker_slug + '-' + sp.date,
            title: sp.title || ('Fed: ' + (sp.speaker_slug || '')),
            category: 'fed',
            severity: 'low',
            status: 'past',
            deadline: sp.date + 'T17:00:00Z',
            created: sp.date + 'T17:00:00Z',
            countdown: false,
            market_impact: 'Recent Fed remarks — context for the current rate-path narrative.',
            tickers: [],
            notes: 'Source: federalreserve.gov' + (sp.url ? ' · ' + sp.url : ''),
            _fed_recent: true
          });
        });
      }

      // Inject upcoming earnings from watchlist.json (next 30 days).
      // Source of truth: watchlist[].earningsDate (set by export-yfinance-fallback.py).
      // Days-until is recomputed live so the badge stays current between exports.
      if (wl && Array.isArray(wl)) {
        var nowMs = Date.now();
        var horizon = nowMs + 30 * 86400000;
        var todayUTC = (function(){ var d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
        wl.forEach(function(t) {
          if (!t.earningsDate) return;
          var parts = String(t.earningsDate).split('-');
          if (parts.length !== 3) return;
          var earnUTC = Date.UTC(parseInt(parts[0],10), parseInt(parts[1],10) - 1, parseInt(parts[2],10));
          if (isNaN(earnUTC)) return;
          // Skip past earnings (cleaner than showing as "passed")
          if (earnUTC < todayUTC) return;
          if (earnUTC > horizon) return;
          var daysUntil = Math.round((earnUTC - todayUTC) / 86400000);
          // Severity tiering: critical for mega caps within a week, high <=14d, medium otherwise
          var MEGA_CAP = ['NVDA','AAPL','MSFT','META','GOOGL','GOOG','AMZN','TSLA','SPY','QQQ'];
          var isMega = MEGA_CAP.indexOf(t.symbol) !== -1;
          var sev = (isMega && daysUntil <= 7) ? 'critical' : (daysUntil <= 7 ? 'high' : (daysUntil <= 14 ? 'high' : 'medium'));
          // Earnings hit the tape after market close → use 4:00 PM ET that day.
          // (We don't know AMC vs BMO without a separate field, but post-close is
          // the conservative default since most reports drop AMC.)
          var deadlineISO = t.earningsDate + 'T16:00:00-04:00';
          events.push({
            id: 'earnings-' + t.symbol + '-' + t.earningsDate,
            title: t.symbol + ' Earnings' + (t.name ? ' — ' + t.name : ''),
            category: 'earnings',
            severity: sev,
            status: 'active',
            deadline: deadlineISO,
            created: new Date().toISOString(),
            countdown: daysUntil <= 14,  // show in Live Countdowns when ≤14d
            market_impact: 'Quarterly earnings release for ' + t.symbol +
              (t.sector ? ' (' + t.sector + ')' : '') +
              '. Implied move from options: see Expected Moves page.',
            tickers: [t.symbol],
            notes: 'Live from watchlist.json · ' + daysUntil + ' day' + (daysUntil === 1 ? '' : 's') + ' away',
            _earnings: true
          });
        });
      }


      // Inject NYSE holidays/early-closes as events (next 30 days)
      if (mh) {
        var now = Date.now();
        var cutoff = now + 30 * 86400000;
        var years = Object.keys(mh.holidays || {});
        years.forEach(function(yr) {
          (mh.holidays[yr] || []).forEach(function(h) {
            var d = new Date(h.date + 'T16:00:00').getTime();
            if (d > now && d < cutoff) {
              events.push({
                id: 'nyse-holiday-' + h.date,
                title: h.name + ' — Market Closed',
                category: 'macro',
                severity: 'medium',
                status: 'active',
                deadline: h.date + 'T09:30:00-04:00',
                created: h.date + 'T00:00:00',
                market_impact: 'NYSE closed all day',
                tickers: [],
                _auto: true
              });
            }
          });
          (mh.earlyClose[yr] || []).forEach(function(e) {
            var d = new Date(e.date + 'T16:00:00').getTime();
            if (d > now && d < cutoff) {
              events.push({
                id: 'nyse-early-' + e.date,
                title: e.name + ' — Early Close (' + e.close + ' ET)',
                category: 'macro',
                severity: 'low',
                status: 'active',
                deadline: e.date + 'T' + e.close + ':00-04:00',
                created: e.date + 'T00:00:00',
                market_impact: 'NYSE closes early at ' + e.close + ' ET',
                tickers: [],
                _auto: true
              });
            }
          });
        });
      }

      return events;
    });
  }

  function loadAndRender() {
    loadEvents().then(function(events) {
      renderEvents(events);
      startCountdowns();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }).catch(function(e) {
      console.error('Failed to load events:', e);
      var cd = document.getElementById('events-live-countdowns');
      if (cd) cd.innerHTML = '<p style="color:var(--text-dim);">Failed to load events</p>';
    });
  }

  function renderEvents(events) {
    var filter = localStorage.getItem('bt_events_filter') || 'all';
    var now = Date.now();
    var weekMs = 7 * 86400000;

    var active = events.filter(function(e) { return e.status === 'active'; });
    var resolved = events.filter(function(e) {
      return (e.status === 'resolved' || e.status === 'expired') &&
        (now - new Date(e.created || 0).getTime()) < weekMs;
    });

    var filtered = filter === 'all' ? active : active.filter(function(e) {
      if (filter === 'geo') return e.category === 'geopolitical';
      if (filter === 'fed') return e.category === 'fed';
      if (filter === 'macro') return e.category === 'macro';
      if (filter === 'earnings') return e.category === 'earnings';
      return true;
    });

    var countdowns = filtered.filter(function(e) {
      if (!(e.countdown && e.deadline)) return false;
      if (!(e.severity === 'critical' || e.severity === 'high')) return false;
      // Defense in depth: only show countdowns whose deadline is still in the future.
      // (bt-event expire should already flip past deadlines to status=expired, but
      // naive-datetime deadlines historically slipped through.)
      var dl = new Date(e.deadline).getTime();
      return !isNaN(dl) && dl > now;
    });
    var upcoming = filtered.filter(function(e) {
      // Only show events with a real future deadline within the next 7 days.
      // Events without a deadline (e.g. open-ended Trump-monitor classifications)
      // would otherwise flood this column.
      if (!e.deadline) return false;
      var dl = new Date(e.deadline).getTime();
      if (isNaN(dl)) return false;
      return dl > now && dl - now < weekMs;
    });
    var intel = filtered.filter(function(e) { return e.category === 'analyst_flag'; });

    // Filter tabs
    var tabs = document.getElementById('events-filter-tabs');
    if (tabs) {
      var filters = [
        { key: 'all', label: 'All' },
        { key: 'geo', label: '<i data-lucide="globe"></i> Geo' },
        { key: 'macro', label: '<i data-lucide="bar-chart-3"></i> Macro' },
        { key: 'fed', label: '<i data-lucide="landmark"></i> Fed' },
        { key: 'earnings', label: '<i data-lucide="dollar-sign"></i> Earnings' }
      ];
      tabs.innerHTML = filters.map(function(f) {
        return '<button class="events-filter-btn' + (f.key === filter ? ' active' : '') + '" data-filter="' + f.key + '">' + f.label + '</button>';
      }).join('');
      tabs.querySelectorAll('.events-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          localStorage.setItem('bt_events_filter', btn.getAttribute('data-filter'));
          loadAndRender();
        });
      });
    }

    // Countdowns
    var cdEl = document.getElementById('events-live-countdowns');
    if (cdEl) {
      cdEl.innerHTML = countdowns.length
        ? countdowns.map(function(e) { return renderEventCard(e, false); }).join('')
        : '<p style="color:var(--text-dim);">No active countdowns</p>';
    }

    // Upcoming
    var upEl = document.getElementById('events-upcoming');
    if (upEl) {
      var nonCountdown = upcoming.filter(function(e) { return countdowns.indexOf(e) === -1; });
      upEl.innerHTML = nonCountdown.length
        ? nonCountdown.map(function(e) { return renderEventCard(e, false); }).join('')
        : '<p style="color:var(--text-dim);">No upcoming events</p>';
    }

    // Analyst intel
    var intelEl = document.getElementById('events-analyst-intel');
    if (intelEl) {
      intelEl.innerHTML = intel.length
        ? '<h3 style="color:var(--cyan);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:20px 0 12px;"><i data-lucide="video"></i> Video Analysis Intel</h3>' +
          intel.map(function(e) { return renderEventCard(e, false); }).join('')
        : '';
    }

    // Resolved
    var resEl = document.getElementById('events-resolved');
    if (resEl) {
      resEl.innerHTML = resolved.length
        ? resolved.map(function(e) { return renderEventCard(e, true); }).join('')
        : '<p style="color:var(--text-dim);">None in last 7 days</p>';
    }
  }

  function renderEventCard(ev, compact) {
    var cat = CAT_BADGES[ev.category] || '•';
    var color = SEVERITY_COLORS[ev.severity] || '#64748b';
    var tickerLinks = (ev.tickers || []).map(function(t) {
      return (window.BT && BT.tickerLink) ? BT.tickerLink(t) : t;
    }).join(' ');
    var tickersInline = (ev.tickers || []).join(', ');

    // Glossary-decorate severity label so users can hover to learn what it means
    var sevLabel = (ev.severity || 'medium').toUpperCase();

    if (compact) {
      return '<div class="event-card-compact" style="border-left:3px solid ' + color + ';">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + cat + ' <strong>' + ev.title + '</strong></span>' +
          '<span class="event-countdown" data-deadline="' + (ev.deadline || '') + '" style="color:' + color + ';font-weight:600;font-size:12px;"></span>' +
        '</div>' +
        (tickerLinks ? '<div class="ev-tickers-row" style="margin-top:4px;">' + tickerLinks + '</div>' : '') +
      '</div>';
    }

    var pulseStyle = ev.severity === 'critical' ? 'animation:events-pulse 2s infinite;' : '';

    return '<div class="event-card" style="border-left:4px solid ' + color + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div>' +
          '<span style="font-size:10px;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;margin-right:6px;">' + cat + ' ' + (CAT_LABELS[ev.category] || ev.category) + '</span>' +
          '<span style="font-size:10px;color:' + color + ';font-weight:600;text-transform:uppercase;">' + sevLabel + '</span>' +
        '</div>' +
        (ev.countdown && ev.deadline
          ? '<span class="event-countdown" data-deadline="' + ev.deadline + '" style="color:' + color + ';' + pulseStyle + 'font-weight:700;font-size:14px;font-family:monospace;"></span>'
          : '') +
      '</div>' +
      '<h4 style="margin:8px 0 4px;color:var(--text-bright);font-size:14px;">' + ev.title + '</h4>' +
      (ev.market_impact ? '<p style="font-size:12px;color:var(--text-dim);margin:4px 0;">' + ev.market_impact + '</p>' : '') +
      (tickerLinks
        ? '<div class="ev-tickers-row" style="margin-top:6px;">' + tickerLinks + '</div>'
        : '') +
      (ev.notes ? '<p style="font-size:11px;color:var(--text-dim);margin-top:6px;font-style:italic;">' + ev.notes + '</p>' : '') +
      (ev.deadline ? '<div style="font-size:10px;color:var(--text-dim);margin-top:6px;">Deadline: ' + new Date(ev.deadline).toLocaleString() + '</div>' : '') +
    '</div>';
  }

  function formatCountdown(deadline) {
    var now = Date.now();
    var dl = new Date(deadline).getTime();
    var diff = dl - now;
    if (diff <= 0) return { text: 'DEADLINE PASSED', expired: true };
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    return { text: d > 0 ? d + 'd ' + h + 'h ' + m + 'm ' + s + 's' : h + 'h ' + m + 'm ' + s + 's', expired: false };
  }

  function startCountdowns() {
    if (_countdownInterval) clearInterval(_countdownInterval);
    function tick() {
      document.querySelectorAll('.event-countdown').forEach(function(el) {
        var dl = el.getAttribute('data-deadline');
        if (!dl) return;
        var cd = formatCountdown(dl);
        el.textContent = cd.text;
        if (cd.expired) el.style.color = '#ef5350';
      });
    }
    tick();
    _countdownInterval = setInterval(tick, 1000);
  }

  // === Mini Strip (called from signals page) ===
  function initEventsMiniStrip() {
    loadEvents().then(function(events) {
      var nowMs = Date.now();
      var active = events.filter(function(e) {
        if (!(e.status === 'active' && (e.severity === 'critical' || e.severity === 'high') && e.countdown && e.deadline)) return false;
        var dl = new Date(e.deadline).getTime();
        return !isNaN(dl) && dl > nowMs;
      });
      active.sort(function(a, b) { return new Date(a.deadline) - new Date(b.deadline); });
      var top = active.slice(0, 2);

      var strip = document.getElementById('events-strip');
      if (!strip || !top.length) return;

      strip.style.cssText = 'display:flex;align-items:center;gap:16px;background:#06060e;border-bottom:1px solid var(--border);padding:6px 16px;font-size:12px;';
      strip.innerHTML = '<span style="color:var(--orange);font-weight:700;"><i data-lucide="alert-circle"></i> NEXT:</span>' +
        top.map(function(e) {
          var color = SEVERITY_COLORS[e.severity];
          return '<span style="color:' + color + ';">' + e.title + ' — <span class="event-countdown" data-deadline="' + e.deadline + '" style="font-weight:600;font-family:monospace;"></span></span>';
        }).join('<span style="color:var(--text-dim);"> | </span>') +
        '<a href="#events" style="margin-left:auto;color:var(--cyan);font-size:11px;text-decoration:none;">→ Full Calendar</a>';

      startCountdowns();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }).catch(function() { /* silent */ });
  }

  // Expose mini strip globally for signals page
  BT.initEventsMiniStrip = initEventsMiniStrip;
  window.initEventsMiniStrip = initEventsMiniStrip;

  BT.pages.events = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
