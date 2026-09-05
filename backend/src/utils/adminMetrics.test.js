const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMetrics, metricsQuerySchema } = require('./adminMetrics.ts');
const rows = [
  { status: 'approved', school: 'Cornell', level_of_study: 'Undergraduate', form_key: 'hackathon', checked_in: true, created_at: '2026-09-01T00:00:00Z' },
  { status: 'pending', school: 'Cornell', level_of_study: 'Graduate', form_key: 'hackathon', checked_in: false, created_at: '2026-09-02T23:59:59Z' },
  { status: 'approved', school: 'Other', level_of_study: 'Undergraduate', form_key: 'workshop', checked_in: false, created_at: '2026-09-03T00:00:00Z' },
  { status: 'pending', school: null, level_of_study: null, form_key: 'hackathon', checked_in: null, created_at: '2026-09-04T00:00:00Z' },
];
test('combines filters and retains complete choices', () => {
  const result = buildMetrics(rows, { status: 'approved', school: 'Cornell', level_of_study: 'Undergraduate', form_key: 'hackathon', checked_in: 'true' });
  assert.equal(result.total, 1);
  assert.equal(result.overall_total, 4);
  assert.equal(result.by_school.Cornell, 1);
  assert.deepEqual(result.options.school, ['', 'Cornell', 'Other']);
});
test('includes both UTC day boundaries', () => {
  assert.equal(buildMetrics(rows, { from: '2026-09-01', to: '2026-09-02' }).total, 2);
  assert.equal(buildMetrics(rows, { from: '2026-09-02' }).total, 3);
});
test('returns empty breakdowns for no matches', () => {
  const result = buildMetrics(rows, { school: 'Cornell', form_key: 'workshop' });
  assert.equal(result.total, 0);
  assert.deepEqual(Object.keys(result.by_status), []);
});
test('missing values stay filterable and distinct from false', () => {
  assert.equal(buildMetrics(rows, { school: '' }).total, 1);
  assert.equal(buildMetrics(rows, { checked_in: 'false' }).total, 2);
  assert.equal(buildMetrics(rows, { checked_in: '' }).total, 1);
});
test('handles object property names safely', () => {
  const result = buildMetrics([{ ...rows[0], school: '__proto__' }, { ...rows[0], school: 'constructor' }], {});
  assert.equal(result.by_school.__proto__, 1);
  assert.equal(result.by_school.constructor, 1);
});
test('validates dates, ranges and query value types', () => {
  for (const query of [{ from: '2026-09-03', to: '2026-09-01' }, { from: '2026-02-30' }, { status: ['pending'] }, { checked_in: 'yes' }]) {
    assert.equal(metricsQuerySchema.safeParse(query).success, false);
  }
  assert.equal(metricsQuerySchema.safeParse({ from: '2026-09-01', to: '2026-09-01' }).success, true);
});
