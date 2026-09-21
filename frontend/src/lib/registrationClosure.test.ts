import test from "node:test";
import assert from "node:assert/strict";
import { deadlineToLocalInput, formatRegistrationDeadline, isRegistrationClosed, isWaitlistApplication, localInputToDeadline } from "./registrationClosure.ts";
import { buildApplicationCards } from "./registrationUi.ts";

test("New York date input resolves to an absolute deadline independently of browser zone", () => {
  assert.equal(localInputToDeadline("2026-09-30T23:59"), "2026-10-01T03:59:00.000Z");
  assert.equal(localInputToDeadline("2026-12-01T23:59"), "2026-12-02T04:59:00.000Z");
  assert.equal(deadlineToLocalInput("2026-10-01T03:59:00Z"), "2026-09-30T23:59:00");
  assert.equal(localInputToDeadline("2026-09-30T23:59:31", "UTC"), "2026-09-30T23:59:31.000Z");
  assert.equal(localInputToDeadline(""), null);
  assert.equal(deadlineToLocalInput(null), "");
  assert.match(formatRegistrationDeadline("2026-10-01T03:59:00Z"), /Sep 30, 2026.*11:59 PM EDT/);
});

test("invalid and ambiguous local dates must be resolved before saving", () => {
  assert.throws(() => localInputToDeadline("2026-02-30T12:00"), /valid closing/);
  assert.throws(() => localInputToDeadline("2026-03-08T02:30"), /does not exist/);
  assert.throws(() => localInputToDeadline("2026-11-01T01:30"), /occurs twice/);
  assert.equal(localInputToDeadline("2026-11-01T01:30", "UTC"), "2026-11-01T01:30:00.000Z");
});

test("deadline boundary closes unstarted cards and keeps submitted statuses and review actions", () => {
  const closes_at = "2026-10-01T00:00:00Z";
  const cutoff = Date.parse(closes_at);
  const forms = [{ key: "registration", title: "Registration", description: null, version: 1, closes_at }];
  assert.equal(isRegistrationClosed(closes_at, cutoff - 1), false);
  assert.equal(isRegistrationClosed(closes_at, cutoff), true);
  assert.equal(buildApplicationCards(forms, [], cutoff - 1)[0].primaryActionLabel, "Start Application");
  const closed = buildApplicationCards(forms, [], cutoff)[0];
  assert.equal(closed.closed, true);
  assert.equal(closed.stateLabel, "Closed");
  assert.equal(closed.primaryActionLabel, "Registration closed");
  const submitted = buildApplicationCards(forms, [{ form_key: "registration", status: "approved" }], cutoff)[0];
  assert.equal(submitted.stateLabel, "Approved");
  assert.equal(submitted.primaryActionLabel, "View Application");
});

test('late waitlist intake starts at the exact deadline and never changes existing submissions', () => {
  const closes_at = '2026-10-01T00:00:00Z';
  const cutoff = Date.parse(closes_at);
  for (const key of ['registration', 'workshop']) {
    const form = { key, title: 'Application', description: null, version: 1, closes_at, allow_late_waitlist: true };
    assert.equal(isWaitlistApplication(form, false, cutoff - 1), false);
    assert.equal(isWaitlistApplication(form, false, cutoff), true);
    assert.equal(isWaitlistApplication(form, true, cutoff), false);
    assert.equal(isWaitlistApplication({ ...form, closes_at: null }, false, cutoff), false);
    assert.equal(isWaitlistApplication({ ...form, allow_late_waitlist: false }, false, cutoff), false);
    const card = buildApplicationCards([form], [], cutoff)[0];
    assert.equal(card.closed, true);
    assert.equal(card.stateLabel, 'Closed');
    assert.equal(card.primaryActionLabel, 'Apply on waitlist');
    for (const status of ['pending', 'approved', 'waitlisted', 'rejected']) {
      const submitted = buildApplicationCards([form], [{ form_key: key, status }], cutoff)[0];
      assert.equal(submitted.waitlistApplication, false);
      assert.equal(submitted.status, status);
      assert.notEqual(submitted.primaryActionLabel, 'Apply on waitlist');
    }
  }
});
