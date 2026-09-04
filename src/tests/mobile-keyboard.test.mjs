import assert from "node:assert/strict";
import test from "node:test";

import { getMobileKeyboardInset } from "../src/lib/mobile-keyboard.ts";

test("detects a keyboard that overlays the visual viewport", () => {
  assert.equal(getMobileKeyboardInset(844, 500, 0), 344);
});

test("does not add an offset when the browser resizes the layout viewport", () => {
  assert.equal(getMobileKeyboardInset(500, 500, 0), 0);
});

test("accounts for a visual viewport shifted by browser chrome", () => {
  assert.equal(getMobileKeyboardInset(844, 500, 44), 300);
});

test("never returns a negative keyboard offset", () => {
  assert.equal(getMobileKeyboardInset(500, 540, 0), 0);
});
