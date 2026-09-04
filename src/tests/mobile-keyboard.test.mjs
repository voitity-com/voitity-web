import assert from "node:assert/strict";
import test from "node:test";

import {
  getMobileComposerInset,
  getMobileKeyboardFallbackInset,
  getMobileKeyboardInset,
} from "../src/lib/mobile-keyboard.ts";

test("detects an overlay keyboard from the stable viewport", () => {
  assert.equal(getMobileKeyboardInset(844, 500), 344);
});

test("does not report a keyboard when the stable viewport is already compact", () => {
  assert.equal(getMobileKeyboardInset(500, 500), 0);
});

test("accounts for a visual viewport that was panned", () => {
  assert.equal(getMobileKeyboardInset(844, 500, 44), 300);
});

test("ignores browser chrome changes below the keyboard threshold", () => {
  assert.equal(getMobileKeyboardInset(844, 790), 0);
});

test("returns zero after the viewport recovers", () => {
  assert.equal(getMobileKeyboardInset(844, 844), 0);
});

test("uses a bounded fallback for embedded browsers without viewport events", () => {
  assert.equal(getMobileKeyboardFallbackInset(667), 280);
  assert.equal(getMobileKeyboardFallbackInset(844), 354);
  assert.equal(getMobileKeyboardFallbackInset(1200), 380);
  assert.equal(getMobileKeyboardFallbackInset(390), 230);
});

test("ignores invalid fallback measurements", () => {
  assert.equal(getMobileKeyboardFallbackInset(Number.NaN), 0);
});

test("positions the composer for an overlay keyboard", () => {
  assert.equal(getMobileComposerInset(844, 500), 344);
});

test("does not double-offset a resized layout viewport", () => {
  assert.equal(getMobileComposerInset(500, 500), 0);
});
