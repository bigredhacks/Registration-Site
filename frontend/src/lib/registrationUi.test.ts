import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApplicationCards,
  extractSubmissionFeedback,
} from "./registrationUi.ts";

test("buildApplicationCards merges active forms with user registrations and sorts registration first", () => {
  const cards = buildApplicationCards(
    [
      { key: "team-matching", title: "Team Matching", description: "Find teammates", version: 2 },
      { key: "registration", title: "Main Registration", description: "Apply", version: 4 },
    ],
    [
      { form_key: "registration", status: "waitlisted" },
      { form_key: "team-matching", status: "pending" },
    ],
  );

  assert.deepEqual(
    cards.map((card) => ({
      key: card.key,
      stateLabel: card.stateLabel,
      started: card.started,
      primaryActionLabel: card.primaryActionLabel,
    })),
    [
      {
        key: "registration",
        stateLabel: "Waitlisted",
        started: true,
        primaryActionLabel: "View Application",
      },
      {
        key: "team-matching",
        stateLabel: "Pending",
        started: true,
        primaryActionLabel: "Open Form",
      },
    ],
  );
});

test("buildApplicationCards marks active forms with no submission as not started", () => {
  const cards = buildApplicationCards(
    [{ key: "travel-waiver", title: "Travel Waiver", description: "", version: 1 }],
    [],
  );

  assert.deepEqual(cards, [
    {
      key: "travel-waiver",
      title: "Travel Waiver",
      description: "",
      version: 1,
      status: null,
      stateLabel: "Not Started",
      started: false,
      primaryActionLabel: "Start Form",
    },
  ]);
});

test("extractSubmissionFeedback prefers field-specific backend validation errors", () => {
  const feedback = extractSubmissionFeedback({
    error: "Invalid form submission",
    errors: [
      { field: "school", message: "School is required" },
      { field: "country", message: "Country is required" },
    ],
  });

  assert.equal(feedback.message, "School is required");
  assert.deepEqual(feedback.fieldErrors, {
    school: "School is required",
    country: "Country is required",
  });
});

test("extractSubmissionFeedback falls back to a generic message for unknown payloads", () => {
  const feedback = extractSubmissionFeedback(null, "Could not save this form.");

  assert.equal(feedback.message, "Could not save this form.");
  assert.deepEqual(feedback.fieldErrors, {});
});
