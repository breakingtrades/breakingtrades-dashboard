/**
 * components/fear-greed.js — Shared Fear & Greed gauge component
 */
(function() {
  'use strict';

  var fgColor = BT.utils.fgColor;
  var fgLabel = BT.utils.fgLabel;
  var fgVal = BT.utils.fgVal;

  /**
   * Render Fear & Greed gauge into a container
   * @param {string} containerId - DOM element id to render into
   * @param {object} data - Fear & Greed data (current, previousClose, oneWeekAgo, oneMonthAgo)
   * @param {object} options - { compact, showHistory, showTrend }
   */
  function renderFearGreed(containerId, data, options) {
    options = options || {};
    var showHistory = options.showHistory !== false;
    var showTrend = options.showTrend !== false;
    var el = document.getElementById(containerId);
    if (!el || !data) return;

    var val = Math.round(data.current.value);
    var cx = 150, cy = 150, r = 110, arcW = 28;

    var zones = [
      { start:0, end:25, color:'#ef5350', label:'EXTREME FEAR' },
      { start:25, end:45, color:'#ffa726', label:'FEAR' },
      { start:45, end:55, color:'#ffeb3b', label:'NEUTRAL' },
      { start:55, end:75, color:'#8bc34a', label:'GREED' },
      { start:75, end:100, color:'#00d4aa', label:'EXTREME GREED' }
    ];

    function valToAngle(v) { return Math.PI - (v / 100) * Math.PI; }
    function polar(angle, radius) {
      return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
    }
    function arcPath(v1, v2, radius) {
      var p1 = polar(valToAngle(v1), radius), p2 = polar(valToAngle(v2), radius);
      var span = Math.abs(v2 - v1);
      var large = span > 50 ? 1 : 0;
      return 'M ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) + ' A ' + radius + ' ' + radius + ' 0 ' + large + ' 1 ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2);
    }

    var arcs = '', defs = '', textPaths = '';
    zones.forEach(function(z, i) {
      var gap = 0.8;
      var s = z.start + (i === 0 ? 0 : gap);
      var e = z.end - (i === zones.length - 1 ? 0 : gap);
      arcs += '<path d="' + arcPath(s, e, r) + '" fill="none" stroke="' + z.color + '" stroke-width="' + arcW + '" stroke-linecap="round" opacity="0.85"/>';
      var textR = r - arcW/2 + 2;
      var pathId = 'fgtp' + i;
      var tp1 = polar(valToAngle(z.start + 1), textR), tp2 = polar(valToAngle(z.end - 1), textR);
      var tSpan = Math.abs((z.end - 1) - (z.start + 1));
      var tLarge = tSpan > 50 ? 1 : 0;
      defs += '<path id="' + pathId + '" d="M ' + tp1.x.toFixed(2) + ' ' + tp1.y.toFixed(2) + ' A ' + textR + ' ' + textR + ' 0 ' + tLarge + ' 1 ' + tp2.x.toFixed(2) + ' ' + tp2.y.toFixed(2) + '" fill="none"/>';
      textPaths += '<text><textPath href="#' + pathId + '" startOffset="50%" text-anchor="middle" fill="' + z.color + '" font-size="7" font-weight="700" letter-spacing="1.2" opacity="0.6">' + z.label + '</textPath></text>';
    });

    // Tick marks
    var ticks = '';
    [0, 25, 50, 75, 100].forEach(function(v) {
      var angle = valToAngle(v);
      var outer = polar(angle, r + arcW/2 + 3);
      var inner = polar(angle, r + arcW/2 + 10);
      ticks += '<line x1="' + outer.x.toFixed(1) + '" y1="' + outer.y.toFixed(1) + '" x2="' + inner.x.toFixed(1) + '" y2="' + inner.y.toFixed(1) + '" stroke="#444" stroke-width="1.5"/>';
      var pt = polar(angle, r + arcW/2 + 20);
      ticks += '<text x="' + pt.x.toFixed(1) + '" y="' + pt.y.toFixed(1) + '" fill="#555" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="middle">' + v + '</text>';
    });

    // Needle
    var needleAngle = valToAngle(val);
    var needleTip = polar(needleAngle, r + arcW/2 - 4);
    var needleBack = polar(needleAngle + Math.PI, 10);
    var valColor = val <= 25 ? '#ef5350' : val <= 45 ? '#ffa726' : val <= 55 ? '#ffeb3b' : val <= 75 ? '#8bc34a' : '#00d4aa';

    var prevVal = data.previousClose ? data.previousClose.value : null;
    var hasPrev = prevVal != null;
    var trendArrow = !hasPrev ? '—' : val > prevVal ? '▲' : val < prevVal ? '▼' : '→';
    var trendColor = !hasPrev ? '#8888aa' : val > prevVal ? '#00d4aa' : val < prevVal ? '#ef5350' : '#8888aa';
    var diff = hasPrev ? val - prevVal : 0;

    var html = '<div class="fg-gauge-container">' +
      '<svg viewBox="0 0 300 185" class="fg-gauge-svg" preserveAspectRatio="xMidYMid meet">' +
      '<defs>' + defs + '<filter id="needleShadow"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/></filter></defs>' +
      arcs + textPaths + ticks +
      '<g filter="url(#needleShadow)">' +
      '<line x1="' + needleBack.x.toFixed(1) + '" y1="' + needleBack.y.toFixed(1) + '" x2="' + needleTip.x.toFixed(1) + '" y2="' + needleTip.y.toFixed(1) + '" stroke="#e0e0e0" stroke-width="2.5" stroke-linecap="round"/>' +
      '</g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#1a1a2e" stroke="#e0e0e0" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2" fill="#e0e0e0"/>' +
      '</svg>' +
      '<div class="fg-value-wrap">' +
      '<div class="fg-value" style="color:' + valColor + '; text-shadow: 0 0 20px ' + valColor + '30;">' + val + '</div>' +
      '<div class="fg-label" style="color:' + valColor + '; text-transform: capitalize;">' + data.current.label + '</div>' +
      '</div>';

    if (showTrend && hasPrev) {
      html += '<div class="fg-trend" style="color:' + trendColor + '">' + trendArrow + ' ' + (diff > 0 ? '+' : '') + Math.round(diff) + ' from yesterday</div>';
    }

    if (showHistory) {
      html += '<div class="fg-history">' +
        '<div class="fg-history-item"><div class="fgh-label">Prev Close</div><div class="fgh-value" style="color:' + fgColor(prevVal) + '">' + fgVal(prevVal) + '</div><div class="fgh-sublabel">' + fgLabel(prevVal) + '</div></div>' +
        '<div class="fg-history-item"><div class="fgh-label">1 Week</div><div class="fgh-value" style="color:' + fgColor(data.oneWeekAgo ? data.oneWeekAgo.value : null) + '">' + fgVal(data.oneWeekAgo ? data.oneWeekAgo.value : null) + '</div><div class="fgh-sublabel">' + fgLabel(data.oneWeekAgo ? data.oneWeekAgo.value : null) + '</div></div>' +
        '<div class="fg-history-item"><div class="fgh-label">1 Month</div><div class="fgh-value" style="color:' + fgColor(data.oneMonthAgo ? data.oneMonthAgo.value : null) + '">' + fgVal(data.oneMonthAgo ? data.oneMonthAgo.value : null) + '</div><div class="fgh-sublabel">' + fgLabel(data.oneMonthAgo ? data.oneMonthAgo.value : null) + '</div></div>' +
        '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }

  BT.components.fearGreed = {
    render: renderFearGreed,
    /** Fetch data and render */
    fetchAndRender: function(containerId, options) {
      fetch('../data/fear-greed.json')
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (data) renderFearGreed(containerId, data, options);
        })
        .catch(function(e) { console.error('Fear & Greed fetch error:', e); });
    }
  };
})();
