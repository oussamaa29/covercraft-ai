const FALLBACK_URL = "http://localhost:3000";

/**
 * Public base URL of the app (no trailing slash), from APP_URL. Returns null
 * when it's unset or malformed so callers can fall back to the request origin.
 */
export function configuredAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** Base URL for absolute links in metadata, robots.txt and the sitemap. */
export function siteUrl(): string {
  return configuredAppUrl() ?? FALLBACK_URL;
}
