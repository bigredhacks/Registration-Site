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
test('approved_checked_in counts rows that are both approved and checked in', () => {
  const checkedInButRejected = { ...rows[0], status: 'rejected', checked_in: true };
  const result = buildMetrics([...rows, checkedInButRejected], {});
  // Check-in is independent of status, so neither tally alone gives this number:
  // two rows are checked in and two are approved, but only one row is both.
  assert.equal(result.by_checked_in.true, 2);
  assert.equal(result.by_status.approved, 2);
  assert.equal(result.approved_checked_in, 1);
  assert.equal(buildMetrics([checkedInButRejected], {}).approved_checked_in, 0);
  assert.equal(buildMetrics([{ ...rows[0], checked_in: false }], {}).approved_checked_in, 0);
});
test('approved_checked_in respects the active filters', () => {
  assert.equal(buildMetrics(rows, {}).approved_checked_in, 1);
  assert.equal(buildMetrics(rows, { form_key: 'workshop' }).approved_checked_in, 0);
  assert.equal(buildMetrics(rows, { from: '2026-09-02' }).approved_checked_in, 0);
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

test('invitation metrics separate drafts, current invitations, historical responses and other forms', () => {
  const base = { ...rows[0], form_key: 'registration', released_status: null, invitation_response: null };
  const applicants = [
    base,
    { ...base, released_status: 'approved', invitation_response: 'accepted' },
    { ...base, released_status: 'approved', invitation_response: 'declined' },
    { ...base, status: 'waitlisted', released_status: 'approved' },
    { ...base, released_status: 'waitlisted', invitation_response: 'accepted' },
    { ...base, released_status: 'rejected' },
    { ...base, form_key: 'workshop' },
  ];
  const result = buildMetrics(applicants, {});
  assert.equal(result.released_invitations, 3);
  assert.deepEqual(result.invitation_counts, { accepted: 1, declined: 1, unanswered: 1 });
  assert.equal(result.by_released_status.unreleased, 1);
  assert.equal(result.by_released_status.waitlisted, 1);
  assert.equal(result.by_released_status.rejected, 1);
  assert.equal(result.by_released_status.not_applicable, 1);
  assert.equal(result.by_release_state.changed, 3);
  assert.equal(result.by_invitation_response.accepted, 2);
  assert.equal(result.by_invitation_response.no_invitation, 2);
  for (const dimension of ['released_status', 'release_state', 'invitation_response']) {
    assert.equal(Object.values(result[`by_${dimension}`]).reduce((a, b) => a + b, 0), applicants.length);
  }
  assert.equal(buildMetrics(applicants, { invitation_response: 'unanswered' }).total, 1);
  assert.equal(buildMetrics(applicants, { release_state: 'unreleased' }).total, 1);
  const accepted = buildMetrics(applicants, { released_status: 'approved', invitation_response: 'accepted', school: 'Cornell', from: '2026-09-01', to: '2026-09-01' });
  assert.equal(accepted.total, 1);
  assert.equal(accepted.invitation_counts.accepted, 1);
  assert.equal(buildMetrics(applicants, { form_key: 'workshop' }).released_invitations, 0);
  assert.equal(buildMetrics(applicants, { from: '2026-09-02' }).released_invitations, 0);
  applicants[1] = { ...applicants[1], invitation_response: 'declined' };
  assert.deepEqual(buildMetrics(applicants, {}).invitation_counts, { accepted: 0, declined: 2, unanswered: 1 });
});

test('validates new metrics state filters', () => {
  for (const query of [{ released_status: 'pending' }, { release_state: 'approved' }, { invitation_response: 'maybe' }]) {
    assert.equal(metricsQuerySchema.safeParse(query).success, false);
  }
  assert.equal(metricsQuerySchema.safeParse({ released_status: 'approved', release_state: 'changed', invitation_response: 'unanswered' }).success, true);
});


test('state filter choices remain available with zero matching applicants', () => {
  for (const source of [[], rows]) {
    const result = buildMetrics(source, { invitation_response: 'accepted' });
    assert.equal(result.total, 0);
    assert.deepEqual(result.options.invitation_response, ['accepted', 'declined', 'unanswered', 'no_invitation', 'not_applicable']);
    assert.deepEqual(result.options.released_status, ['approved', 'waitlisted', 'rejected', 'unreleased', 'not_applicable']);
    assert.deepEqual(result.options.release_state, ['unreleased', 'changed', 'current', 'not_applicable']);
    assert.equal(result.invitation_counts.accepted, 0);
  }
});
