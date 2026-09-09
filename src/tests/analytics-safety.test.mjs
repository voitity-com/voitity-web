import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSafePageLocation,
  sanitizeEventParameters,
  sanitizePublicPath,
  shouldEnableGoogleAnalytics,
} from "../src/lib/google-analytics.ts";

const previousWindow = globalThis.window;

test.before(() => {
  globalThis.window = {
    location: {
      origin: "https://bigmelo.com",
    },
  };
});

test.after(() => {
  if (previousWindow === undefined) {
    delete globalThis.window;
    return;
  }

  globalThis.window = previousWindow;
});

test("sanitizes public paths without exposing profile aliases", () => {
  assert.equal(sanitizePublicPath("/"), "/");
  assert.equal(sanitizePublicPath("/landing/homev01"), "/");
  assert.equal(sanitizePublicPath("/bigsofia"), "/profile/:alias");
});

test("keeps controlled attribution slugs in safe page locations", () => {
  const location = new URL(buildSafePageLocation(
    "/landing/homev01",
    "?utm_source=instagram&utm_campaign=lanzamiento_2026",
  ));

  assert.equal(location.origin, "https://bigmelo.com");
  assert.equal(location.pathname, "/");
  assert.equal(location.searchParams.get("utm_source"), "instagram");
  assert.equal(location.searchParams.get("utm_campaign"), "lanzamiento_2026");
});

test("drops unsafe or oversized attribution values", () => {
  const oversizedValue = "a".repeat(101);
  const location = new URL(buildSafePageLocation(
    "/landing/homev01",
    `?utm_source=social+media&utm_campaign=person%40example.com&utm_content=${oversizedValue}&gclid=click_id-123`,
  ));

  assert.equal(location.searchParams.has("utm_source"), false);
  assert.equal(location.searchParams.has("utm_campaign"), false);
  assert.equal(location.searchParams.has("utm_content"), false);
  assert.equal(location.searchParams.get("gclid"), "click_id-123");
});

test("enables analytics only for approved production hosts outside landing demos", () => {
  assert.equal(shouldEnableGoogleAnalytics({ hostname: "bigmelo.com", isProduction: true, search: "" }), true);
  assert.equal(shouldEnableGoogleAnalytics({ hostname: "app.bigmelo.com", isProduction: true, search: "" }), true);
  assert.equal(shouldEnableGoogleAnalytics({ hostname: "bigmelo.com", isProduction: true, search: "?landing_demo=1" }), false);
  assert.equal(shouldEnableGoogleAnalytics({ hostname: "preview.example.com", isProduction: true, search: "" }), false);
  assert.equal(shouldEnableGoogleAnalytics({ hostname: "localhost", isProduction: true, search: "" }), false);
  assert.equal(shouldEnableGoogleAnalytics({ hostname: "bigmelo.com", isProduction: false, search: "" }), false);
});

test("keeps only GA-safe event names and values", () => {
  assert.deepEqual(sanitizeEventParameters({
    billing_cycle: "month",
    consented: true,
    email: "person@example.com",
    invalid_key_with_more_than_forty_characters_total: "value",
    message: "Call me tomorrow",
    trial_days: 7,
  }), {
    billing_cycle: "month",
    consented: true,
    trial_days: 7,
  });
});
