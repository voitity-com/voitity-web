import assert from "node:assert/strict";
import test from "node:test";

import { getMobileComposerShift } from "../src/lib/mobile-keyboard.ts";

test("lifts a composer that would be covered by an overlay keyboard", () => {
  assert.equal(getMobileComposerShift(834, 500), -344);
});

test("keeps an already visible composer in its natural position", () => {
  assert.equal(getMobileComposerShift(470, 500), 0);
});

test("respects a custom bottom gap", () => {
  assert.equal(getMobileComposerShift(490, 500, 20), -10);
});

test("ignores invalid viewport measurements", () => {
  assert.equal(getMobileComposerShift(Number.NaN, 500), 0);
});
