import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SUPABASE_RUNTIME_CONFIG,
  getSupabaseRuntimeConfig,
} from "../assets/supabase-config.js";

describe("Supabase runtime config", () => {
  it("keeps source defaults disabled until deployment supplies browser-safe values", () => {
    assert.deepEqual(getSupabaseRuntimeConfig(SUPABASE_RUNTIME_CONFIG), {
      configured: false,
      publishableKey: null,
      url: null,
    });
  });

  it("accepts an HTTPS project URL and modern publishable key", () => {
    assert.deepEqual(
      getSupabaseRuntimeConfig({
        publishableKey: " sb_publishable_example ",
        url: " https://example.supabase.co ",
      }),
      {
        configured: true,
        publishableKey: "sb_publishable_example",
        url: "https://example.supabase.co",
      },
    );
  });

  it("rejects invalid or non-publishable client config values", () => {
    assert.throws(
      () =>
        getSupabaseRuntimeConfig({
          publishableKey: "sb_publishable_example",
          url: "http://example.supabase.co",
        }),
      /https/i,
    );
    assert.throws(
      () =>
        getSupabaseRuntimeConfig({
          publishableKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          url: "https://example.supabase.co",
        }),
      /publishable key/i,
    );
    assert.throws(
      () =>
        getSupabaseRuntimeConfig({
          publishableKey: "sb_secret_example",
          url: "https://example.supabase.co",
        }),
      /publishable key/i,
    );
  });
});
