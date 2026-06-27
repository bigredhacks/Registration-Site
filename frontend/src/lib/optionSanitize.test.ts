import test from "node:test";
import assert from "node:assert/strict";

import {
  keepKnownOptions,
  coerceKnownOption,
  profileSchema,
  AGE_RANGES,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
} from "./formConfig.ts";

test("keepKnownOptions drops values outside the allowed set", () => {
  assert.deepEqual(keepKnownOptions(["Vegan", "Test"], DIETARY_OPTIONS), ["Vegan"]);
  assert.deepEqual(keepKnownOptions(["Vegan", 5, null], DIETARY_OPTIONS), ["Vegan"]);
  assert.deepEqual(keepKnownOptions(null, DIETARY_OPTIONS), []);
  assert.deepEqual(keepKnownOptions(undefined, DIETARY_OPTIONS), []);
});

test("coerceKnownOption blanks unknown single values", () => {
  assert.equal(coerceKnownOption("Male", GENDER_OPTIONS), "Male");
  assert.equal(coerceKnownOption("not-a-gender", GENDER_OPTIONS), "");
  assert.equal(coerceKnownOption(null, GENDER_OPTIONS), "");
});

function baseValidProfile(overrides: Record<string, unknown>) {
  return {
    firstName: "Richie",
    lastName: "Xue",
    email: "rx77@cornell.edu",
    phoneNumber: "(347) 579-5414",
    age: AGE_RANGES[1],
    graduationYear: "2028",
    university: "Cornell University",
    country: "",
    levelOfStudy: "",
    major: "",
    gender: "Male",
    dietaryRestrictions: [] as string[],
    shirtSize: "L",
    linkedin: "",
    ...overrides,
  };
}

test("regression: a legacy dietary value blocks the profile save invisibly", () => {
  // Exactly the data found in the DB for this user.
  const raw = baseValidProfile({ dietaryRestrictions: ["Vegan", "Test"] });
  assert.equal(profileSchema.safeParse(raw).success, false);

  const fixed = baseValidProfile({
    dietaryRestrictions: keepKnownOptions(["Vegan", "Test"], DIETARY_OPTIONS),
  });
  assert.equal(profileSchema.safeParse(fixed).success, true);
});
