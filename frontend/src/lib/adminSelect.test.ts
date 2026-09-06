import assert from "node:assert/strict";
import test from "node:test";
import { filterSelectOptions, hasSelectSearch, nextActiveIndex, reconcileActiveIndex, renderedSelectOptions, selectTypeahead } from "./adminSelect.ts";

const option = (label: string) => ({ value: label, label });
const schools = ["Cornell University", "Columbia University", "Bergen Cornerstone", "cornell tech"].map(option);

test("an empty query keeps every option in its original order", () => {
  assert.deepEqual(filterSelectOptions(schools, "").map((o) => o.label), schools.map((o) => o.label));
  assert.deepEqual(filterSelectOptions(schools, "   ").map((o) => o.label), schools.map((o) => o.label));
});

test("matching is case-insensitive and puts prefix matches first", () => {
  // "Bergen Cornerstone" contains "corn" but does not start with it, so it sorts last.
  assert.deepEqual(filterSelectOptions(schools, "corn").map((o) => o.label),
    ["Cornell University", "cornell tech", "Bergen Cornerstone"]);
  assert.deepEqual(filterSelectOptions(schools, "CORNELL").map((o) => o.label),
    ["Cornell University", "cornell tech"]);
});

test("interior matches still match, and a miss returns nothing", () => {
  assert.deepEqual(filterSelectOptions(schools, "university").map((o) => o.label),
    ["Cornell University", "Columbia University"]);
  assert.deepEqual(filterSelectOptions(schools, "zzz"), []);
  assert.deepEqual(filterSelectOptions([], "corn"), []);
});

test("arrows move through the list and wrap at both ends", () => {
  assert.equal(nextActiveIndex(0, "ArrowDown", 3), 1);
  assert.equal(nextActiveIndex(2, "ArrowDown", 3), 0);
  assert.equal(nextActiveIndex(1, "ArrowUp", 3), 0);
  assert.equal(nextActiveIndex(0, "ArrowUp", 3), 2);
});

test("opening with nothing highlighted starts at either end", () => {
  assert.equal(nextActiveIndex(-1, "ArrowDown", 3), 0);
  assert.equal(nextActiveIndex(-1, "ArrowUp", 3), 2);
});

test("Home and End jump to the ends, other keys hold position", () => {
  assert.equal(nextActiveIndex(2, "Home", 3), 0);
  assert.equal(nextActiveIndex(0, "End", 3), 2);
  assert.equal(nextActiveIndex(1, "Enter", 3), 1);
});

test("an index left over from a longer list does not escape the current one", () => {
  // The list shrinks as the user types; a stale index must not be reused.
  assert.equal(nextActiveIndex(9, "ArrowDown", 3), 0);
  assert.equal(nextActiveIndex(9, "Enter", 3), -1);
});

test("an empty list has no active row", () => {
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter"]) {
    assert.equal(nextActiveIndex(0, key, 0), -1);
  }
});

test("search counts all rows including the empty placeholder", () => {
  assert.equal(hasSelectSearch(9), false);
  assert.equal(hasSelectSearch(10), false);
  assert.equal(hasSelectSearch(11), true);
  assert.equal(hasSelectSearch(3, 2), true);
});

test("render cap retains a matching selected row beyond 200", () => {
  const rows = Array.from({ length: 205 }, (_, i) => option(`School ${i}`));
  const shown = renderedSelectOptions(rows, "School 204");
  assert.equal(shown.length, 200);
  assert.equal(shown[199].value, "School 204");
  assert.equal(reconcileActiveIndex(shown, null, "School 204"), 199);
  assert.equal(renderedSelectOptions(filterSelectOptions(rows, "School 1"), "School 204").some(row => row.value === "School 204"), false);
  assert.deepEqual(renderedSelectOptions([], "School 204"), []);
});

test("active rows reconcile by value through reordered, removed, and empty options", () => {
  const rows = [option("A"), option("B"), option("C")];
  assert.equal(reconcileActiveIndex([...rows].reverse(), "A", "B"), 2);
  assert.equal(reconcileActiveIndex(rows.slice(1), "A", "B"), 0);
  assert.equal(reconcileActiveIndex(rows.slice(1), "A", "missing"), 0);
  assert.equal(reconcileActiveIndex([], "A", "B"), -1);
  assert.equal(reconcileActiveIndex([{ value: "", label: "All" }, ...rows], "", "B"), 0);
});

test("typeahead builds case-insensitive prefixes and expires after 500 ms", () => {
  const rows = ["Apple", "Apricot", "Banana", "Blueberry"].map(option);
  const first = selectTypeahead(rows, 0, "B", { text: "", time: 0 }, 1000);
  assert.equal(first.index, 2);
  const prefix = selectTypeahead(rows, first.index, "L", first, 1100);
  assert.equal(prefix.index, 3);
  assert.equal(selectTypeahead(rows, prefix.index, "a", prefix, 1600).index, 0);
  assert.equal(selectTypeahead(rows, 1, "z", { text: "", time: 0 }, 1000).index, 1);
  assert.equal(selectTypeahead([], -1, "a", { text: "", time: 0 }, 1000).index, -1);
});

test("repeated typeahead letters cycle matching rows and wrap", () => {
  const rows = ["Apple", "Apricot", "Banana"].map(option);
  const first = selectTypeahead(rows, 0, "a", { text: "", time: 0 }, 1000);
  assert.equal(first.index, 1);
  const second = selectTypeahead(rows, first.index, "a", first, 1100);
  assert.equal(second.index, 0);
  assert.equal(selectTypeahead(rows, second.index, "a", second, 1200).index, 1);
});
