import assert from "node:assert/strict";
import test from "node:test";
import { getComboboxPosition } from "./comboboxPosition.ts";

test("opens below an input when there is room", () => {
  const menu = getComboboxPosition({ top: 100, bottom: 144, left: 40, width: 300 }, { top: 0, left: 0, width: 1440, height: 900 });
  assert.equal(menu.top, 148);
  assert.equal(menu.maxHeight, 208);
  assert.equal(menu.transform, undefined);
});

test("opens above an input when a mobile keyboard reduces the viewport", () => {
  const menu = getComboboxPosition({ top: 300, bottom: 344, left: 16, width: 358 }, { top: 0, left: 0, width: 390, height: 360 });
  assert.equal(menu.top, 296);
  assert.equal(menu.transform, "translateY(-100%)");
  assert.equal(menu.maxHeight, 208);
});

test("clamps a wide menu to the visible viewport after zooming", () => {
  const menu = getComboboxPosition({ top: 230, bottom: 274, left: 0, width: 400 }, { top: 200, left: 40, width: 280, height: 200 });
  assert.equal(menu.left, 48);
  assert.equal(menu.width, 264);
  assert.equal(menu.maxHeight, 114);
});

test("menu height cannot be negative in a collapsed viewport", () => {
  const menu = getComboboxPosition({ top: 0, bottom: 44, left: 0, width: 300 }, { top: 0, left: 0, width: 320, height: 40 });
  assert.equal(menu.maxHeight, 0);
});
