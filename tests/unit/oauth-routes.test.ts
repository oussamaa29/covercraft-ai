// Drives the real OAuth route handlers with a fake cookie store and a fake
// provider (global fetch), covering the success paths an HTTP test can't
// reach without real Google/GitHub credentials.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", async () => (await import("./helpers/cookie-jar")).nextHeadersMock);

import { GET as start } from "@/app/api/auth/oauth/[provider]/route";
import { GET as callback } from "@/app/api/auth/oauth/[provider]/callback/route";
import { SESSION_COOKIE, signSessionToken, verifySessionToken } from "@/lib/auth";
import { OAUTH_COOKIES } from "@/lib/oauth";
import { db } from "@/lib/db";
import { truncateAll } from "../test-db";
import { jar, lastSet, resetJar } from "./helpers/cookie-jar";
import { GITHUB_TOKEN_URL, githubRoutes, googleRoutes, json, mockFetch } from "./helpers/fake-providers";

const ORIGIN = "http://localhost:3000";
const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });
const req = (path: string) => new NextRequest(`${ORIGIN}${path}`);
const location = (res: Response) => {
  const loc = res.headers.get("location");
  if (!loc) throw new Error(`no Location header (status ${res.status})`);
  const u = new URL(loc, ORIGIN);
  return u.origin === ORIGIN ? u.pathname + u.search : u.toString();
};

const ghUser = { id: 777, login: "octo", name: "Octo Cat", email: null, avatar_url: "https://avatars.githubusercontent.com/u/777" };
const ghEmails = [{ email: "octo@example.com", primary: true, verified: true }];

function oauthCookies(over: Partial<Record<keyof typeof OAUTH_COOKIES, string>> = {}) {
  const base = { state: "state-abc", intent: "login", next: "/dashboard", ...over };
  return Object.fromEntries(
    Object.entries(base)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [OAUTH_COOKIES[k as keyof typeof OAUTH_COOKIES], v as string])
  );
}

beforeEach(async () => {
  resetJar();
  await truncateAll(db);
  vi.stubEnv("APP_URL", ORIGIN);
  vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsecret");
  vi.stubEnv("GITHUB_CLIENT_ID", "hid");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "hsecret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await db.$disconnect();
});

describe("GET /api/auth/oauth/[provider] (start)", () => {
  it("GitHub: redirects to the authorize URL and stores state/next/intent in scoped cookies", async () => {
    const res = await start(req("/api/auth/oauth/github?next=%2Fdashboard%2Fbilling%3Fcheckout%3DPRO"), ctx("github"));
    expect([302, 303, 307]).toContain(res.status);
    const url = new URL(res.headers.get("location")!);
    expect(url.host).toBe("github.com");
    const state = lastSet(OAUTH_COOKIES.state)!;
    expect(url.searchParams.get("state")).toBe(state.value);
    expect(lastSet(OAUTH_COOKIES.next)!.value).toBe("/dashboard/billing?checkout=PRO");
    expect(lastSet(OAUTH_COOKIES.intent)!.value).toBe("login");
    expect(lastSet(OAUTH_COOKIES.verifier)).toBeUndefined();
    for (const name of [OAUTH_COOKIES.state, OAUTH_COOKIES.next, OAUTH_COOKIES.intent]) {
      expect(lastSet(name)!.options).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth/oauth",
        maxAge: 600,
      });
    }
  });

  it("Google: also stores the PKCE verifier", async () => {
    const res = await start(req("/api/auth/oauth/google"), ctx("google"));
    const url = new URL(res.headers.get("location")!);
    expect(url.host).toBe("accounts.google.com");
    expect(lastSet(OAUTH_COOKIES.verifier)?.value).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "/\t/evil.com"])(
    "sanitizes next=%j to /dashboard",
    async (bad) => {
      await start(req(`/api/auth/oauth/github?next=${encodeURIComponent(bad)}`), ctx("github"));
      expect(lastSet(OAUTH_COOKIES.next)!.value).toBe("/dashboard");
    }
  );

  it("unknown provider → 404", async () => {
    const res = await start(req("/api/auth/oauth/facebook"), ctx("facebook"));
    expect(res.status).toBe(404);
    expect(jar.sets).toHaveLength(0);
  });

  it("disabled provider → back to /login (or settings for link) with provider_disabled", async () => {
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    expect(location(await start(req("/api/auth/oauth/github"), ctx("github")))).toBe(
      "/login?error=provider_disabled"
    );
    expect(location(await start(req("/api/auth/oauth/github?intent=link"), ctx("github")))).toBe(
      "/dashboard/settings?error=provider_disabled"
    );
    expect(jar.sets).toHaveLength(0);
  });

  it("intent=link without a session → login_required; with one → next forced to settings", async () => {
    expect(location(await start(req("/api/auth/oauth/github?intent=link"), ctx("github")))).toBe(
      "/login?error=login_required&next=%2Fdashboard%2Fsettings"
    );
    const user = await db.user.create({ data: { email: "me@example.com", name: "Me", password: "x" } });
    resetJar({ [SESSION_COOKIE]: await signSessionToken({ userId: user.id, sessionVersion: 0 }) });
    await start(req("/api/auth/oauth/github?intent=link&next=%2Fdashboard%2Fbilling"), ctx("github"));
    expect(lastSet(OAUTH_COOKIES.intent)!.value).toBe("link");
    expect(lastSet(OAUTH_COOKIES.next)!.value).toBe("/dashboard/settings");
  });
});

describe("GET /api/auth/oauth/[provider]/callback", () => {
  it("GitHub sign-up: creates the user, sets the session cookie, redirects to next, clears oauth cookies", async () => {
    mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar(oauthCookies({ next: "/dashboard/billing?checkout=PRO" }));
    const res = await callback(req("/api/auth/oauth/github/callback?code=c0de&state=state-abc"), ctx("github"));

    expect(location(res)).toBe("/dashboard/billing?checkout=PRO");
    const session = lastSet(SESSION_COOKIE);
    expect(session).toBeDefined();
    const payload = await verifySessionToken(session!.value);
    const user = await db.user.findUniqueOrThrow({ where: { email: "octo@example.com" }, include: { accounts: true } });
    expect(payload?.userId).toBe(user.id);
    expect(user).toMatchObject({ name: "Octo Cat", password: null, image: ghUser.avatar_url });
    expect(user.accounts).toMatchObject([{ provider: "GITHUB", providerAccountId: "777" }]);

    const deleted = new Map(jar.deletes.map((d) => [d.name, d.path]));
    for (const name of Object.values(OAUTH_COOKIES)) {
      expect(deleted.get(name)).toBe("/api/auth/oauth");
    }
  });

  it("Google sign-in uses the stored verifier and defaults next to /dashboard", async () => {
    const { calls } = mockFetch(
      googleRoutes({ sub: "g-1", email: "g@example.com", email_verified: true, name: "Gee" })
    );
    resetJar(oauthCookies({ next: undefined, verifier: "my-verifier" }));
    const res = await callback(req("/api/auth/oauth/google/callback?code=c&state=state-abc"), ctx("google"));
    expect(location(res)).toBe("/dashboard");
    expect(new URLSearchParams(calls[0].body).get("code_verifier")).toBe("my-verifier");
    expect(lastSet(SESSION_COOKIE)).toBeDefined();
  });

  it("re-sanitizes a tampered next cookie", async () => {
    mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar(oauthCookies({ next: "//evil.com" }));
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/dashboard");
  });

  it.each([
    ["mismatched state", "?code=c&state=WRONG", oauthCookies()],
    ["missing state param", "?code=c", oauthCookies()],
    ["missing code", "?state=state-abc", oauthCookies()],
    ["no state cookie", "?code=c&state=state-abc", oauthCookies({ state: undefined })],
    ["empty state on both sides", "?code=c&state=", oauthCookies({ state: "" })],
  ])("%s → /login?error=invalid_state, no provider call, no session", async (_label, qs, cookies) => {
    const { spy } = mockFetch({});
    resetJar(cookies);
    const res = await callback(req(`/api/auth/oauth/github/callback${qs}`), ctx("github"));
    expect(location(res)).toBe("/login?error=invalid_state");
    expect(spy).not.toHaveBeenCalled();
    expect(lastSet(SESSION_COOKIE)).toBeUndefined();
  });

  it("state is one-shot: replaying the same callback fails", async () => {
    mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar(oauthCookies());
    await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    jar.values.delete(SESSION_COOKIE);
    const again = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(again)).toBe("/login?error=invalid_state");
  });

  it("provider error=access_denied → oauth_denied; other errors → oauth_failed (no provider text leaked)", async () => {
    resetJar(oauthCookies());
    const denied = await callback(
      req("/api/auth/oauth/github/callback?error=access_denied&error_description=The+user+said+no&state=state-abc"),
      ctx("github")
    );
    expect(location(denied)).toBe("/login?error=oauth_denied");
    resetJar(oauthCookies());
    const other = await callback(
      req("/api/auth/oauth/github/callback?error=server_error&error_description=secret+stuff&state=state-abc"),
      ctx("github")
    );
    expect(location(other)).toBe("/login?error=oauth_failed");
  });

  it("?error= is only trusted after the state checks out (forged error links → invalid_state)", async () => {
    resetJar(oauthCookies());
    const noState = await callback(req("/api/auth/oauth/github/callback?error=access_denied"), ctx("github"));
    expect(location(noState)).toBe("/login?error=invalid_state");
    resetJar(oauthCookies());
    const wrongState = await callback(
      req("/api/auth/oauth/github/callback?error=access_denied&state=WRONG"),
      ctx("github")
    );
    expect(location(wrongState)).toBe("/login?error=invalid_state");
  });

  it("token exchange failure → oauth_failed and nothing from the provider in the URL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch({ [GITHUB_TOKEN_URL]: () => json({ error: "bad_verification_code", error_description: "SECRET-DETAIL" }) });
    resetJar(oauthCookies());
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/login?error=oauth_failed");
    expect(res.headers.get("location")).not.toContain("SECRET");
    expect(lastSet(SESSION_COOKIE)).toBeUndefined();
  });

  it("unverified email matching an existing password-less user → email_unverified, no link", async () => {
    await db.user.create({ data: { email: "octo@example.com", name: "Victim", password: null } });
    mockFetch(githubRoutes(ghUser, [{ email: "octo@example.com", primary: true, verified: false }]));
    resetJar(oauthCookies());
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/login?error=email_unverified");
    expect(await db.account.count()).toBe(0);
  });

  it("verified email that belongs to a password user → /login?error=email_in_use, no session", async () => {
    await db.user.create({ data: { email: "octo@example.com", name: "Has Password", password: "x" } });
    mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar(oauthCookies());
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/login?error=email_in_use");
    expect(lastSet(SESSION_COOKIE)).toBeUndefined();
    expect(await db.account.count()).toBe(0);
  });

  it("link intent with a session attaches the account and lands on settings", async () => {
    const me = await db.user.create({ data: { email: "me@example.com", name: "Me", password: "x" } });
    mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar({
      ...oauthCookies({ intent: "link", next: "/dashboard/settings" }),
      [SESSION_COOKIE]: await signSessionToken({ userId: me.id, sessionVersion: 0 }),
    });
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/dashboard/settings?linked=github");
    expect(await db.account.findFirst({ where: { userId: me.id, provider: "GITHUB" } })).not.toBeNull();
    // octo@example.com did not become a separate user.
    expect(await db.user.count()).toBe(1);
  });

  it("link intent without a session → /login?error=login_required (before talking to the provider)", async () => {
    const { spy } = mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar(oauthCookies({ intent: "link" }));
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/login?error=login_required&next=%2Fdashboard%2Fsettings");
    expect(spy).not.toHaveBeenCalled();
  });

  it("link intent: identity owned by someone else → settings?error=account_in_use", async () => {
    const owner = await db.user.create({ data: { email: "owner@example.com", name: "Owner", password: "x" } });
    await db.account.create({ data: { userId: owner.id, provider: "GITHUB", providerAccountId: "777" } });
    const me = await db.user.create({ data: { email: "me@example.com", name: "Me", password: "x" } });
    mockFetch(githubRoutes(ghUser, ghEmails));
    resetJar({
      ...oauthCookies({ intent: "link" }),
      [SESSION_COOKIE]: await signSessionToken({ userId: me.id, sessionVersion: 0 }),
    });
    const res = await callback(req("/api/auth/oauth/github/callback?code=c&state=state-abc"), ctx("github"));
    expect(location(res)).toBe("/dashboard/settings?error=account_in_use");
  });

  it("disabled provider → provider_disabled; unknown provider → 404", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    resetJar(oauthCookies());
    const res = await callback(req("/api/auth/oauth/google/callback?code=c&state=state-abc"), ctx("google"));
    expect(location(res)).toBe("/login?error=provider_disabled");
    const unknown = await callback(req("/api/auth/oauth/nope/callback?code=c&state=s"), ctx("nope"));
    expect(unknown.status).toBe(404);
  });
});
