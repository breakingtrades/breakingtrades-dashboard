/**
 * tests/sticky-nav.test.js — Regression test for global sticky nav experience
 *
 * Guards:
 *  1. Only `.nav-bar` may declare `position: sticky; top: 0`.
 *     All other sticky rules MUST offset by `var(--sticky-top-offset)` or a non-zero value.
 *  2. Every sticky table-header rule MUST declare an explicit `z-index` that is NOT
 *     higher than `var(--z-nav)` (we only accept `var(--z-table-head)` or lower numeric).
 *
 * Rationale: openspec/changes/sticky-nav-unified/OPENSPEC.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CSS_DIR = path.resolve(__dirname, '..', 'css');
const cssFiles = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css'));

// Crude rule splitter: selectors { body }
function parseRules(text) {
  const rules = [];
  let depth = 0, buf = '', selector = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') {
      if (depth === 0) { selector = buf.trim(); buf = ''; }
      else buf += c;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) { rules.push({ selector, body: buf }); buf = ''; selector = ''; }
      else buf += c;
    } else {
      buf += c;
    }
  }
  return rules;
}

function hasPositionSticky(body) { return /position\s*:\s*sticky\b/.test(body); }
function topValue(body) {
  const m = body.match(/(^|[\s;])top\s*:\s*([^;]+?)\s*(;|$)/);
  return m ? m[2].trim() : null;
}
function zIndexValue(body) {
  const m = body.match(/(^|[\s;])z-index\s*:\s*([^;]+?)\s*(;|$)/);
  return m ? m[2].trim() : null;
}

describe('Sticky nav — global scroll experience', () => {
  const violations = [];
  const stickyRules = [];

  beforeAll(() => {
    cssFiles.forEach(file => {
      const full = path.join(CSS_DIR, file);
      const text = fs.readFileSync(full, 'utf8');
      const rules = parseRules(text);
      rules.forEach(r => {
        // strip nested media-query content — we only care about top-level rules here
        if (!hasPositionSticky(r.body)) return;
        stickyRules.push({ file, selector: r.selector, body: r.body });
      });

      // Also scan inside @media blocks (one level deep)
      const mediaMatches = text.match(/@media[^{]+\{([\s\S]*?)\n\}/g) || [];
      mediaMatches.forEach(block => {
        const inner = block.slice(block.indexOf('{') + 1, block.lastIndexOf('}'));
        const innerRules = parseRules(inner);
        innerRules.forEach(r => {
          if (!hasPositionSticky(r.body)) return;
          stickyRules.push({ file, selector: r.selector + ' (inside @media)', body: r.body });
        });
      });
    });
  });

  test('every sticky top:0 rule belongs to .nav-bar only', () => {
    const offenders = [];
    stickyRules.forEach(r => {
      const top = topValue(r.body);
      if (top === '0' || top === '0px') {
        // Allow ONLY .nav-bar
        if (!/\.nav-bar\b/.test(r.selector)) {
          offenders.push(`${r.file} { ${r.selector} } top: ${top}`);
        }
      }
    });
    if (offenders.length) {
      throw new Error(
        'Non-nav rules with `position: sticky; top: 0` — they will overlap the nav.\n' +
        'Use `top: var(--sticky-top-offset)` instead.\n' +
        offenders.map(o => '  - ' + o).join('\n')
      );
    }
  });

  test('sticky table-header rules declare an explicit z-index below --z-nav', () => {
    const forbiddenZ = /^(100|150|200|300|999[0-9]?)$/; // >= z-nav
    const offenders = [];
    stickyRules.forEach(r => {
      // Target table-header-like selectors (heuristic)
      if (!/\bth\b|thead|table-head|group-header/i.test(r.selector)) return;
      const z = zIndexValue(r.body);
      if (!z) {
        offenders.push(`${r.file} { ${r.selector} } has no z-index`);
      } else if (forbiddenZ.test(z)) {
        offenders.push(`${r.file} { ${r.selector} } z-index=${z} >= --z-nav`);
      }
    });
    if (offenders.length) {
      throw new Error(
        'Sticky table headers must declare a z-index below --z-nav (100).\n' +
        'Use `z-index: var(--z-table-head)`.\n' +
        offenders.map(o => '  - ' + o).join('\n')
      );
    }
  });

  test('.nav-bar has sticky + top:0 + --z-nav', () => {
    const shell = fs.readFileSync(path.join(CSS_DIR, 'shell.css'), 'utf8');
    expect(shell).toMatch(/\.nav-bar\s*\{[^}]*position\s*:\s*sticky/);
    expect(shell).toMatch(/\.nav-bar\s*\{[^}]*top\s*:\s*0/);
    expect(shell).toMatch(/\.nav-bar\s*\{[^}]*z-index\s*:\s*var\(--z-nav\)/);
  });

  test('variables.css defines --z-table-head and --sticky-top-offset', () => {
    const v = fs.readFileSync(path.join(CSS_DIR, 'variables.css'), 'utf8');
    expect(v).toMatch(/--z-table-head\s*:\s*80/);
    expect(v).toMatch(/--sticky-top-offset\s*:/);
  });
});
