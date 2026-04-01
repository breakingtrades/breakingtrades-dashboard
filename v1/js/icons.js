/**
 * BreakingTrades SVG Icon Library
 * Flat, professional trading terminal icons — 16x16 default, scalable
 * Usage: icons.sectorRotation, icons.fearGreed, etc.
 */
const icons = (() => {
  const s = (paths, vb = '0 0 24 24') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="bt-icon">${paths}</svg>`;

  const sf = (paths, vb = '0 0 24 24') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor" class="bt-icon">${paths}</svg>`;

  return {
    // === Section Headers ===
    sectorRotation: s(`<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 6.36 2.64"/><path d="M18.36 5.64l-1.5-2.5M18.36 5.64l2.5-1.5"/><path d="M12 21a9 9 0 0 1-6.36-2.64"/><path d="M5.64 18.36l1.5 2.5M5.64 18.36l-2.5 1.5"/>`),

    fearGreed: s(`<path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 2a10 10 0 0 0-10 10"/><path d="M2 12h2M20 12h2M12 2v2"/><path d="M4.93 4.93l1.41 1.41M19.07 4.93l-1.41 1.41"/><line x1="12" y1="12" x2="7" y2="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`),

    vixChart: s(`<path d="M3 20l4-8 4 4 4-12 6 8"/><line x1="3" y1="20" x2="21" y2="20" opacity="0.3"/>`),

    pairRatios: s(`<path d="M3 12h18"/><path d="M8 6l-5 6 5 6"/><path d="M16 6l5 6-5 6"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`),

    trophy: s(`<path d="M6 9V4h12v5a6 6 0 0 1-12 0z"/><path d="M6 4H3v3a3 3 0 0 0 3 3"/><path d="M18 4h3v3a3 3 0 0 1-3 3"/><line x1="12" y1="15" x2="12" y2="18"/><path d="M8 21h8M10 18h4"/>`),

    thermometer: s(`<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><circle cx="11.5" cy="17.5" r="1.5" fill="currentColor"/><line x1="11.5" y1="8" x2="11.5" y2="15"/>`),

    target: s(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`),

    clipboard: s(`<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>`),

    heatmap: s(`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`),

    // === Signal / Status Icons ===
    trendUp: s(`<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>`),

    trendDown: s(`<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>`),

    warning: s(`<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>`),

    lightning: s(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`),

    fire: s(`<path d="M12 22c4.97 0 8-3.58 8-8 0-6-8-12-8-12S4 8 4 14c0 4.42 3.03 8 8 8z"/><path d="M12 22c2.21 0 4-1.79 4-4 0-3-4-6-4-6s-4 3-4 6c0 2.21 1.79 4 4 4z" opacity="0.4"/>`),

    skull: s(`<circle cx="12" cy="10" r="8"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/><path d="M8 16h8M10 16v4M14 16v4"/>`),

    refresh: s(`<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/><path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14"/>`),

    chart: s(`<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`),

    crosshair: s(`<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>`),

    activity: s(`<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`),

    shield: s(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`),

    eye: s(`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`),

    calendar: s(`<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`),

    checkCircle: s(`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`),

    barChart: s(`<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>`),
  };
})();

// Make available globally
if (typeof window !== 'undefined') window.icons = icons;
