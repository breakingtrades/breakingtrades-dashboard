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
      fetch('data/market-hours.json').then(function(r) { return r.json(); }).catch(function() { return null; })
    ]).then(function(results) {
      var text = results[0];
      var mh = results[1];
      var events = text.trim().split('\n')
        .filter(function(l) { return l.trim() && !l.startsWith('#'); })
        .map(function(l) { return JSON.parse(l); });

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
      return e.countdown && e.deadline && (e.severity === 'critical' || e.severity === 'high');
    });
    var upcoming = filtered.filter(function(e) {
      if (!e.deadline) return true;
      var dl = new Date(e.deadline).getTime();
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
    var tickers = (ev.tickers || []).join(', ');

    if (compact) {
      return '<div class="event-card-compact" style="border-left:3px solid ' + color + ';">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + cat + ' <strong>' + ev.title + '</strong></span>' +
          '<span class="event-countdown" data-deadline="' + (ev.deadline || '') + '" style="color:' + color + ';font-weight:600;font-size:12px;"></span>' +
        '</div>' +
        (tickers ? '<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">' + tickers + '</div>' : '') +
      '</div>';
    }

    var pulseStyle = ev.severity === 'critical' ? 'animation:events-pulse 2s infinite;' : '';

    return '<div class="event-card" style="border-left:4px solid ' + color + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div>' +
          '<span style="font-size:10px;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;margin-right:6px;">' + cat + ' ' + (CAT_LABELS[ev.category] || ev.category) + '</span>' +
          '<span style="font-size:10px;color:' + color + ';font-weight:600;text-transform:uppercase;">' + ev.severity + '</span>' +
        '</div>' +
        (ev.countdown && ev.deadline
          ? '<span class="event-countdown" data-deadline="' + ev.deadline + '" style="color:' + color + ';' + pulseStyle + 'font-weight:700;font-size:14px;font-family:monospace;"></span>'
          : '') +
      '</div>' +
      '<h4 style="margin:8px 0 4px;color:var(--text-bright);font-size:14px;">' + ev.title + '</h4>' +
      (ev.market_impact ? '<p style="font-size:12px;color:var(--text-dim);margin:4px 0;">' + ev.market_impact + '</p>' : '') +
      (ev.tickers && ev.tickers.length
        ? '<div style="margin-top:6px;">' + ev.tickers.map(function(t) {
            return '<span style="font-size:10px;background:rgba(0,212,170,0.1);color:var(--cyan);padding:2px 6px;border-radius:3px;margin-right:4px;">' + t + '</span>';
          }).join('') + '</div>'
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
      var active = events.filter(function(e) {
        return e.status === 'active' && (e.severity === 'critical' || e.severity === 'high') && e.countdown && e.deadline;
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
