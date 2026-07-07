import test from "node:test";
import assert from "node:assert/strict";

import { buildSchemaFromFields } from "./buildSchema.ts";
import type { FormField } from "./formConfig.ts";

test("note fields are display-only: skipped by the schema, never required", () => {
  const fields: FormField[] = [
    { id: "travel_note", type: "note", label: "No travel reimbursement this year", required: false },
    { id: "first_name", type: "text", label: "First Name", required: true },
    {
      id: "resume_uploaded",
      type: "checkbox",
      label: "Resume",
      required: true,
      checkboxText: "I uploaded my resume to the",
    },
  ];
  const schema = buildSchemaFromFields(fields);

  // Valid: no value supplied for the note, required fields satisfied.
  assert.equal(
    schema.safeParse({ first_name: "Richie", resume_uploaded: true }).success,
    true,
  );
  // Required checkbox must be checked.
  assert.equal(
    schema.safeParse({ first_name: "Richie", resume_uploaded: false }).success,
    false,
  );
  // Required text must be present.
  assert.equal(schema.safeParse({ resume_uploaded: true }).success, false);
});

test("optional text fields (e.g. dietary_other) accept empty/missing values", () => {
  const schema = buildSchemaFromFields([
    { id: "dietary_other", type: "text", label: "Other dietary restriction", required: false },
  ]);
  assert.equal(schema.safeParse({}).success, true);
  assert.equal(schema.safeParse({ dietary_other: "" }).success, true);
  assert.equal(schema.safeParse({ dietary_other: "no eggs" }).success, true);
});
