import {
  DEMO_URL,
  OAUTH_URL,
  PASSWORD,
  apiWithCookie,
  db,
  expect,
  isClearing,
  locationOf,
  login,
  mintToken,
  newApi,
  register,
  send,
  sessionCookie,
  setCookies,
  test,
  uniqueEmail,
  userByEmail,
} from "../fixtures";

test.describe("register", () => {
  test("validation errors → 400 with a readable message", async ({ api }) => {
    const cases: [unknown, RegExp][] = [
      [{ name: "A", email: uniqueEmail(), password: PASSWORD }, /name is too short/i],
      [{ name: "Ada", email: "not-an-email", password: PASSWORD }, /valid email/i],
      [{ name: "Ada", email: uniqueEmail(), password: "short" }, /8 characters/i],
      [{}, /./],
      [null, /./],
    ];
    for (const [body, msg] of cases) {
      const res = await send(api, "POST", "/api/auth/register", body);
      expect(res.status(), JSON.stringify(body)).toBe(400);
      expect((await res.json()).error).toMatch(msg);
      expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
    }
    const raw = await api.post("/api/auth/register", { data: "{not json", headers: { "content-type": "application/json" } });
    expect(raw.status()).toBe(400);
  });

  test("success → 200, user stored (lowercased, hashed), session cookie set", async ({ api }) => {
    const email = uniqueEmail("reg");
    const res = await send(api, "POST", "/api/auth/register", {
      name: "  Grace Hopper ",
      email: `  ${email.toUpperCase()} `,
      password: PASSWORD,
    });
    expect(res.status()).toBe(200);
    const cookie = setCookies(res).find((c) => c.name === "cc_session");
    expect(cookie).toBeDefined();
    expect(cookie!.attrs.has("httponly")).toBe(true);
    expect(cookie!.attrs.get("samesite")?.toLowerCase()).toBe("lax");
    expect(cookie!.attrs.get("path")).toBe("/");
    expect(cookie!.attrs.has("secure")).toBe(true); // next start = production
    expect(Number(cookie!.attrs.get("max-age"))).toBe(60 * 60 * 24 * 30);

    const user = await userByEmail(email);
    expect(user.name).toBe("Grace Hopper");
    expect(user.password).toMatch(/^\$2[aby]\$/);
    expect(user.password).not.toContain(PASSWORD);
    expect(user.plan).toBe("FREE");

    expect((await api.get("/api/generate")).status()).toBe(200);
  });

  test("duplicate email (any case) → 409", async ({ api, ip }) => {
    const { email } = await register(api);
    const other = await newApi(DEMO_URL, ip);
    const res = await send(other, "POST", "/api/auth/register", {
      name: "Copycat",
      email: email.toUpperCase(),
      password: PASSWORD,
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatch(/already exists/i);
    expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
  });

  test("rate limit: 6th registration from one IP within an hour → 429 + Retry-After", async ({ ip }) => {
    for (let i = 0; i < 5; i++) {
      const ctx = await newApi(DEMO_URL, ip);
      await register(ctx);
      await ctx.dispose();
    }
    const ctx = await newApi(DEMO_URL, ip);
    const res = await send(ctx, "POST", "/api/auth/register", { name: "Sixth", email: uniqueEmail(), password: PASSWORD });
    expect(res.status()).toBe(429);
    const retry = Number(res.headers()["retry-after"]);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(3600);
    expect((await res.json()).error).toMatch(/too many attempts/i);
    // Another IP is unaffected.
    const elsewhere = await newApi();
    await register(elsewhere);
  });
});

test.describe("login / logout", () => {
  test("wrong password, unknown email and OAuth-only user all get the same generic 401", async ({ api }) => {
    const { email } = await register(api);
    const oauthOnly = uniqueEmail("oauthonly");
    await db().user.create({
      data: {
        email: oauthOnly,
        name: "OAuth Only",
        password: null,
        accounts: { create: { provider: "GITHUB", providerAccountId: `gh-${oauthOnly}` } },
      },
    });

    const fresh = await newApi();
    const bodies = [
      await login(fresh, email, "wrong-password"),
      await login(fresh, uniqueEmail("ghost"), PASSWORD),
      await login(fresh, oauthOnly, PASSWORD),
      await login(fresh, oauthOnly, ""),
    ];
    const [wrong, unknown, oauth, empty] = bodies;
    for (const res of [wrong, unknown, oauth]) {
      expect(res.status()).toBe(401);
      expect(await res.json()).toEqual({ error: "Incorrect email or password" });
      expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
    }
    expect(empty.status()).toBe(400); // "Password is required" — validation, not a 500
  });

  test("correct credentials (email case-insensitive) → 200 + session", async ({ api }) => {
    const { email } = await register(api);
    const fresh = await newApi();
    const res = await login(fresh, ` ${email.toUpperCase()} `);
    expect(res.status()).toBe(200);
    expect(await sessionCookie(fresh)).toBeTruthy();
    expect((await fresh.get("/api/generate")).status()).toBe(200);
  });

  test("logout clears the cookie and the session stops working", async ({ api }) => {
    await register(api);
    const res = await send(api, "POST", "/api/auth/logout");
    expect(res.status()).toBe(200);
    const cleared = setCookies(res).find((c) => c.name === "cc_session");
    expect(cleared && isClearing(cleared)).toBe(true);
    expect((await api.get("/api/generate")).status()).toBe(401);
  });

  test("rate limit: 11th attempt for one IP+email in 15 min → 429 (even with the right password)", async ({ api, ip }) => {
    const { email } = await register(api);
    const attacker = await newApi(DEMO_URL, ip);
    for (let i = 0; i < 10; i++) {
      expect((await login(attacker, email, `wrong-${i}`)).status()).toBe(401);
    }
    const blocked = await login(attacker, email, PASSWORD);
    expect(blocked.status()).toBe(429);
    const retry = Number(blocked.headers()["retry-after"]);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(15 * 60);
    expect((await blocked.json()).error).toMatch(/try again in \d+ minute/i);
    expect(setCookies(blocked).find((c) => c.name === "cc_session")).toBeUndefined();

    // Key is IP+email: same IP, other email → still allowed; other IP, same email → allowed.
    expect((await login(attacker, uniqueEmail("other"), "x")).status()).toBe(401);
    const elsewhere = await newApi();
    expect((await login(elsewhere, email)).status()).toBe(200);
  });

  test("unknown emails take about as long as wrong passwords (dummy bcrypt)", async ({ api }) => {
    const { email } = await register(api);
    const time = async (e: string) => {
      const ctx = await newApi();
      const t = Date.now();
      await login(ctx, e, "wrong-password");
      const ms = Date.now() - t;
      await ctx.dispose();
      return ms;
    };
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const known: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 5; i++) {
      known.push(await time(email));
      unknown.push(await time(uniqueEmail("nobody")));
    }
    // bcrypt(10) dominates a wrong-password login; without a dummy compare an
    // unknown email answers several times faster.
    expect(median(unknown), `known=${known} unknown=${unknown}`).toBeGreaterThan(median(known) * 0.5);
  });
});

test.describe("CSRF guard on state-changing POSTs", () => {
  test("a cross-site text/plain form post to /api/auth/login does not log the victim in", async ({ api }) => {
    const { email } = await register(api);
    const victim = await newApi();
    const res = await victim.post("/api/auth/login", {
      data: JSON.stringify({ email, password: PASSWORD }),
      headers: { "content-type": "text/plain", origin: "https://evil.example" },
    });
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
  });

  test("text/plain without Origin is rejected too", async ({ api }) => {
    const { email } = await register(api);
    const res = await (await newApi()).post("/api/auth/login", {
      data: JSON.stringify({ email, password: PASSWORD }),
      headers: { "content-type": "text/plain" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
  });

  for (const origin of ["https://evil.example", "http://localhost:3000.evil.example", "null"]) {
    test(`JSON with foreign Origin ${origin} is rejected`, async ({ api }) => {
      const { email } = await register(api);
      const res = await send(await newApi(), "POST", "/api/auth/login", { email, password: PASSWORD }, { headers: { origin } });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
      expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
    });
  }

  test("same-origin Origin header is accepted (demo :3000 and oauth :3002 servers)", async ({ api }) => {
    const { email } = await register(api);
    const ok = await send(await newApi(), "POST", "/api/auth/login", { email, password: PASSWORD }, { headers: { origin: DEMO_URL } });
    expect(ok.status()).toBe(200);
    const ok2 = await send(await newApi(OAUTH_URL), "POST", "/api/auth/login", { email, password: PASSWORD }, { headers: { origin: OAUTH_URL } });
    expect(ok2.status()).toBe(200);
  });

  test("cross-site text/plain posts can't burn quota, revoke sessions, change passwords or log out", async ({ api }) => {
    const { email } = await register(api);
    const user = await userByEmail(email);
    const evil = { "content-type": "text/plain", origin: "https://evil.example" };
    const attempts = [
      ["/api/generate", JSON.stringify({ candidateName: "x", jobTitle: "Engineer", company: "Acme", jobDescription: "x".repeat(30), tone: "CONCISE" })],
      ["/api/account/sessions/revoke", ""],
      ["/api/account/password", JSON.stringify({ currentPassword: PASSWORD, newPassword: "hijacked-pass-1" })],
      ["/api/auth/logout", ""],
      ["/api/auth/register", JSON.stringify({ name: "Spam", email: uniqueEmail("spam"), password: PASSWORD })],
    ] as const;
    for (const [url, data] of attempts) {
      const res = await api.post(url, { data, headers: evil });
      expect(res.status(), url).toBeGreaterThanOrEqual(400);
      expect(res.status(), url).toBeLessThan(500);
    }
    const after = await db().user.findUniqueOrThrow({ where: { id: user.id }, include: { generations: true } });
    expect(after.generations).toHaveLength(0);
    expect(after.sessionVersion).toBe(0);
    expect(after.password).toBe(user.password);
    expect((await api.get("/api/generate")).status()).toBe(200); // still logged in
  });
});

test.describe("proxy redirects", () => {
  test("signed-out visitors are sent to /login?next=<path>", async ({ api }) => {
    for (const [path, next] of [
      ["/dashboard", "/dashboard"],
      ["/dashboard/billing", "/dashboard/billing"],
      ["/dashboard/settings", "/dashboard/settings"],
    ]) {
      const res = await api.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(locationOf(res)).toBe(`/login?next=${encodeURIComponent(next)}`);
    }
  });

  test("the query string survives the trip through /login?next=", async ({ api }) => {
    const res = await api.get("/dashboard/billing?checkout=PRO", { maxRedirects: 0 });
    expect(locationOf(res)).toBe(`/login?next=${encodeURIComponent("/dashboard/billing?checkout=PRO")}`);
  });

  test("forged / foreign-secret cookie counts as signed out", async () => {
    const forged = await apiWithCookie("eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.bogus");
    const res = await forged.get("/dashboard", { maxRedirects: 0 });
    expect(locationOf(res)).toBe("/login?next=%2Fdashboard");
  });

  test("signed-in users are bounced off /login and /register", async ({ api }) => {
    await register(api);
    for (const path of ["/login", "/register", "/login?next=%2Fdashboard%2Fsettings"]) {
      const res = await api.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(locationOf(res)).toBe("/dashboard");
    }
    expect((await api.get("/dashboard", { maxRedirects: 0 })).status()).toBe(200);
  });
});

test.describe("`next` sanitization", () => {
  const BAD = [
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "%2F%2Fevil.com",
    "%2F%5Cevil.com",
    "https%3A%2F%2Fevil.com",
    "%2F%09%2Fevil.com",
    "%252F%252Fevil.com",
    "/.//evil.com",
  ];

  test("session/expired never redirects off-site, signed in or not", async ({ api }) => {
    for (const raw of BAD) {
      const anon = await api.get(`/api/auth/session/expired?next=${raw.includes("%") ? raw : encodeURIComponent(raw)}`, {
        maxRedirects: 0,
      });
      const loc = new URL(anon.headers()["location"], DEMO_URL);
      expect(loc.origin, raw).toBe(DEMO_URL);
      expect(loc.pathname).toBe("/login");
      const next = loc.searchParams.get("next")!;
      expect(new URL(next, DEMO_URL).origin, `${raw} → next=${next}`).toBe(DEMO_URL);
      expect(next.startsWith("//") || next.startsWith("/\\")).toBe(false);
    }
    await register(api);
    for (const raw of BAD) {
      const res = await api.get(`/api/auth/session/expired?next=${raw.includes("%") ? raw : encodeURIComponent(raw)}`, {
        maxRedirects: 0,
      });
      const loc = new URL(res.headers()["location"], DEMO_URL);
      expect(loc.origin, raw).toBe(DEMO_URL);
      expect(loc.pathname.startsWith("//")).toBe(false);
    }
  });

  test("OAuth buttons on /login only ever carry a same-origin next", async () => {
    const api = await newApi(OAUTH_URL);
    for (const raw of BAD) {
      const html = await (await api.get(`/login?next=${raw.includes("%") ? raw : encodeURIComponent(raw)}`)).text();
      const hrefs = [...html.matchAll(/href="(\/api\/auth\/oauth\/(?:google|github)[^"]*)"/g)].map((m) =>
        m[1].replace(/&amp;/g, "&")
      );
      expect(hrefs.length, raw).toBe(2);
      for (const href of hrefs) {
        const next = new URL(href, OAUTH_URL).searchParams.get("next");
        expect(next ?? "/dashboard", raw).toBe("/dashboard");
      }
    }
  });

  test("the OAuth start route stores a sanitized next", async () => {
    const api = await newApi(OAUTH_URL);
    for (const raw of BAD) {
      const res = await api.get(`/api/auth/oauth/github?next=${raw.includes("%") ? raw : encodeURIComponent(raw)}`, {
        maxRedirects: 0,
      });
      const next = setCookies(res).find((c) => c.name === "cc_oauth_next");
      expect(decodeURIComponent(next!.value), raw).toBe("/dashboard");
    }
  });
});

test("stale session cookie (deleted user) on /api routes → 401, not 500", async () => {
  const token = await mintToken("cl_user_that_never_existed");
  const ctx = await apiWithCookie(token);
  expect((await ctx.get("/api/generate")).status()).toBe(401);
  expect((await send(ctx, "PATCH", "/api/account/profile", { name: "Nope" })).status()).toBe(401);
});
