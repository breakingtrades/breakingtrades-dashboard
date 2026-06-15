/**
 * tests/tape-toggle.test.js — Regression test for V3 ticker tape toggle.
 *
 * The V3 sidebar exposes a 3-state cycle (off → snapshot → tape → off).
 * shell.js drives the actual mount/destroy of snapshotStrip and tickerTape
 * in response to v3:tape-state-change events. Both lifecycle modules MUST
 * expose a symmetric mount/destroy API or the cycle breaks silently:
 *   - Pre-fix bug: clicking "TAPE" was a no-op because tickerTape only had
 *     show/hide, no mount/destroy.
 *   - Pre-fix bug: snapshotStrip.mount() reached into ticker-tape's DOM and
 *     orphaned its wrapper, so the tape couldn't be re-shown after a swap.
 *
 * This test parses the JS source as text (no jsdom) — same approach as
 * sticky-nav.test.js. We assert API surface + key invariants.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LIB = path.resolve(__dirname, '..', 'js', 'lib');
const tickerTapeSrc = fs.readFileSync(path.join(LIB, 'ticker-tape.js'), 'utf8');
const snapshotStripSrc = fs.readFileSync(path.join(LIB, 'snapshot-strip.js'), 'utf8');
const shellSrc = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'shell.js'), 'utf8');

describe('V3 ticker tape toggle — mount/destroy symmetry', () => {
  test('tickerTape exports mount() and destroy() in its return literal', () => {
    // The IIFE returns an object literal that maps the public API.
    // Check both keys appear in the returned record.
    expect(tickerTapeSrc).toMatch(/return\s*\{[\s\S]*\bmount\s*:\s*mount\b/);
    expect(tickerTapeSrc).toMatch(/return\s*\{[\s\S]*\bdestroy\s*:\s*destroy\b/);
  });

  test('tickerTape.destroy() resets _injected so a later mount() rebuilds the widget', () => {
    // The bug pre-fix: destroy was missing, so _injected stayed true and
    // inject() early-returned. Assert the function clears _injected.
    // Walk braces to extract the full destroy() body (regex lazy match
    // stops at the first inner `}`).
    const start = tickerTapeSrc.search(/function\s+destroy\s*\(\s*\)\s*\{/);
    expect(start).toBeGreaterThan(-1);
    const openBrace = tickerTapeSrc.indexOf('{', start);
    let depth = 1, i = openBrace + 1;
    while (i < tickerTapeSrc.length && depth > 0) {
      if (tickerTapeSrc[i] === '{') depth++;
      else if (tickerTapeSrc[i] === '}') depth--;
      i++;
    }
    const destroyBody = tickerTapeSrc.slice(openBrace, i);
    expect(destroyBody).toMatch(/_injected\s*=\s*false/);
    expect(destroyBody).toMatch(/_wrap\s*=\s*null/);
  });

  test('snapshotStrip does NOT remove the tradingview-widget-container in mount()', () => {
    // The bug pre-fix: snapshotStrip.mount() yanked the TV container out of
    // the DOM, orphaning ticker-tape's wrapper. Tape lifecycle is owned by
    // shell.js — snapshot-strip must not reach across.
    const mountBlock = snapshotStripSrc.match(/function\s+mount\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/);
    expect(mountBlock).not.toBeNull();
    expect(mountBlock[0]).not.toMatch(/tradingview-widget-container/);
  });

  test('shell.js calls tickerTape.mount and tickerTape.destroy on tape-state-change', () => {
    // Guard against regression where shell.js drops back to show()/hide()
    // calls that don't exist on a destroyed instance.
    expect(shellSrc).toMatch(/window\.tickerTape\.mount/);
    expect(shellSrc).toMatch(/window\.tickerTape\.destroy/);
    expect(shellSrc).toMatch(/window\.snapshotStrip\.mount/);
    expect(shellSrc).toMatch(/window\.snapshotStrip\.destroy/);
  });

  test('shell.js attaches v3:tape-state-change listener BEFORE V3Sidebar.mount()', () => {
    // sidebar.js dispatches v3:tape-state-change at the end of its mount() to
    // restore the saved state. If shell.js attaches the listener after mount,
    // that initial dispatch is missed and the page renders empty.
    const listenerIdx = shellSrc.indexOf("addEventListener('v3:tape-state-change'");
    const mountIdx = shellSrc.indexOf('window.V3Sidebar.mount(');
    expect(listenerIdx).toBeGreaterThan(-1);
    expect(mountIdx).toBeGreaterThan(-1);
    expect(listenerIdx).toBeLessThan(mountIdx);
  });

  test('ticker-tape.js does not auto-inject in v3 mode (shell.js owns lifecycle)', () => {
    // Auto-inject in v3 collides with the explicit mount/destroy from the
    // tape-state-change handler.
    expect(tickerTapeSrc).toMatch(/classList\.contains\(['"]v3['"]\)/);
  });
});
