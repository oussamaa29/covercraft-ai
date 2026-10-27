import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  createAuthorizationUrl,
  enabledProviders,
  isProviderEnabled,
  isProviderSlug,
  redirectUri,
} from "@/lib/oauth";
import { configuredAppUrl, siteUrl } from "@/lib/site";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

function setCreds(google: boolean, github: boolean) {
  vi.stubEnv("GOOGLE_CLIENT_ID", google ? "gid" : "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", google ? "gsecret" : "");
  vi.stubEnv("GITHUB_CLIENT_ID", github ? "hid" : "");
  vi.stubEnv("GITHUB_CLIENT_SECRET", github ? "hsecret" : "");
}

beforeEach(() => vi.stubEnv("APP_URL", "http://localhost:3000"));
afterEach(() => vi.unstubAllEnvs());

describe("provider config", () => {
  it("only accepts the two known slugs", () => {
    expect(isProviderSlug("google")).toBe(true);
    expect(isProviderSlug("github")).toBe(true);
    expect(isProviderSlug("GOOGLE")).toBe(false);
    expect(isProviderSlug("facebook")).toBe(false);
    expect(isProviderSlug("constructor")).toBe(false);
  });

  it("a provider is enabled only when both id and secret are set", () => {
    setCreds(false, false);
    expect(enabledProviders()).toEqual({ google: false, github: false });
    vi.stubEnv("GOOGLE_CLIENT_ID", "only-id");
    expect(isProviderEnabled("google")).toBe(false);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "   ");
    expect(isProviderEnabled("google")).toBe(false);
    setCreds(true, false);
    expect(enabledProviders()).toEqual({ google: true, github: false });
    setCreds(true, true);
    expect(enabledProviders()).toEqual({ google: true, github: true });
  });

  it("redirect URI comes from APP_URL, falling back to the request origin", () => {
    expect(redirectUri("google", "http://ignored.test")).toBe(
      "http://localhost:3000/api/auth/oauth/google/callback"
    );
    vi.stubEnv("APP_URL", "https://covercraft.example/some/path/");
    expect(redirectUri("github", "http://ignored.test")).toBe(
      "https://covercraft.example/api/auth/oauth/github/callback"
    );
    vi.stubEnv("APP_URL", "");
    expect(redirectUri("github", "http://req.test:4000")).toBe(
      "http://req.test:4000/api/auth/oauth/github/callback"
    );
    vi.stubEnv("APP_URL", "not a url");
    expect(configuredAppUrl()).toBeNull();
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("createAuthorizationUrl", () => {
  it("Google: client_id, redirect_uri, scopes, state and PKCE S256", () => {
    setCreds(true, true);
    const { url, state, codeVerifier } = createAuthorizationUrl("google", "http://ignored.test");
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("client_id")).toBe("gid");
    expect(p.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/google/callback");
    expect(p.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);
    expect(p.get("state")).toBe(state);
    expect(state.length).toBeGreaterThanOrEqual(20);
    expect(codeVerifier).toBeTruthy();
    expect(p.get("code_challenge_method")).toBe("S256");
    const expectedChallenge = createHash("sha256").update(codeVerifier!).digest("base64url");
    expect(p.get("code_challenge")).toBe(expectedChallenge);
    expect(url.toString()).not.toContain("gsecret");
  });

  it("GitHub: client_id, redirect_uri, scopes, state, no PKCE", () => {
    setCreds(true, true);
    const { url, state, codeVerifier } = createAuthorizationUrl("github", "http://ignored.test");
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe("hid");
    expect(p.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/github/callback");
    expect(p.get("scope")?.split(" ").sort()).toEqual(["read:user", "user:email"]);
    expect(p.get("state")).toBe(state);
    expect(codeVerifier).toBeNull();
    expect(p.has("code_challenge")).toBe(false);
    expect(url.toString()).not.toContain("hsecret");
  });

  it("state is random per call", () => {
    setCreds(true, true);
    const a = createAuthorizationUrl("github", "http://x");
    const b = createAuthorizationUrl("github", "http://x");
    expect(a.state).not.toBe(b.state);
  });

  it("throws (never builds a URL) for an unconfigured provider", () => {
    setCreds(false, false);
    expect(() => createAuthorizationUrl("google", "http://x")).toThrow();
    expect(() => createAuthorizationUrl("github", "http://x")).toThrow();
  });
});

describe("robots.ts / sitemap.ts", () => {
  it("robots disallows /dashboard and /api and points at the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(expect.arrayContaining(["/dashboard", "/api"]));
    expect(r.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("sitemap lists only public pages", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000",
        "http://localhost:3000/pricing",
        "http://localhost:3000/login",
        "http://localhost:3000/register",
        "http://localhost:3000/privacy",
        "http://localhost:3000/terms",
      ])
    );
    for (const u of urls) {
      expect(u).not.toMatch(/\/(dashboard|api)(\/|$)/);
    }
  });
});
