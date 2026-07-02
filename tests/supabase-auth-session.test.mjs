import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createSupabaseAuthSession } from "../assets/supabase-auth-session.js";

describe("Supabase Auth session", () => {
  it("maps Supabase Auth user state to the account shell", async () => {
    const signedOutSession = createSupabaseAuthSession({
      supabase: createFakeSupabaseAuthClient({ user: null }),
    });
    const signedInSession = createSupabaseAuthSession({
      supabase: createFakeSupabaseAuthClient({
        user: {
          id: "auth-user-123",
          email: "private@example.com",
        },
      }),
    });

    assert.equal((await signedOutSession.loadAccountShell()).mode, "anonymous-solo");

    const shell = await signedInSession.loadAccountShell();
    assert.equal(shell.mode, "signed-in");
    assert.equal(shell.accountId, "auth-user-123");
    assert.equal(shell.persistenceAuthority.accountId, "auth-user-123");
    assert.equal(JSON.stringify(shell).includes("private@example.com"), false);
  });

  it("hydrates the account shell from a durable Account Profile repository", async () => {
    const calls = [];
    const session = createSupabaseAuthSession({
      profileRepository: {
        async ensureOwnProfile({ accountId, email }) {
          calls.push({
            method: "ensureOwnProfile",
            accountId,
            email,
          });
          return {
            profileId: "profile-directory-1",
            gamerTag: "Captain Spoon",
            avatarKey: "moon",
          };
        },
      },
      supabase: createFakeSupabaseAuthClient({
        user: {
          id: "auth-user-456",
          email: "private@example.com",
        },
      }),
    });

    const shell = await session.loadAccountShell();

    assert.deepEqual(calls, [
      {
        method: "ensureOwnProfile",
        accountId: "auth-user-456",
        email: "private@example.com",
      },
    ]);
    assert.equal(shell.accountId, "auth-user-456");
    assert.deepEqual(shell.profile, {
      profileId: "profile-directory-1",
      gamerTag: "Captain Spoon",
      avatar: {
        type: "built-in",
        key: "yin-yang",
      },
      avatarKey: "yin-yang",
    });
    assert.equal(JSON.stringify(shell).includes("private@example.com"), false);
  });

  it("fails closed before profile hydration when Auth has no usable email", async () => {
    const calls = [];
    const session = createSupabaseAuthSession({
      profileRepository: {
        async ensureOwnProfile(request) {
          calls.push(request);
          return null;
        },
      },
      supabase: createFakeSupabaseAuthClient({
        user: {
          id: "auth-user-without-email",
          email: "   ",
        },
      }),
    });

    await assert.rejects(
      () => session.loadAccountShell(),
      /A usable Auth email is required/,
    );
    assert.deepEqual(calls, []);
  });

  it("starts Google and email sign-in with the app root redirect URL", async () => {
    const calls = [];
    const session = createSupabaseAuthSession({
      location: {
        href: "https://dev.crazyphrases.com/play?debug=1",
      },
      supabase: createFakeSupabaseAuthClient({
        calls,
        user: null,
      }),
    });

    await session.signInWithGoogle();
    await session.sendEmailMagicLink({ email: " player@example.com " });

    assert.deepEqual(calls, [
      {
        method: "signInWithOAuth",
        request: {
          provider: "google",
          options: {
            redirectTo: "https://dev.crazyphrases.com/",
          },
        },
      },
      {
        method: "signInWithOtp",
        request: {
          email: "player@example.com",
          options: {
            emailRedirectTo: "https://dev.crazyphrases.com/",
          },
        },
      },
    ]);
  });

  it("prepares the requested destination before hosted Auth redirects", async () => {
    const calls = [];
    const session = createSupabaseAuthSession({
      location: {
        href: "https://dev.crazyphrases.com/#/favourites",
      },
      prepareAuthRedirect() {
        calls.push({
          method: "prepareAuthRedirect",
        });
      },
      supabase: createFakeSupabaseAuthClient({
        calls,
        user: null,
      }),
    });

    await session.signInWithGoogle();
    await session.sendEmailMagicLink({ email: "player@example.com" });

    assert.deepEqual(calls, [
      {
        method: "prepareAuthRedirect",
      },
      {
        method: "signInWithOAuth",
        request: {
          provider: "google",
          options: {
            redirectTo: "https://dev.crazyphrases.com/",
          },
        },
      },
      {
        method: "prepareAuthRedirect",
      },
      {
        method: "signInWithOtp",
        request: {
          email: "player@example.com",
          options: {
            emailRedirectTo: "https://dev.crazyphrases.com/",
          },
        },
      },
    ]);
  });

  it("does not prepare an Auth redirect when email input is invalid", async () => {
    const calls = [];
    const session = createSupabaseAuthSession({
      prepareAuthRedirect() {
        calls.push({
          method: "prepareAuthRedirect",
        });
      },
      supabase: createFakeSupabaseAuthClient({
        calls,
        user: null,
      }),
    });

    await assert.rejects(
      () => session.sendEmailMagicLink({ email: "   " }),
      /An email address is required/,
    );
    assert.deepEqual(calls, []);
  });

  it("signs out through Supabase Auth", async () => {
    const calls = [];
    const session = createSupabaseAuthSession({
      supabase: createFakeSupabaseAuthClient({
        calls,
        user: {
          id: "auth-user-123",
        },
      }),
    });

    await session.signOut();

    assert.deepEqual(calls, [
      {
        method: "signOut",
      },
    ]);
  });
});

function createFakeSupabaseAuthClient({ calls = [], user }) {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user,
          },
          error: null,
        };
      },
      async signInWithOAuth(request) {
        calls.push({
          method: "signInWithOAuth",
          request,
        });
        return {
          data: {},
          error: null,
        };
      },
      async signInWithOtp(request) {
        calls.push({
          method: "signInWithOtp",
          request,
        });
        return {
          data: {},
          error: null,
        };
      },
      async signOut() {
        calls.push({
          method: "signOut",
        });
        return {
          error: null,
        };
      },
    },
  };
}
