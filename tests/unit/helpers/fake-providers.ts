import { vi } from "vitest";

export interface Recorded {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

type Route = (req: Recorded) => Response | Promise<Response>;

/**
 * Replaces global fetch with a tiny router so arctic's token exchange and the
 * GitHub API calls can be answered locally. Unrouted URLs fail loudly.
 */
export function mockFetch(routes: Record<string, Route>) {
  const calls: Recorded[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    const rec: Recorded = {
      url: req.url,
      method: req.method,
      headers: new Headers(init?.headers ?? req.headers),
      body: req.body ? await req.clone().text() : "",
    };
    calls.push(rec);
    const key = Object.keys(routes).find((k) => rec.url.split("?")[0] === k);
    if (!key) throw new Error(`Unexpected fetch to ${rec.url}`);
    return routes[key](rec);
  });
  return { calls, spy };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** An unsigned JWT is fine: the app only decodes the ID token. */
export function fakeIdToken(claims: Record<string, unknown>) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: "https://accounts.google.com", aud: "gid", exp: 9999999999, iat: 1, ...claims })}.c2ln`;
}

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";
export const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

export function googleRoutes(claims: Record<string, unknown>): Record<string, Route> {
  return {
    [GOOGLE_TOKEN_URL]: () =>
      json({ access_token: "ya29.fake", token_type: "Bearer", expires_in: 3600, id_token: fakeIdToken(claims) }),
  };
}

export function githubRoutes(
  user: Record<string, unknown>,
  emails: unknown[] | { status: number }
): Record<string, Route> {
  return {
    [GITHUB_TOKEN_URL]: () => json({ access_token: "gho_fake", token_type: "bearer", scope: "read:user,user:email" }),
    [GITHUB_USER_URL]: () => json(user),
    [GITHUB_EMAILS_URL]: () =>
      Array.isArray(emails) ? json(emails) : json({ message: "nope" }, emails.status),
  };
}
