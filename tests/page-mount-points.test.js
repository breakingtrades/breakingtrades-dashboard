/**
 * tests/page-mount-points.test.js — Regression test for SPA page render targets.
 *
 * Bug pre-fix: js/pages/backtest.js fell through to `document.body` when its
 * preferred mount points (`#page-root`, `.app-content`) were missing — both
 * are non-existent in this codebase. Setting `document.body.innerHTML` wipes
 * the V3 sidebar/topbar shell and strands the user with no nav.
 *
 * Every page module under js/pages/ MUST render into a scoped element
 * (router passes `contentEl`, or fallback to `#content`). Writing to
 * `document.body.innerHTML` is forbidden — call sites must use a scoped
 * mount point.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.resolve(__dirname, '..', 'js', 'pages');

function listPageFiles() {
  return fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.js'));
}

describe('SPA page modules — mount points', () => {
  test('no page writes to document.body.innerHTML', () => {
    const offenders = [];
    listPageFiles().forEach(file => {
      const text = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
      // Direct assignment
      if (/document\.body\.innerHTML\s*=/.test(text)) {
        offenders.push(`${file}: writes document.body.innerHTML directly`);
      }
      // Indirect: `var root = ... || document.body; root.innerHTML = ...`
      // Heuristic: any line that ORs into document.body and is followed
      // (within ~120 chars) by an .innerHTML assignment on the same identifier.
      const orBodyMatches = [...text.matchAll(/(\b\w+)\s*=\s*[^;]*\|\|\s*document\.body[^;]*;/g)];
      orBodyMatches.forEach(m => {
        const ident = m[1];
        const after = text.slice(m.index, m.index + 400);
        const re = new RegExp(`\\b${ident}\\.innerHTML\\s*=`);
        if (re.test(after)) {
          offenders.push(`${file}: \`${ident}\` falls back to document.body and is assigned innerHTML`);
        }
      });
    });
    if (offenders.length) {
      throw new Error(
        'Page modules must render into a scoped mount point (router passes\n' +
        '`contentEl`; fallback should be `document.getElementById("content")`).\n' +
        'Writing to document.body.innerHTML wipes the V3 sidebar/topbar shell.\n' +
        offenders.map(o => '  - ' + o).join('\n')
      );
    }
  });

  test('backtest.js init() accepts the contentEl argument', () => {
    const text = fs.readFileSync(path.join(PAGES_DIR, 'backtest.js'), 'utf8');
    expect(text).toMatch(/function\s+init\s*\(\s*contentEl\s*\)/);
  });
});
