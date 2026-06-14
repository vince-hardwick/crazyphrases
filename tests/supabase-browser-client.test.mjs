import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createBrowserSupabaseClient } from "../assets/supabase-browser-client.js";

describe("browser Supabase client", () => {
  it("stays disabled without browser-safe runtime config", async () => {
    let attemptedLoad = false;

    const client = await createBrowserSupabaseClient({
      config: {
        publishableKey: "",
        url: "",
      },
      loadSupabaseLibrary: async () => {
        attemptedLoad = true;
        throw new Error("should not load Supabase JS");
      },
    });

    assert.equal(client, null);
    assert.equal(attemptedLoad, false);
  });

  it("creates a client from browser-safe runtime config", async () => {
    const createdClients = [];

    const client = await createBrowserSupabaseClient({
      config: {
        publishableKey: "sb_publishable_example",
        url: "https://example.supabase.co",
      },
      loadSupabaseLibrary: async () => ({
        createClient(url, publishableKey) {
          const createdClient = { publishableKey, url };
          createdClients.push(createdClient);
          return createdClient;
        },
      }),
    });

    assert.deepEqual(client, {
      publishableKey: "sb_publishable_example",
      url: "https://example.supabase.co",
    });
    assert.deepEqual(createdClients, [client]);
  });
});
