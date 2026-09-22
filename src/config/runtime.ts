const disabledValues = new Set(["0", "false", "no", "off"]);

/**
 * Seeded records are an explicit development aid. They are never enabled by
 * default and cannot be enabled in a production build.
 */
export const developmentFixturesEnabled =
  import.meta.env.DEV &&
  !disabledValues.has(String(import.meta.env.VITE_ENABLE_DEV_FIXTURES ?? "").toLowerCase());

export const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export const apiConfigured = apiBaseUrl.length > 0;

export const runtimeEnvironment = import.meta.env.PROD ? "production" : import.meta.env.MODE;
