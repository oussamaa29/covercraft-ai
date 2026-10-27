import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOAuthProfile } from "@/lib/oauth";
import {
  GITHUB_EMAILS_URL,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  GOOGLE_TOKEN_URL,
  githubRoutes,
  googleRoutes,
  json,
  mockFetch,
} from "./helpers/fake-providers";

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsecret");
  vi.stubEnv("GITHUB_CLIENT_ID", "hid");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "hsecret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchOAuthProfile — Google", () => {
  it("normalizes ID-token claims and sends the PKCE verifier", async () => {
    const { calls } = mockFetch(
      googleRoutes({
        sub: "g-123",
        email: "  Ada@Example.COM ",
        email_verified: true,
        name: "  Ada Lovelace ",
        picture: "https://lh3.googleusercontent.com/a/pic",
      })
    );
    const profile = await fetchOAuthProfile("google", "the-code", "the-verifier", "http://x");
    expect(profile).toEqual({
      provider: "GOOGLE",
      providerAccountId: "g-123",
      email: "ada@example.com",
      emailVerified: true,
      name: "Ada Lovelace",
      image: "https://lh3.googleusercontent.com/a/pic",
    });
    const body = new URLSearchParams(calls[0].body);
    expect(calls[0].url).toBe(GOOGLE_TOKEN_URL);
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe("the-verifier");
    expect(body.get("redirect_uri")).toBe("http://localhost:3000/api/auth/oauth/google/callback");
  });

  it('treats email_verified "true" as verified and anything else as unverified', async () => {
    mockFetch(googleRoutes({ sub: "1", email: "a@b.co", email_verified: "true" }));
    expect((await fetchOAuthProfile("google", "c", "v", "http://x")).emailVerified).toBe(true);
    vi.restoreAllMocks();
    mockFetch(googleRoutes({ sub: "1", email: "a@b.co", email_verified: false }));
    expect((await fetchOAuthProfile("google", "c", "v", "http://x")).emailVerified).toBe(false);
    vi.restoreAllMocks();
    mockFetch(googleRoutes({ sub: "1", email: "a@b.co" }));
    expect((await fetchOAuthProfile("google", "c", "v", "http://x")).emailVerified).toBe(false);
  });

  it("drops non-https avatars and missing emails", async () => {
    mockFetch(googleRoutes({ sub: "1", picture: "http://insecure.test/p.png" }));
    const p = await fetchOAuthProfile("google", "c", "v", "http://x");
    expect(p.image).toBeNull();
    expect(p.email).toBeNull();
    expect(p.name).toBeNull();
  });

  it("refuses to run without a PKCE verifier", async () => {
    mockFetch(googleRoutes({ sub: "1" }));
    await expect(fetchOAuthProfile("google", "c", null, "http://x")).rejects.toThrow();
  });

  it("propagates a token-endpoint error (callback turns it into oauth_failed)", async () => {
    mockFetch({ [GOOGLE_TOKEN_URL]: () => json({ error: "invalid_grant" }, 400) });
    await expect(fetchOAuthProfile("google", "c", "v", "http://x")).rejects.toThrow();
  });
});

describe("fetchOAuthProfile — GitHub", () => {
  const ghUser = { id: 4242, login: "octo", name: null, email: "public@octo.dev", avatar_url: "https://avatars.githubusercontent.com/u/4242" };

  it("uses the primary + verified address from /user/emails and sends a User-Agent", async () => {
    const { calls } = mockFetch(
      githubRoutes(ghUser, [
        { email: "other@octo.dev", primary: false, verified: true },
        { email: "Primary@Octo.dev", primary: true, verified: true },
      ])
    );
    const p = await fetchOAuthProfile("github", "code", null, "http://x");
    expect(p).toEqual({
      provider: "GITHUB",
      providerAccountId: "4242",
      email: "primary@octo.dev",
      emailVerified: true,
      name: "octo",
      image: "https://avatars.githubusercontent.com/u/4242",
    });
    const api = calls.filter((c) => c.url === GITHUB_USER_URL || c.url === GITHUB_EMAILS_URL);
    expect(api).toHaveLength(2);
    for (const c of api) {
      expect(c.headers.get("user-agent")).toBeTruthy();
      expect(c.headers.get("authorization")).toBe("Bearer gho_fake");
    }
    expect(calls.find((c) => c.url === GITHUB_TOKEN_URL)).toBeDefined();
  });

  it("an unverified primary email is reported as unverified", async () => {
    mockFetch(githubRoutes(ghUser, [{ email: "p@octo.dev", primary: true, verified: false }]));
    const p = await fetchOAuthProfile("github", "code", null, "http://x");
    expect(p.email).toBe("p@octo.dev");
    expect(p.emailVerified).toBe(false);
  });

  it("falls back to the public email, unverified, when /user/emails is refused", async () => {
    mockFetch(githubRoutes({ ...ghUser, name: "  The Octocat " }, { status: 403 }));
    const p = await fetchOAuthProfile("github", "code", null, "http://x");
    expect(p.email).toBe("public@octo.dev");
    expect(p.emailVerified).toBe(false);
    expect(p.name).toBe("The Octocat");
  });

  it("throws when /user fails", async () => {
    mockFetch({ ...githubRoutes(ghUser, []), [GITHUB_USER_URL]: () => json({ message: "Bad credentials" }, 401) });
    await expect(fetchOAuthProfile("github", "code", null, "http://x")).rejects.toThrow();
  });
});
