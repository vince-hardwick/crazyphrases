import {
  createAccountShell,
  createSignedOutShell,
} from "./account-shell.js?v=__ASSET_VERSION__";

export function createSupabaseAuthSession({
  location = globalThis.location,
  prepareAuthRedirect = () => {},
  profileRepository = null,
  supabase,
} = {}) {
  if (!supabase?.auth || typeof supabase.auth.getUser !== "function") {
    throw new Error("A Supabase Auth client is required.");
  }

  return {
    async loadAccountShell() {
      const response = await supabase.auth.getUser();

      if (isMissingSessionError(response?.error)) {
        return createSignedOutShell();
      }

      assertNoAuthError(response, "Could not load signed-in Account");

      const user = response.data?.user;

      if (!user) {
        return createSignedOutShell();
      }

      const account = {
        id: user.id,
      };
      const email = profileRepository ? normaliseAuthEmail(user.email) : null;
      const profile = profileRepository
        ? await profileRepository.ensureOwnProfile({
            accountId: account.id,
            email,
          })
        : null;

      return createAccountShell({
        account,
        profile,
      });
    },

    async signInWithGoogle() {
      prepareAuthRedirect();

      const response = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAppRootUrl(location),
        },
      });

      assertNoAuthError(response, "Could not start Google sign-in");
      return response.data;
    },

    async sendEmailMagicLink({ email }) {
      const normalisedEmail = normaliseEmail(email);

      prepareAuthRedirect();

      const response = await supabase.auth.signInWithOtp({
        email: normalisedEmail,
        options: {
          emailRedirectTo: getAppRootUrl(location),
        },
      });

      assertNoAuthError(response, "Could not send sign-in email");
      return response.data;
    },

    async signOut() {
      const response = await supabase.auth.signOut();
      assertNoAuthError(response, "Could not sign out");
    },
  };
}

function assertNoAuthError(response, message) {
  if (response?.error) {
    const detail =
      typeof response.error.message === "string"
        ? response.error.message
        : "Supabase Auth request failed.";
    throw new Error(`${message}: ${detail}`);
  }
}

function isMissingSessionError(error) {
  return (
    error?.name === "AuthSessionMissingError" ||
    error?.message === "Auth session missing!"
  );
}

function getAppRootUrl(location) {
  return new URL("/", location?.href).href;
}

function normaliseEmail(email) {
  const normalised = String(email ?? "").trim();

  if (normalised === "") {
    throw new Error("An email address is required.");
  }

  return normalised;
}

function normaliseAuthEmail(email) {
  const normalised = String(email ?? "").trim();

  if (normalised === "") {
    throw new Error("A usable Auth email is required.");
  }

  return normalised;
}
