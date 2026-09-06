const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveTeamStatus, buildTeamOverview, validateTeamAssignment, readAllRows, rollbackSavedDraft } = require('./adminTeams.ts');

const registration = (id, user_id, status = 'pending') => ({ id, user_id, status, email: `${user_id}@example.com`, first_name: user_id, last_name: 'Student', form_key: 'registration' });
const person = (id, user_id) => ({ id, user_id, full_name: user_id, email: `${user_id}@example.com` });

test('team admission is derived from every member, including missing applications', () => {
  assert.equal(deriveTeamStatus([registration(1, 'a', 'approved'), registration(2, 'b', 'approved')]), 'approved');
  assert.equal(deriveTeamStatus([registration(1, 'a', 'approved'), registration(2, 'b')]), 'mixed');
  assert.equal(deriveTeamStatus([registration(1, 'a', 'approved'), null]), 'missing_application');
  assert.equal(deriveTeamStatus([]), 'missing_application');
});

test('looking excludes assigned users even when their matching submission remains', () => {
  const overview = buildTeamOverview({
    teams: [{ id: 'team', name: 'Existing', invite_code: 'ABCDEF' }],
    memberships: [{ team_id: 'team', user_id: 'a' }, { team_id: 'team', user_id: 'missing' }],
    participants: [person('pa', 'a'), person('pb', 'b')],
    registrations: [registration(1, 'a', 'approved'), registration(2, 'b')], profiles: [],
    savedTeams: [{ id: 'draft', team_number: 1 }],
    savedMembers: [{ id: 'member1', team_id: 'draft', participant_id: 'pa' }, { id: 'member2', team_id: 'draft', participant_id: 'removed' }],
  });
  assert.deepEqual(overview.looking.map((person) => person.user_id), ['b']);
  assert.equal(overview.teams[0].status, 'missing_application');
  assert.equal(overview.teams[0].members[0].registration.team_name, 'Existing');
  assert.equal(overview.savedTeams[0].conflicts, 1);
  assert.equal(overview.savedTeams[0].missing_members, 1);
  assert.equal(overview.registrations.find((student) => student.user_id === 'b').team_name, null);
});

test('publishing rejects existing membership, duplicate users, unknown participants and oversized teams before writes', () => {
  const people = [person('pa', 'a'), person('pb', 'b')];
  const teams = [{ members: [{ participant_id: 'pa' }, { participant_id: 'pb' }] }];
  assert.equal(validateTeamAssignment(teams, people, []), null);
  assert.match(validateTeamAssignment(teams, people, [{ team_id: 'existing', user_id: 'a' }]), /already belongs/);
  assert.match(validateTeamAssignment([teams[0], { members: [{ participant_id: 'pa' }] }], people, []), /more than one/);
  assert.match(validateTeamAssignment([{ members: [{ participant_id: 'unknown' }] }], people, []), /no longer/);
  assert.match(validateTeamAssignment([{ members: Array.from({ length: 5 }, () => ({ participant_id: 'pa' })) }], people, []), /between 1 and 4/);
  assert.match(validateTeamAssignment([], people, []), /No draft/);
});

test('database scans continue beyond the first response page and propagate failures', async () => {
  const calls = [];
  const source = [1, 2, 3, 4, 5];
  const result = await readAllRows(async (from, to) => {
    calls.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  }, 2);
  assert.deepEqual(result, source);
  assert.deepEqual(calls, [[0, 1], [2, 3], [4, 5]]);
  await assert.rejects(readAllRows(async () => ({ data: null, error: { message: 'Database unavailable' } })), /Database unavailable/);
});

test('failed save removes only its own teams and preserves a newer draft from another request', async () => {
  const previous = { teams: [{ id: 'old', team_number: 1 }], members: [] };
  const teams = new Map([
    ['our-failed-team', { id: 'our-failed-team', team_number: 1 }],
    ['newer-team', { id: 'newer-team', team_number: 2 }],
  ]);
  const deleted = [];
  await assert.rejects(rollbackSavedDraft(previous, ['our-failed-team'], {
    deleteTeams: async (ids) => { deleted.push(...ids); ids.forEach((id) => teams.delete(id)); },
    listTeams: async () => [...teams.values()],
    restoreTeams: async () => assert.fail('Must not restore over another request'),
    restoreMembers: async () => assert.fail('Must not restore over another request'),
  }), /preserved/);
  assert.deepEqual(deleted, ['our-failed-team']);
  assert.deepEqual([...teams.keys()], ['newer-team']);
});

test('failed save restores its previous draft when the pool remains empty', async () => {
  const previous = { teams: [{ id: 'old', team_number: 1 }], members: [{ id: 'old-member', team_id: 'old', participant_id: 'pa' }] };
  const calls = [];
  await rollbackSavedDraft(previous, ['new'], {
    deleteTeams: async (ids) => calls.push(['delete', ids]),
    listTeams: async () => [],
    restoreTeams: async (rows) => calls.push(['teams', rows]),
    restoreMembers: async (rows) => calls.push(['members', rows]),
  });
  assert.deepEqual(calls, [['delete', ['new']], ['teams', previous.teams], ['members', previous.members]]);
});
