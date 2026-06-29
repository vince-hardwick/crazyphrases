import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createSignedInRouteHandoff } from "../assets/signed-in-route-handoff.js";

describe("signed-in route handoff", () => {
  it("preserves an allowlisted route until a valid Account session consumes it", () => {
    const storage = createMemoryStorage();
    const handoff = createSignedInRouteHandoff({
      allowedRoutes: ["#/favourites"],
      now: () => 1000,
      storage,
      ttlMs: 10_000,
    });

    assert.equal(handoff.preserve("#/favourites"), true);
    assert.equal(handoff.consume({ hasAccountSession: false }), null);
    assert.equal(handoff.consume({ hasAccountSession: true }), "#/favourites");
    assert.equal(handoff.consume({ hasAccountSession: true }), null);
  });

  it("rejects unsupported destinations and clears an existing request", () => {
    const storage = createMemoryStorage();
    const handoff = createSignedInRouteHandoff({
      allowedRoutes: ["#/favourites", "#/play/multiplayer"],
      key: "handoff",
      now: () => 1000,
      storage,
      ttlMs: 10_000,
    });

    assert.equal(handoff.preserve("#/favourites"), true);

    assert.equal(handoff.preserve(""), false);
    assert.equal(handoff.consume({ hasAccountSession: true }), null);

    assert.equal(handoff.preserve("#/play/solo"), false);
    assert.equal(handoff.consume({ hasAccountSession: true }), null);

    assert.equal(handoff.preserve("https://evil.example/#/favourites"), false);
    assert.equal(storage.getItem("handoff"), null);
  });

  it("clears malformed or tampered stored requests without redirecting", () => {
    const storage = createMemoryStorage();
    const handoff = createSignedInRouteHandoff({
      allowedRoutes: ["#/favourites"],
      key: "handoff",
      now: () => 1000,
      storage,
      ttlMs: 10_000,
    });

    storage.setItem("handoff", "{not-json");
    assert.equal(handoff.consume({ hasAccountSession: true }), null);
    assert.equal(storage.getItem("handoff"), null);

    storage.setItem(
      "handoff",
      JSON.stringify({
        createdAt: 1000,
        route: "#/play/solo",
      }),
    );
    assert.equal(handoff.consume({ hasAccountSession: true }), null);
    assert.equal(storage.getItem("handoff"), null);
  });

  it("expires stale requests before they can be consumed", () => {
    let currentTime = 1000;
    const storage = createMemoryStorage();
    const handoff = createSignedInRouteHandoff({
      allowedRoutes: ["#/play/multiplayer"],
      key: "handoff",
      now: () => currentTime,
      storage,
      ttlMs: 10_000,
    });

    assert.equal(handoff.preserve("#/play/multiplayer"), true);

    currentTime = 11_001;

    assert.equal(handoff.consume({ hasAccountSession: true }), null);
    assert.equal(storage.getItem("handoff"), null);
  });

  it("clears a preserved request explicitly", () => {
    const storage = createMemoryStorage();
    const handoff = createSignedInRouteHandoff({
      allowedRoutes: ["#/favourites"],
      key: "handoff",
      now: () => 1000,
      storage,
      ttlMs: 10_000,
    });

    assert.equal(handoff.preserve("#/favourites"), true);

    handoff.clear();

    assert.equal(handoff.consume({ hasAccountSession: true }), null);
    assert.equal(storage.getItem("handoff"), null);
  });

  it("fails closed when storage is unavailable", () => {
    const handoff = createSignedInRouteHandoff({
      allowedRoutes: ["#/favourites"],
    });

    assert.equal(handoff.preserve("#/favourites"), false);
    assert.equal(handoff.consume({ hasAccountSession: true }), null);
  });
});

function createMemoryStorage() {
  const entries = new Map();

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    removeItem(key) {
      entries.delete(key);
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
  };
}
