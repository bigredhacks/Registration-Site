import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerateDraftErrorState,
  buildGenerateDraftSuccessState,
  uniqueTeamStudents,
  teamMatchesSearch,
} from "./adminTeamMatchingState.ts";

test("buildGenerateDraftErrorState clears stale draft data and keeps the backend message", () => {
  const state = buildGenerateDraftErrorState("Not enough participants to form teams of the requested size");

  assert.deepEqual(state.draftTeams, []);
  assert.equal(state.participantsCount, null);
  assert.equal(state.generateError, "Not enough participants to form teams of the requested size");
});

test("buildGenerateDraftSuccessState keeps the generated teams and clears previous errors", () => {
  const teams = [
    {
      team_number: 1,
      members: [
        {
          id: "participant-1",
          email: "coder@example.com",
          full_name: "Coder Example",
          hacker_type: "FirstTimeHacker",
        },
      ],
    },
  ];

  const state = buildGenerateDraftSuccessState({
    total_participants: 1,
    teams,
  });

  assert.deepEqual(state.draftTeams, teams);
  assert.equal(state.participantsCount, 1);
  assert.equal(state.generateError, null);
});

test("draft state preserves unmatched students and clears them on error", () => {
  const unmatched = [{ id: 'leftover', full_name: 'One Left', email: 'one@example.com', hacker_type: 'VeteranHacker' }];
  assert.deepEqual(buildGenerateDraftSuccessState({ unmatched }).unmatched, unmatched);
  assert.deepEqual(buildGenerateDraftErrorState('failed').unmatched, []);
});

test("team selection deduplicates application IDs and excludes other forms or missing applications", () => {
  const student = { id: 10, user_id: 'user-1', email: 'one@example.com', status: 'pending', form_key: 'registration' };
  assert.deepEqual(uniqueTeamStudents([student, student, null, undefined, { ...student, id: 11, form_key: 'volunteer' }], 'registration'), [student]);
});

test("team search includes members and ignores case and surrounding spaces", () => {
  const team = { id: 'team', name: 'Alpha', invite_code: 'ABCDEF', status: 'pending', members: [{ user_id: 'user', full_name: 'Jane Smith', email: 'jane@example.com', registration: null }] };
  assert.equal(teamMatchesSearch(team, ' SMITH '), true);
  assert.equal(teamMatchesSearch(team, 'jane@example.com'), true);
  assert.equal(teamMatchesSearch(team, 'missing'), false);
});
