/**
 * utils.js — Shared utility functions for BreakingTrades v2
 */
var BT = window.BT || {};
BT.utils = {};
BT.pages = {};
BT.components = {};

/** Format price with 2 decimal places */
BT.utils.fmtPrice = function(val, fallback) {
  if (val == null || isNaN(val)) return fallback || '—';
  return Number(val).toFixed(2);
};

/** Calculate percentage difference */
BT.utils.pctDiff = function(a, b) {
  if (!b || b === 0) return 0;
  return ((a - b) / b) * 100;
};

/** Clamp value between min and max */
BT.utils.clamp = function(val, min, max) {
  return Math.min(max, Math.max(min, val));
};

/** Breadth color based on value 0-100 */
BT.utils.breadthColor = function(val) {
  if (val <= 20) return '#00d4aa';
  if (val >= 80) return '#ef5350';
  if (val <= 40) return '#26a69a';
  if (val >= 60) return '#ff7043';
  return '#ffa726';
};

/** Fear & Greed color based on value 0-100 */
BT.utils.fgColor = function(v) {
  if (v == null) return '#555';
  return v <= 25 ? '#ef5350' : v <= 45 ? '#ffa726' : v <= 55 ? '#ffeb3b' : v <= 75 ? '#8bc34a' : '#00d4aa';
};

/** Fear & Greed label based on value */
BT.utils.fgLabel = function(v) {
  if (v == null) return '—';
  return v <= 25 ? 'Extreme Fear' : v <= 45 ? 'Fear' : v <= 55 ? 'Neutral' : v <= 75 ? 'Greed' : 'Extreme Greed';
};

/** Fear & Greed display value */
BT.utils.fgVal = function(v) {
  return v != null ? Math.round(v) : '—';
};

/**
 * Generate sparkline SVG path from an array of values
 * @param {number[]} data - Array of numeric values
 * @param {object} opts - { width, height, stroke, fill }
 * @returns {string} SVG markup
 */
BT.utils.sparkline = function(data, opts) {
  if (!data || data.length < 2) return '';
  opts = opts || {};
  var w = opts.width || 80;
  var h = opts.height || 24;
  var stroke = opts.stroke || 'var(--cyan)';
  var fill = opts.fill || 'none';

  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min || 1;
  var step = w / (data.length - 1);

  var points = data.map(function(v, i) {
    var x = (i * step).toFixed(1);
    var y = (h - ((v - min) / range) * h).toFixed(1);
    return x + ',' + y;
  });

  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none" style="display:block;">' +
    '<polyline points="' + points.join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
};
