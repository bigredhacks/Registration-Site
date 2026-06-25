import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerateDraftErrorState,
  buildGenerateDraftSuccessState,
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
