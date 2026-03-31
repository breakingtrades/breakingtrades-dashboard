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
  const DATA_PATH = '../data/market-hours.json';
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
        ? `Early close ${earlyClose.close} ET — ${earlyClose.name}`
        : `Closes ${config.regularHours.close} ET`;
      return { label: 'OPEN', color: 'var(--cyan, #00d4aa)', dot: true, sub, minsLeft };
    }

    if (ny.minutes >= preOpen && ny.minutes < open) {
      return { label: 'PRE-MARKET', color: '#ffa726', dot: true, sub: `Opens ${config.regularHours.open} ET` };
    }

    if (ny.minutes >= close && ny.minutes < afterClose && !earlyClose) {
      return { label: 'AFTER-HOURS', color: '#ab47bc', dot: true, sub: 'Extended trading' };
    }

    return { label: 'CLOSED', color: '#ef5350', dot: false };
  }

  function formatTime(ny) {
    const h = ny.hours > 12 ? ny.hours - 12 : ny.hours || 12;
    const ampm = ny.hours >= 12 ? 'PM' : 'AM';
    return `${h}:${pad2(ny.mins)}:${pad2(ny.secs)} ${ampm} ET`;
  }

  function render() {
    const el = document.getElementById(STATUS_EL_ID);
    if (!el) return;

    const ny = getNYTime();
    const status = getStatus(ny);

    const dotHtml = status.dot
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${status.color};margin-right:5px;animation:statusPulse 2s ease-in-out infinite;"></span>`
      : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${status.color};margin-right:5px;opacity:0.5;"></span>`;

    const dateStr = ny.full.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    el.innerHTML = `
      Market: ${dotHtml}<span style="color:${status.color};font-weight:600;">${status.label}</span>
      ${status.sub ? `<span style="color:var(--text-dim,#555);margin-left:4px;font-size:10px;">${status.sub}</span>` : ''}
      <span style="color:var(--text-dim,#888);margin-left:8px;">${dateStr}, ${formatTime(ny)}</span>
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
