export const SUPABASE_RUNTIME_CONFIG = Object.freeze({
  publishableKey: "",
  url: "",
});

export function getSupabaseRuntimeConfig(config = SUPABASE_RUNTIME_CONFIG) {
  const url = normaliseString(config?.url);
  const publishableKey = normaliseString(config?.publishableKey);

  if (url === "" && publishableKey === "") {
    return {
      configured: false,
      publishableKey: null,
      url: null,
    };
  }

  if (!isValidHttpsUrl(url)) {
    throw new Error("Supabase URL must be an HTTPS URL.");
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Supabase client config requires a publishable key.");
  }

  return {
    configured: true,
    publishableKey,
    url,
  };
}

function normaliseString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
