const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RegistrationClosesAtSchema,
  RegistrationTimezoneSchema,
  isRegistrationClosed,
  registrationClosureResponse,
} = require('./registrationClosure.ts');

test('a registration deadline closes at the exact instant, with no deadline remaining open', () => {
  const deadline = '2026-09-30T23:59:00-04:00';
  const cutoff = Date.parse(deadline);
  assert.equal(isRegistrationClosed(deadline, cutoff - 1), false);
  assert.equal(isRegistrationClosed(deadline, cutoff), true);
  assert.equal(isRegistrationClosed(deadline, cutoff + 1), true);
  assert.equal(isRegistrationClosed(null, cutoff), false);
  assert.equal(isRegistrationClosed(undefined, cutoff), false);
});

test('deadline settings require absolute timestamps and valid time zones', () => {
  assert.equal(RegistrationClosesAtSchema.safeParse(null).success, true);
  assert.equal(RegistrationClosesAtSchema.safeParse('2026-09-30T23:59:00-04:00').success, true);
  assert.equal(RegistrationClosesAtSchema.safeParse('2026-09-30T23:59:00').success, false);
  assert.equal(RegistrationClosesAtSchema.safeParse('2026-02-30T00:00:00Z').success, false);
  assert.equal(RegistrationTimezoneSchema.safeParse('America/New_York').success, true);
  assert.equal(RegistrationTimezoneSchema.safeParse('UTC').success, true);
  assert.equal(RegistrationTimezoneSchema.safeParse('somewhere').success, false);
});

test('closed active forms retain their data and publication state in API responses', () => {
  const now = Date.parse('2026-10-01T00:00:00Z');
  const result = registrationClosureResponse({ key: 'registration', is_active: true, closes_at: '2026-09-30T00:00:00Z' }, now);
  assert.equal(result.is_active, true);
  assert.equal(result.is_closed, true);
  assert.equal(result.server_now, '2026-10-01T00:00:00.000Z');
});
