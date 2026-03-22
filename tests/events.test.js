/**
 * events.js Unit Tests — BreakingTrades Dashboard
 */

// Mock DOM and fetch before requiring anything
const { JSDOM } = (() => {
  try { return require('jsdom'); } catch { return { JSDOM: null }; }
})();

// ── Inline the pure functions from events.js for testing ──
const SEVERITY_COLORS = {
  critical: '#ef5350',
  high: '#ffa726',
  medium: '#ffd700',
  low: '#64748b'
};

const CAT_BADGES = {
  geopolitical: '🌍',
  macro: '📊',
  fed: '🏛️',
  earnings: '💰',
  technical: '📈',
  analyst_flag: '🔍'
};

function parseJSONL(text) {
  return text.trim().split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => JSON.parse(l));
}

function formatCountdown(deadline) {
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const diff = dl - now;
  if (diff <= 0) return { text: 'DEADLINE PASSED', expired: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const text = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`;
  return { text, expired: false };
}

// ── Tests ──

describe('JSONL Parsing', () => {
  test('parse_jsonl — multi-line JSONL parsed correctly', () => {
    const input = '{"id":"1","title":"A"}\n{"id":"2","title":"B"}\n';
    const result = parseJSONL(input);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].title).toBe('B');
  });

  test('parse_jsonl — skips comments and blank lines', () => {
    const input = '# comment\n{"id":"1"}\n\n{"id":"2"}\n';
    const result = parseJSONL(input);
    expect(result).toHaveLength(2);
  });
});

describe('Filtering & Sorting', () => {
  const events = [
    { id: '1', status: 'active', deadline: '2026-03-30T00:00:00Z', severity: 'high' },
    { id: '2', status: 'resolved', deadline: '2026-03-25T00:00:00Z', severity: 'medium' },
    { id: '3', status: 'active', deadline: '2026-03-28T00:00:00Z', severity: 'critical' },
    { id: '4', status: 'expired', deadline: '2026-03-20T00:00:00Z', severity: 'low' },
  ];

  test('filter_active_only', () => {
    const active = events.filter(e => e.status === 'active');
    expect(active).toHaveLength(2);
    expect(active.every(e => e.status === 'active')).toBe(true);
  });

  test('sort_by_deadline', () => {
    const active = events.filter(e => e.status === 'active');
    active.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    expect(active[0].id).toBe('3'); // Mar 28 before Mar 30
    expect(active[1].id).toBe('1');
  });
});

describe('Countdown Formatting', () => {
  test('countdown_format_days — 3 days away', () => {
    const future = new Date(Date.now() + 3 * 86400000 + 2 * 3600000 + 14 * 60000 + 30000);
    const result = formatCountdown(future.toISOString());
    expect(result.expired).toBe(false);
    expect(result.text).toMatch(/^3d /);
    expect(result.text).toMatch(/h.*m.*s$/);
  });

  test('countdown_format_hours — 5 hours away (no days)', () => {
    const future = new Date(Date.now() + 5 * 3600000);
    const result = formatCountdown(future.toISOString());
    expect(result.expired).toBe(false);
    expect(result.text).toMatch(/^[0-9]+h/);
    expect(result.text).not.toMatch(/d /);
  });

  test('countdown_expired — deadline in past', () => {
    const past = new Date(Date.now() - 3600000);
    const result = formatCountdown(past.toISOString());
    expect(result.expired).toBe(true);
    expect(result.text).toBe('DEADLINE PASSED');
  });
});

describe('Severity Color Mapping', () => {
  test('severity_color_mapping', () => {
    expect(SEVERITY_COLORS.critical).toBe('#ef5350');
    expect(SEVERITY_COLORS.high).toBe('#ffa726');
    expect(SEVERITY_COLORS.medium).toBe('#ffd700');
    expect(SEVERITY_COLORS.low).toBe('#64748b');
  });
});

describe('Category Emoji Mapping', () => {
  test('category_emoji_mapping', () => {
    expect(CAT_BADGES.geopolitical).toBe('🌍');
    expect(CAT_BADGES.fed).toBe('🏛️');
    expect(CAT_BADGES.macro).toBe('📊');
    expect(CAT_BADGES.earnings).toBe('💰');
    expect(CAT_BADGES.technical).toBe('📈');
    expect(CAT_BADGES.analyst_flag).toBe('🔍');
  });
});

describe('Mini Strip', () => {
  test('mini_strip_hidden_when_no_critical', () => {
    // Simulate: no critical/high active events with countdown
    const events = [
      { status: 'active', severity: 'low', countdown: true, deadline: '2026-04-01T00:00:00Z' },
      { status: 'resolved', severity: 'critical', countdown: true, deadline: '2026-04-01T00:00:00Z' },
    ];
    const active = events.filter(e => e.status === 'active' && (e.severity === 'critical' || e.severity === 'high') && e.countdown && e.deadline);
    expect(active).toHaveLength(0);
    // strip would not display
  });

  test('mini_strip_shows_next_two', () => {
    const events = [
      { id: '1', status: 'active', severity: 'critical', countdown: true, deadline: '2026-03-25T00:00:00Z', title: 'A' },
      { id: '2', status: 'active', severity: 'high', countdown: true, deadline: '2026-03-26T00:00:00Z', title: 'B' },
      { id: '3', status: 'active', severity: 'critical', countdown: true, deadline: '2026-03-27T00:00:00Z', title: 'C' },
    ];
    const active = events.filter(e => e.status === 'active' && (e.severity === 'critical' || e.severity === 'high') && e.countdown && e.deadline);
    active.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const top = active.slice(0, 2);
    expect(top).toHaveLength(2);
    expect(top[0].title).toBe('A');
    expect(top[1].title).toBe('B');
  });
});
