import { test as base, expect, request as pwRequest, type APIRequestContext, type APIResponse } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { DEMO_URL, OAUTH_URL, TEST_AUTH_SECRET, TEST_DATABASE_URL } from "../test-env";

export { expect };
export { DEMO_URL, OAUTH_URL };

let seq = 0;
const rand = () => Math.random().toString(36).slice(2, 8);

/** Unique per call, so parallel tests never collide on users. */
export function uniqueEmail(tag = "u") {
  return `${tag}-${Date.now().toString(36)}-${(++seq).toString(36)}-${rand()}@example.com`;
}

/** Every test gets its own client IP so the DB-backed rate limiter can't bleed between tests. */
export function randomIp() {
  const n = () => Math.floor(Math.random() * 254) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

export const PASSWORD = "correct-horse-42";

export const JSON_HEADERS = { "content-type": "application/json" };

export const LETTER = {
  candidateName: "Ada Tester",
  jobTitle: "Platform Engineer",
  company: "Northwind Labs",
  jobDescription: "We need someone to own our Kubernetes platform and developer tooling end to end.",
  background: "Five years running Kubernetes at scale.",
  tone: "CONFIDENT",
};

export async function newApi(baseURL = DEMO_URL, ip = randomIp()) {
  return pwRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
}

/** JSON body on every mutating call: the CSRF guard requires application/json. */
export function send(
  api: APIRequestContext,
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  data: unknown = {},
  extra: { headers?: Record<string, string>; maxRedirects?: number } = {}
) {
  return api.fetch(url, {
    method,
    data: JSON.stringify(data),
    headers: { ...JSON_HEADERS, ...extra.headers },
    maxRedirects: extra.maxRedirects,
  });
}

export async function register(api: APIRequestContext, over: Partial<{ name: string; email: string; password: string }> = {}) {
  const body = { name: "E2E User", email: uniqueEmail(), password: PASSWORD, ...over };
  const res = await send(api, "POST", "/api/auth/register", body);
  expect(res.status(), await res.text()).toBe(200);
  return body;
}

export async function login(api: APIRequestContext, email: string, password = PASSWORD) {
  return send(api, "POST", "/api/auth/login", { email, password });
}

export async function sessionCookie(api: APIRequestContext) {
  const { cookies } = await api.storageState();
  return cookies.find((c) => c.name === "cc_session")?.value;
}

/** Signs a session token like the app does — for stale / forged cookie tests. */
export async function mintToken(userId: string, sessionVersion = 0) {
  return new SignJWT({ userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(TEST_AUTH_SECRET));
}

/** A context that only carries the given raw session cookie. */
export async function apiWithCookie(token: string, baseURL = DEMO_URL) {
  return pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": randomIp(), cookie: `cc_session=${token}` },
  });
}

/** Parsed Set-Cookie headers of one response. */
export function setCookies(res: APIResponse) {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => {
      const [pair, ...attrs] = h.value.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const map = new Map<string, string>();
      for (const a of attrs) {
        const i = a.indexOf("=");
        map.set((i < 0 ? a : a.slice(0, i)).toLowerCase(), i < 0 ? "" : a.slice(i + 1));
      }
      return { name: pair.slice(0, eq), value: pair.slice(eq + 1), attrs: map, raw: h.value };
    });
}

/** True when a Set-Cookie clears the cookie (empty value / Max-Age=0 / past Expires). */
export function isClearing(c: ReturnType<typeof setCookies>[number]) {
  const expires = c.attrs.get("expires");
  return (
    c.value === "" ||
    c.attrs.get("max-age") === "0" ||
    (expires !== undefined && new Date(expires).getTime() < Date.now())
  );
}

export function locationOf(res: APIResponse, base = DEMO_URL) {
  const loc = res.headers()["location"];
  if (!loc) return null;
  const u = new URL(loc, base);
  return u.origin === new URL(base).origin ? u.pathname + u.search : u.toString();
}

let prisma: PrismaClient | null = null;
export function db() {
  prisma ??= new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  return prisma;
}

export async function userByEmail(email: string) {
  return db().user.findUniqueOrThrow({ where: { email } });
}

type Fixtures = { api: APIRequestContext; ip: string };

export const test = base.extend<Fixtures>({
  ip: async ({}, use) => {
    await use(randomIp());
  },
  // Fresh cookie jar + fresh client IP per test.
  api: async ({ ip }, use) => {
    const ctx = await newApi(DEMO_URL, ip);
    await use(ctx);
    await ctx.dispose();
  },
  // Browser contexts get their own IP too (register is limited to 5/hour/IP).
  context: async ({ context, ip }, use) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
    await use(context);
  },
});
