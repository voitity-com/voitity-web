import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldEnableTrainerTikTokPixel,
  TRAINER_TIKTOK_PIXEL_ID,
} from "../src/lib/tiktok-pixel-config.ts";

const productionLanding = {
  hostname: "bigmelo.com",
  isProduction: true,
  pathname: "/landing/entrenadores",
  search: "",
};

test("uses the configured TikTok Pixel identifier", () => {
  assert.equal(TRAINER_TIKTOK_PIXEL_ID, "DAQ31ORC77U4UMHB35GG");
});

test("enables TikTok Pixel only on the canonical production trainer landing", () => {
  assert.equal(shouldEnableTrainerTikTokPixel(productionLanding), true);
  assert.equal(shouldEnableTrainerTikTokPixel({ ...productionLanding, pathname: "/landing/entrenadores/" }), true);
  assert.equal(shouldEnableTrainerTikTokPixel({ ...productionLanding, hostname: "localhost" }), false);
  assert.equal(shouldEnableTrainerTikTokPixel({ ...productionLanding, isProduction: false }), false);
  assert.equal(shouldEnableTrainerTikTokPixel({ ...productionLanding, pathname: "/landing/entrenadorv51" }), false);
  assert.equal(shouldEnableTrainerTikTokPixel({ ...productionLanding, pathname: "/" }), false);
  assert.equal(shouldEnableTrainerTikTokPixel({ ...productionLanding, search: "?landing_demo=1" }), false);
});
