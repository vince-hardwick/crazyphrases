import { getSupabaseRuntimeConfig } from "./supabase-config.js?v=__ASSET_VERSION__";

const SUPABASE_JS_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

export async function createBrowserSupabaseClient({
  config,
  loadSupabaseLibrary = loadSupabaseJsFromCdn,
} = {}) {
  const runtimeConfig = getSupabaseRuntimeConfig(config);

  if (!runtimeConfig.configured) {
    return null;
  }

  const supabaseLibrary = await loadSupabaseLibrary();

  if (typeof supabaseLibrary?.createClient !== "function") {
    throw new Error("Supabase JS did not expose createClient.");
  }

  return supabaseLibrary.createClient(
    runtimeConfig.url,
    runtimeConfig.publishableKey,
  );
}

async function loadSupabaseJsFromCdn({
  document = globalThis.document,
  global = globalThis,
} = {}) {
  if (typeof global.supabase?.createClient === "function") {
    return global.supabase;
  }

  if (!document?.head) {
    throw new Error("A browser document is required to load Supabase JS.");
  }

  await appendSupabaseScript({ document });

  if (typeof global.supabase?.createClient !== "function") {
    throw new Error("Supabase JS failed to initialise.");
  }

  return global.supabase;
}

function appendSupabaseScript({ document }) {
  const existingScript = document.querySelector("script[data-supabase-js]");

  if (existingScript) {
    return waitForScript(existingScript);
  }

  const script = document.createElement("script");
  script.src = SUPABASE_JS_CDN_URL;
  script.async = true;
  script.dataset.supabaseJs = "true";
  document.head.append(script);

  return waitForScript(script);
}

function waitForScript(script) {
  if (script.dataset.loaded === "true") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error("Could not load Supabase JS.")),
      { once: true },
    );
  });
}
