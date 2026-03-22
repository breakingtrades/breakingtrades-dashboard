/**
 * events.js — BreakingTrades Event Calendar
 * Renders event calendar page and mini strip on index.
 */
(function () {
  'use strict';

  const SEVERITY_COLORS = {
    critical: '#ef5350',
    high: '#ffa726',
    medium: '#ffd700',
    low: '#64748b'
  };

  const CAT_BADGES = {
    geopolitical: '🌍',
    macro: '📊',
    fed: '🏛️',
    earnings: '💰',
    technical: '📈',
    analyst_flag: '🔍'
  };

  const CAT_LABELS = {
    geopolitical: 'Geo',
    macro: 'Macro',
    fed: 'Fed',
    earnings: 'Earnings',
    technical: 'Technical',
    analyst_flag: 'Intel'
  };

  async function loadEvents() {
    const res = await fetch('./data/events.jsonl');
    const text = await res.text();
    return text.trim().split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => JSON.parse(l));
  }

  function formatCountdown(deadline) {
    const now = Date.now();
    const dl = new Date(deadline).getTime();
    const diff = dl - now;
    if (diff <= 0) return { text: 'DEADLINE PASSED', expired: true };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const text = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`;
    return { text, expired: false };
  }

  function severityStyle(severity) {
    const color = SEVERITY_COLORS[severity] || '#64748b';
    const pulse = severity === 'critical' ? 'animation:pulse 2s infinite;' : '';
    return `color:${color};${pulse}`;
  }

  function renderEventCard(ev, compact) {
    const cat = CAT_BADGES[ev.category] || '•';
    const color = SEVERITY_COLORS[ev.severity] || '#64748b';
    const tickers = (ev.tickers || []).join(', ');

    if (compact) {
      return `<div class="event-card-compact" style="border-left:3px solid ${color};padding:8px 12px;margin-bottom:6px;background:var(--bg-card);border-radius:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>${cat} <strong>${ev.title}</strong></span>
          <span class="event-countdown" data-deadline="${ev.deadline || ''}" style="${severityStyle(ev.severity)}font-weight:600;font-size:12px;"></span>
        </div>
        ${tickers ? `<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${tickers}</div>` : ''}
      </div>`;
    }

    return `<div class="event-card" style="border-left:4px solid ${color};padding:12px 16px;margin-bottom:10px;background:var(--bg-card);border-radius:6px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <span style="font-size:10px;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;margin-right:6px;">${cat} ${CAT_LABELS[ev.category] || ev.category}</span>
          <span style="font-size:10px;color:${color};font-weight:600;text-transform:uppercase;">${ev.severity}</span>
        </div>
        ${ev.countdown && ev.deadline ? `<span class="event-countdown" data-deadline="${ev.deadline}" style="${severityStyle(ev.severity)}font-weight:700;font-size:14px;font-family:monospace;"></span>` : ''}
      </div>
      <h4 style="margin:8px 0 4px;color:var(--text-bright);font-size:14px;">${ev.title}</h4>
      ${ev.market_impact ? `<p style="font-size:12px;color:var(--text-dim);margin:4px 0;">${ev.market_impact}</p>` : ''}
      ${tickers ? `<div style="margin-top:6px;">${(ev.tickers || []).map(t => `<span style="font-size:10px;background:rgba(0,212,170,0.1);color:var(--cyan);padding:2px 6px;border-radius:3px;margin-right:4px;">${t}</span>`).join('')}</div>` : ''}
      ${ev.notes ? `<p style="font-size:11px;color:var(--text-dim);margin-top:6px;font-style:italic;">${ev.notes}</p>` : ''}
      ${ev.deadline ? `<div style="font-size:10px;color:var(--text-dim);margin-top:6px;">Deadline: ${new Date(ev.deadline).toLocaleString()}</div>` : ''}
    </div>`;
  }

  function startCountdowns() {
    function tick() {
      document.querySelectorAll('.event-countdown').forEach(el => {
        const dl = el.dataset.deadline;
        if (!dl) return;
        const cd = formatCountdown(dl);
        el.textContent = cd.text;
        if (cd.expired) el.style.color = '#ef5350';
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Full Events Page ──
  window.initEvents = async function () {
    const events = await loadEvents();
    const filter = localStorage.getItem('bt_events_filter') || 'all';
    const now = Date.now();
    const weekMs = 7 * 86400000;

    const active = events.filter(e => e.status === 'active');
    const resolved = events.filter(e => e.status === 'resolved' || e.status === 'expired')
      .filter(e => {
        const created = new Date(e.created || 0).getTime();
        return now - created < weekMs;
      });

    const filtered = filter === 'all' ? active : active.filter(e => {
      if (filter === 'geo') return e.category === 'geopolitical';
      if (filter === 'fed') return e.category === 'fed';
      if (filter === 'macro') return e.category === 'macro';
      if (filter === 'earnings') return e.category === 'earnings';
      return true;
    });

    // Countdown events (critical/high with deadline)
    const countdowns = filtered.filter(e => e.countdown && e.deadline && (e.severity === 'critical' || e.severity === 'high'));
    // Upcoming (next 7 days)
    const upcoming = filtered.filter(e => {
      if (!e.deadline) return true;
      const dl = new Date(e.deadline).getTime();
      return dl > now && dl - now < weekMs;
    });
    // Analyst intel
    const intel = filtered.filter(e => e.category === 'analyst_flag');

    // Render filter tabs
    const tabs = document.querySelector('.filter-tabs');
    if (tabs) {
      const filters = [
        { key: 'all', label: 'All' },
        { key: 'geo', label: '🌍 Geo' },
        { key: 'macro', label: '📊 Macro' },
        { key: 'fed', label: '🏛️ Fed' },
        { key: 'earnings', label: '💰 Earnings' }
      ];
      tabs.innerHTML = filters.map(f =>
        `<button class="filter-btn${f.key === filter ? ' active' : ''}" data-filter="${f.key}">${f.label}</button>`
      ).join('');
      tabs.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          localStorage.setItem('bt_events_filter', btn.dataset.filter);
          initEvents();
        });
      });
    }

    // Render countdowns
    const cdEl = document.getElementById('live-countdowns');
    if (cdEl) {
      cdEl.innerHTML = countdowns.length ? countdowns.map(e => renderEventCard(e)).join('') : '<p style="color:var(--text-dim);">No active countdowns</p>';
    }

    // Render upcoming
    const upEl = document.getElementById('upcoming-events');
    if (upEl) {
      const nonCountdown = upcoming.filter(e => !countdowns.includes(e));
      upEl.innerHTML = nonCountdown.length ? nonCountdown.map(e => renderEventCard(e)).join('') : '<p style="color:var(--text-dim);">No upcoming events</p>';
    }

    // Render analyst intel
    const intelEl = document.getElementById('analyst-intel');
    if (intelEl) {
      if (intel.length) {
        intelEl.innerHTML = `<h3 style="color:var(--cyan);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:20px 0 12px;">🔍 Video Analysis Intel</h3>` +
          intel.map(e => renderEventCard(e)).join('');
      } else {
        intelEl.innerHTML = '';
      }
    }

    // Render resolved
    const resEl = document.getElementById('resolved-events');
    if (resEl) {
      resEl.innerHTML = resolved.length ? resolved.map(e => renderEventCard(e, true)).join('') : '<p style="color:var(--text-dim);">None in last 7 days</p>';
    }

    startCountdowns();
  };

  // ── Mini Strip for index.html ──
  window.initEventsMiniStrip = async function () {
    try {
      const events = await loadEvents();
      const active = events.filter(e => e.status === 'active' && (e.severity === 'critical' || e.severity === 'high') && e.countdown && e.deadline);
      active.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      const top = active.slice(0, 2);

      const strip = document.getElementById('events-strip');
      if (!strip || !top.length) return;

      strip.style.display = 'block';
      strip.style.cssText = 'display:flex;align-items:center;gap:16px;background:#06060e;border-bottom:1px solid var(--border);padding:6px 16px;font-size:12px;';
      strip.innerHTML = `<span style="color:var(--orange);font-weight:700;">⚠️ NEXT:</span>` +
        top.map(e => {
          const color = SEVERITY_COLORS[e.severity];
          return `<span style="color:${color};">${e.title} — <span class="event-countdown" data-deadline="${e.deadline}" style="font-weight:600;font-family:monospace;"></span></span>`;
        }).join('<span style="color:var(--text-dim);"> | </span>') +
        `<a href="events.html" style="margin-left:auto;color:var(--cyan);font-size:11px;text-decoration:none;">→ Full Calendar</a>`;

      startCountdowns();
    } catch (e) {
      // Silent fail — mini strip is optional
    }
  };
})();

/* Pulse animation for critical events */
if (!document.getElementById('events-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'events-pulse-style';
  style.textContent = `@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }`;
  document.head.appendChild(style);
}
