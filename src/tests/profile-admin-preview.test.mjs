import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAdminProfilePreview } from "../src/lib/profile-api.ts";

test("preserves the selected template when an admin preview profile contains profile data", () => {
  const preview = normalizeAdminProfilePreview(
    {
      avatar: null,
      preview: {
        interactive: true,
        is_published: true,
      },
      profile: {
        alias: "test-test",
        appearance: {
          background_image_url: null,
          background_type: "css",
          has_background_image: false,
          template_key: "profile05",
        },
        data: {
          me: {
            description: "Knowledge source content",
          },
        },
        description: "Profile description",
        id: 38,
        locale: "es",
        name: "Test",
      },
      social_networks: {},
    },
    "fallback-alias",
  );

  assert.ok(preview);
  assert.equal(preview.profile.alias, "test-test");
  assert.equal(preview.profile.name, "Test");
  assert.equal(preview.profile.description, "Profile description");
  assert.equal(preview.profile.appearance.templateKey, "profile05");
});
