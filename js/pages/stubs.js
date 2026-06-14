/**
 * pages/stubs.js — Coming-soon stubs for v3 pages not yet built.
 * Registers ai-trader, holdings, alerts, settings, about.
 */
(function() {
  'use strict';

  BT.pages = BT.pages || {};

  function makeStub(emoji, title, body) {
    return {
      render: function(el) {
        el.innerHTML =
          '<div class="v3-stub">' +
            '<div class="v3-stub-icon">' + emoji + '</div>' +
            '<h1 class="v3-stub-title">' + title + '</h1>' +
            '<p class="v3-stub-body">' + body + '</p>' +
          '</div>';
        if (!document.getElementById('v3-stub-styles')) {
          var s = document.createElement('style');
          s.id = 'v3-stub-styles';
          s.textContent =
            '.v3-stub { padding: 80px 32px; max-width: 600px; margin: 0 auto; text-align: center; }' +
            '.v3-stub-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.7; }' +
            '.v3-stub-title { font-size: 24px; font-weight: 700; color: var(--text-bright); margin: 0 0 12px; letter-spacing: 0.5px; }' +
            '.v3-stub-body { font-size: 14px; color: var(--text-dim); line-height: 1.7; }';
          document.head.appendChild(s);
        }
      }
    };
  }

  // Phase 3 has shipped real ai-trader + holdings pages — see js/pages/ai-trader.js.
  // Stubs only register the still-pending pages (alerts, settings, about).

  BT.pages.alerts = makeStub(
    '🔔',
    'Alerts',
    'Inbox of triggered alerts: EM breaches, milestone hits, signal entries, regime changes. ' +
    'Mark-read, dismiss, click-through to source ticker. ' +
    '<br><br>Coming in Phase 2D.'
  );

  BT.pages.settings = makeStub(
    '⚙️',
    'Settings',
    'Theme density, default landing page, freshness thresholds, notification preferences, exported data. ' +
    '<br><br>Coming in Phase 2D.'
  );

  BT.pages.about = makeStub(
    'ℹ️',
    'About BreakingTrades',
    'Multi-page trading intelligence dashboard. Built on a layered data pipeline that ingests price data, options flow, ' +
    'event calendars, and macro releases, then runs an empirical-priors engine to surface high-conviction setups. ' +
    'V3 chrome shipped ' + new Date().toISOString().slice(0, 10) + '.'
  );

})();
