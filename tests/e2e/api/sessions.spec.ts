import {
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
  userByEmail,
} from "../fixtures";

async function twoDevices() {
  const a = await newApi();
  const { email } = await register(a);
  const b = await newApi();
  expect((await login(b, email)).status()).toBe(200);
  const tokenA = (await sessionCookie(a))!;
  const tokenB = (await sessionCookie(b))!;
  return { a, b, email, tokenA, tokenB };
}

const authed = async (ctx: Awaited<ReturnType<typeof newApi>>) => (await ctx.get("/api/generate")).status();

test("sign out of all other devices: kills other cookies, keeps (re-issues) the acting one", async () => {
  const { a, b, email, tokenA } = await twoDevices();
  expect(await authed(a)).toBe(200);
  expect(await authed(b)).toBe(200);

  const res = await send(a, "POST", "/api/account/sessions/revoke");
  expect(res.status()).toBe(200);
  const reissued = setCookies(res).find((c) => c.name === "cc_session");
  expect(reissued && !isClearing(reissued)).toBe(true);
  expect(reissued!.value).not.toBe(tokenA);

  expect(await authed(a)).toBe(200);
  expect(await authed(b)).toBe(401);
  // A's pre-revocation token is dead too (only the re-issued one works).
  expect(await authed(await apiWithCookie(tokenA))).toBe(401);
  expect((await userByEmail(email)).sessionVersion).toBe(1);
});

test("password change kills other sessions, keeps the acting one, swaps the password", async () => {
  const { a, b, email, tokenA } = await twoDevices();
  const res = await send(a, "POST", "/api/account/password", {
    currentPassword: PASSWORD,
    newPassword: "brand-new-pass-99",
  });
  expect(res.status(), await res.text()).toBe(200);
  expect(await authed(a)).toBe(200);
  expect(await authed(b)).toBe(401);
  expect(await authed(await apiWithCookie(tokenA))).toBe(401);

  expect((await login(await newApi(), email, PASSWORD)).status()).toBe(401);
  expect((await login(await newApi(), email, "brand-new-pass-99")).status()).toBe(200);
});

test("stale cookie on /dashboard ends on /login, logged out, without a redirect loop", async () => {
  const { a, b } = await twoDevices();
  await send(a, "POST", "/api/account/sessions/revoke");

  const hops: string[] = [];
  let url = "/dashboard";
  for (let i = 0; i < 6; i++) {
    const res = await b.get(url, { maxRedirects: 0 });
    hops.push(`${res.status()} ${url}`);
    const loc = locationOf(res);
    if (!loc) {
      expect(res.status()).toBe(200);
      break;
    }
    url = loc;
  }
  expect(hops.length, hops.join(" → ")).toBeLessThanOrEqual(4);
  expect(url).toBe("/login?next=%2Fdashboard");
  expect(await sessionCookie(b)).toBeUndefined(); // cleared by /api/auth/session/expired
  // And /login now renders instead of bouncing back to /dashboard.
  expect((await b.get("/login", { maxRedirects: 0 })).status()).toBe(200);
});

test("stale cookie that first hits /login also settles on /login (no loop)", async () => {
  const { a, b } = await twoDevices();
  await send(a, "POST", "/api/account/sessions/revoke");
  const res = await b.get("/login"); // follows redirects (Playwright caps at 20)
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).pathname).toBe("/login");
  expect(await sessionCookie(b)).toBeUndefined();
});

test("cookie for a deleted user behaves like a stale one", async () => {
  const ctx = await apiWithCookie(await mintToken("cl_deleted_user_id"));
  const res = await ctx.get("/dashboard/settings");
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).pathname + new URL(res.url()).search).toBe("/login?next=%2Fdashboard%2Fsettings");
});

test("session/expired leaves a still-valid session alone (not a cross-site logout link)", async ({ api }) => {
  await register(api);
  const res = await api.get("/api/auth/session/expired?next=%2Fdashboard%2Fbilling", { maxRedirects: 0 });
  expect(locationOf(res)).toBe("/dashboard/billing");
  expect(setCookies(res).find((c) => c.name === "cc_session")).toBeUndefined();
  expect(await authed(api)).toBe(200);
});

test("a token minted with an old sessionVersion is rejected after one bump", async ({ api }) => {
  const { email } = await register(api);
  const user = await userByEmail(email);
  await db().user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  expect(await authed(await apiWithCookie(await mintToken(user.id, 0)))).toBe(401);
  expect(await authed(await apiWithCookie(await mintToken(user.id, 1)))).toBe(200);
});
