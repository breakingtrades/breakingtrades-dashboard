/**
 * market-status.js — Real-time NYSE market status indicator.
 * Loads data/market-hours.json, computes current status, updates DOM every second.
 *
 * Usage: <script src="js/market-status.js"></script>
 * Requires an element with id="market-status" in the page.
 * Output: "PRE-MARKET" | "OPEN" | "AFTER-HOURS" | "CLOSED" | "HOLIDAY: <name>"
 */
function initMarketStatus() {
  const STATUS_EL_ID = 'market-status';
  const DATA_PATH = 'data/market-hours.json';
  let config = null;

  function pad2(n) { return String(n).padStart(2, '0'); }

  /** Convert "HH:MM" to minutes since midnight */
  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Get current date/time in exchange timezone */
  function getNYTime() {
    const now = new Date();
    const nyStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const ny = new Date(nyStr);
    return {
      date: `${ny.getFullYear()}-${pad2(ny.getMonth() + 1)}-${pad2(ny.getDate())}`,
      day: ny.getDay(), // 0=Sun, 6=Sat
      minutes: ny.getHours() * 60 + ny.getMinutes(),
      hours: ny.getHours(),
      mins: ny.getMinutes(),
      secs: ny.getSeconds(),
      full: ny,
    };
  }

  function getStatus(ny) {
    if (!config) return { label: '...', color: 'var(--text-dim)', dot: false };

    const year = ny.date.slice(0, 4);

    // Weekend
    if (ny.day === 0 || ny.day === 6) {
      return { label: 'CLOSED', color: '#ef5350', dot: false, sub: 'Weekend' };
    }

    // Holiday check
    const holidays = (config.holidays && config.holidays[year]) || [];
    const holiday = holidays.find(h => h.date === ny.date);
    if (holiday) {
      return { label: 'CLOSED', color: '#ef5350', dot: false, sub: holiday.name };
    }

    // Early close check
    const earlyCloses = (config.earlyClose && config.earlyClose[year]) || [];
    const earlyClose = earlyCloses.find(e => e.date === ny.date);

    const open = toMinutes(config.regularHours.open);        // 9:30 = 570
    const close = earlyClose
      ? toMinutes(earlyClose.close)                           // 13:00 = 780
      : toMinutes(config.regularHours.close);                 // 16:00 = 960

    const preOpen = toMinutes(config.extendedHours.premarket.open);   // 4:00 = 240
    const afterClose = toMinutes(config.extendedHours.afterhours.close); // 20:00 = 1200

    if (ny.minutes >= open && ny.minutes < close) {
      const minsLeft = close - ny.minutes;
      const sub = earlyClose
        ? `Early close ${etToLocal(earlyClose.close)} — ${earlyClose.name}`
        : `Closes ${etToLocal(config.regularHours.close)}`;
      return { label: 'OPEN', color: 'var(--cyan, #00d4aa)', dot: true, sub, minsLeft };
    }

    if (ny.minutes >= preOpen && ny.minutes < open) {
      return { label: 'PRE-MARKET', color: '#ffa726', dot: true, sub: `Opens ${etToLocal(config.regularHours.open)}` };
    }

    if (ny.minutes >= close && ny.minutes < afterClose && !earlyClose) {
      return { label: 'AFTER-HOURS', color: '#ab47bc', dot: true, sub: 'Extended trading' };
    }

    return { label: 'CLOSED', color: '#ef5350', dot: false };
  }

  /** Format current time in user's local timezone */
  function formatLocalTime() {
    const now = new Date();
    const h = now.getHours() > 12 ? now.getHours() - 12 : now.getHours() || 12;
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now)
      .find(p => p.type === 'timeZoneName')?.value || '';
    return `${h}:${pad2(now.getMinutes())} ${ampm} ${tz}`;
  }

  /** Convert an "HH:MM" ET time to user's local time string (e.g. "3:00 PM") */
  function etToLocal(hhmm) {
    const now = new Date();
    const [h, m] = hhmm.split(':').map(Number);
    const nyNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const nyTarget = new Date(nyNow);
    nyTarget.setHours(h, m, 0, 0);
    const diffMs = nyTarget.getTime() - nyNow.getTime();
    const local = new Date(now.getTime() + diffMs);
    const lh = local.getHours() > 12 ? local.getHours() - 12 : local.getHours() || 12;
    const lampm = local.getHours() >= 12 ? 'PM' : 'AM';
    return `${lh}:${pad2(local.getMinutes())} ${lampm}`;
  }

  function render() {
    const el = document.getElementById(STATUS_EL_ID);
    if (!el) return;

    const ny = getNYTime();
    const status = getStatus(ny);

    const dotHtml = status.dot
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${status.color};margin-right:5px;animation:statusPulse 2s ease-in-out infinite;"></span>`
      : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${status.color};margin-right:5px;opacity:0.5;"></span>`;

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    el.innerHTML = `
      <span class="ms-label">Market: </span>${dotHtml}<span style="color:${status.color};font-weight:600;">${status.label}</span>
      ${status.sub ? `<span class="ms-sub" style="color:var(--text-dim,#555);margin-left:4px;font-size:10px;">${status.sub}</span>` : ''}
      <span class="ms-date" style="color:var(--text-dim,#888);margin-left:8px;">${dateStr}, ${formatLocalTime()}</span>
    `;
  }

  // Inject pulse animation if not present
  if (!document.getElementById('market-status-styles')) {
    const style = document.createElement('style');
    style.id = 'market-status-styles';
    style.textContent = `@keyframes statusPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`;
    document.head.appendChild(style);
  }

  // Load config and start
  fetch(DATA_PATH)
    .then(r => r.json())
    .then(data => { config = data; render(); setInterval(render, 1000); })
    .catch(() => { render(); setInterval(render, 1000); });
}
