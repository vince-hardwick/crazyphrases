const DEFAULT_KEY = "crazyphrases.signedInRouteHandoff.v1";
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function createSignedInRouteHandoff({
  allowedRoutes,
  isAllowedRoute,
  key = DEFAULT_KEY,
  now = () => Date.now(),
  storage,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const routeAllowlist = new Set(allowedRoutes ?? []);

  function routeIsAllowed(route) {
    if (typeof route !== "string") {
      return false;
    }

    if (routeAllowlist.has(route)) {
      return true;
    }

    try {
      return Boolean(isAllowedRoute?.(route));
    } catch {
      return false;
    }
  }

  function clear() {
    try {
      storage?.removeItem(key);
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }

  function readEntry() {
    let rawEntry = null;

    try {
      rawEntry = storage?.getItem(key) ?? null;
    } catch {
      return null;
    }

    if (!rawEntry) {
      return null;
    }

    try {
      const entry = JSON.parse(rawEntry);
      if (
        !routeIsAllowed(entry?.route) ||
        !Number.isFinite(entry?.createdAt)
      ) {
        clear();
        return null;
      }

      if (now() - entry.createdAt > ttlMs) {
        clear();
        return null;
      }

      return entry;
    } catch {
      clear();
      return null;
    }
  }

  return {
    clear,
    consume({ hasAccountSession } = {}) {
      const entry = readEntry();

      if (!entry || !hasAccountSession) {
        return null;
      }

      clear();
      return entry.route;
    },
    preserve(route) {
      if (!routeIsAllowed(route)) {
        clear();
        return false;
      }

      if (typeof storage?.setItem !== "function") {
        clear();
        return false;
      }

      try {
        storage.setItem(
          key,
          JSON.stringify({
            createdAt: now(),
            route,
          }),
        );
        return true;
      } catch {
        clear();
        return false;
      }
    },
  };
}
