/**
 * components/vix-regime.js — VIX Regime card component
 */
(function() {
  'use strict';

  /**
   * Render VIX regime card into a container
   * @param {string} containerId - DOM element id
   * @param {object} v - VIX data { current, sma20, sma50, percentile30d, regime, color, description }
   */
  function renderVixRegime(containerId, v) {
    var el = document.getElementById(containerId);
    if (!el || !v) return;

    var pct = Math.min(100, Math.max(0, ((v.current - 10) / 40) * 100));

    el.innerHTML =
      '<div class="vix-big-value" style="color:' + v.color + '">' + v.current.toFixed(2) + '</div>' +
      '<div class="vix-regime-label" style="color:' + v.color + '">' + v.regime + '</div>' +
      '<div class="vix-bar-wrap">' +
        '<div class="vix-bar"><div class="vix-needle" style="left:' + pct + '%"></div></div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:4px;">' +
          '<span style="font-size:9px;color:#00d4aa;">10</span>' +
          '<span style="font-size:9px;color:#8bc34a;">15</span>' +
          '<span style="font-size:9px;color:#ffeb3b;">20</span>' +
          '<span style="font-size:9px;color:#ffa726;">30</span>' +
          '<span style="font-size:9px;color:#ef5350;">40</span>' +
          '<span style="font-size:9px;color:#d32f2f;">50</span>' +
        '</div>' +
      '</div>' +
      '<div class="vix-description">' + v.description + '</div>' +
      '<div class="vix-levels">' +
        '<div class="vix-level-item"><div class="vl-label">SMA20</div><div class="vl-value">' + v.sma20 + '</div></div>' +
        '<div class="vix-level-item"><div class="vl-label">SMA50</div><div class="vl-value">' + v.sma50 + '</div></div>' +
        '<div class="vix-level-item"><div class="vl-label">30d %ile</div><div class="vl-value" style="color:' + v.color + '">' + v.percentile30d + 'th</div></div>' +
      '</div>';
  }

  BT.components.vixRegime = {
    render: renderVixRegime
  };
})();
