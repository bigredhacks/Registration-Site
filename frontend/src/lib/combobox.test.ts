import test from "node:test";
import assert from "node:assert/strict";

import { resolveComboboxCommit } from "./combobox.ts";

const countries = ["United States of America", "United Kingdom", "Canada"];

test("commits an exact (case-insensitive) match even when custom values are disallowed", () => {
  assert.equal(
    resolveComboboxCommit("united states of america", countries, false),
    "United States of America"
  );
});

test("keeps the current value (null) when text is not a known option and custom is disallowed", () => {
  // Regression: a typed-but-unmatched value must never be silently turned into junk.
  assert.equal(resolveComboboxCommit("usa", countries, false), null);
});

test("commits arbitrary trimmed text when custom values are allowed", () => {
  assert.equal(resolveComboboxCommit("  My Custom School  ", [], true), "My Custom School");
});

test("canonicalizes casing to the known option when custom values are allowed", () => {
  assert.equal(resolveComboboxCommit("canada", countries, true), "Canada");
});

test("empty / whitespace input never commits", () => {
  assert.equal(resolveComboboxCommit("   ", countries, true), null);
  assert.equal(resolveComboboxCommit("", countries, false), null);
});
