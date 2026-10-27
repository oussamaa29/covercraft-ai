import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resolveOAuthUser, type OAuthProfile } from "@/lib/oauth";
import { db } from "@/lib/db";
import { truncateAll } from "../test-db";

const profile = (over: Partial<OAuthProfile> = {}): OAuthProfile => ({
  provider: "GITHUB",
  providerAccountId: "gh-1",
  email: "new@example.com",
  emailVerified: true,
  name: "New Person",
  image: "https://avatars.example/new.png",
  ...over,
});

const pwUser = (email = "pw@example.com", extra: { image?: string } = {}) =>
  db.user.create({ data: { email, name: "Pw User", password: "$2a$10$notarealhash", ...extra } });

/** A password-less user who signed up with Google (identity g-0). */
const oauthOnlyUser = (email = "oauth@example.com", extra: { image?: string } = {}) =>
  db.user.create({
    data: {
      email,
      name: "OAuth User",
      password: null,
      ...extra,
      accounts: { create: { provider: "GOOGLE", providerAccountId: "g-0", email } },
    },
  });

beforeEach(async () => {
  await truncateAll(db);
});
afterAll(async () => {
  await db.$disconnect();
});

describe("resolveOAuthUser — sign-up / sign-in", () => {
  it("creates a password-less user + account for a brand-new verified identity", async () => {
    const r = await resolveOAuthUser(profile());
    expect(r.ok && r.outcome).toBe("created");
    if (!r.ok) return;
    expect(r.user).toMatchObject({
      email: "new@example.com",
      name: "New Person",
      password: null,
      image: "https://avatars.example/new.png",
      plan: "FREE",
      sessionVersion: 0,
    });
    const accounts = await db.account.findMany({ where: { userId: r.user.id } });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ provider: "GITHUB", providerAccountId: "gh-1", email: "new@example.com" });
  });

  it("falls back to the email local-part for the name and caps it at 80 chars", async () => {
    const a = await resolveOAuthUser(profile({ name: null, email: "jane.doe@example.com" }));
    expect(a.ok && a.user.name).toBe("jane.doe");
    const b = await resolveOAuthUser(
      profile({ providerAccountId: "gh-2", name: "x".repeat(120), email: "long@example.com" })
    );
    expect(b.ok && b.user.name.length).toBe(80);
  });

  it("an existing identity signs into its user, even if the provider email changed", async () => {
    const first = await resolveOAuthUser(profile());
    const again = await resolveOAuthUser(profile({ email: "changed@example.com", emailVerified: false }));
    expect(again.ok && again.outcome).toBe("signed_in");
    expect(again.ok && first.ok && again.user.id).toBe(first.ok && first.user.id);
    expect(await db.user.count()).toBe(1);
  });

  it("auto-links a verified email into an existing password-less user (case-insensitive)", async () => {
    const existing = await oauthOnlyUser("oauth@example.com");
    const r = await resolveOAuthUser(
      profile({ provider: "GITHUB", providerAccountId: "gh-1", email: "  OAUTH@Example.COM " })
    );
    expect(r.ok && r.outcome).toBe("auto_linked");
    expect(r.ok && r.user.id).toBe(existing.id);
    // Adopts the avatar because the user had none.
    expect(r.ok && r.user.image).toBe("https://avatars.example/new.png");
    expect(await db.account.count({ where: { userId: existing.id } })).toBe(2);
    expect(await db.user.count()).toBe(1);
  });

  it("a verified email owned by a PASSWORD user → email_in_use, nothing linked", async () => {
    const existing = await pwUser("pw@example.com");
    const r = await resolveOAuthUser(
      profile({ provider: "GOOGLE", providerAccountId: "g-1", email: "PW@example.com" })
    );
    expect(r).toEqual({ ok: false, error: "email_in_use" });
    expect(await db.account.count({ where: { userId: existing.id } })).toBe(0);
    expect(await db.user.count()).toBe(1);
  });

  it("auto-link never overwrites an avatar the user already has", async () => {
    const existing = await oauthOnlyUser("oauth@example.com", { image: "https://mine.example/me.png" });
    const r = await resolveOAuthUser(profile({ email: "oauth@example.com" }));
    expect(r.ok && r.user.image).toBe("https://mine.example/me.png");
    const fresh = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(fresh.image).toBe("https://mine.example/me.png");
  });

  it("refuses to auto-link an unverified email (account takeover guard)", async () => {
    const existing = await oauthOnlyUser("victim@example.com");
    const r = await resolveOAuthUser(profile({ email: "victim@example.com", emailVerified: false }));
    expect(r).toEqual({ ok: false, error: "email_unverified" });
    expect(await db.account.count({ where: { userId: existing.id } })).toBe(1);

    const pw = await pwUser("victim2@example.com");
    const r2 = await resolveOAuthUser(
      profile({ providerAccountId: "gh-2", email: "victim2@example.com", emailVerified: false })
    );
    expect(r2.ok).toBe(false);
    expect(["email_unverified", "email_in_use"]).toContain(!r2.ok && r2.error);
    expect(await db.account.count({ where: { userId: pw.id } })).toBe(0);
  });

  it("refuses to create a user from an unverified or missing email", async () => {
    expect(await resolveOAuthUser(profile({ emailVerified: false }))).toEqual({
      ok: false,
      error: "email_unverified",
    });
    expect(await resolveOAuthUser(profile({ email: null }))).toEqual({ ok: false, error: "email_missing" });
    expect(await resolveOAuthUser(profile({ email: "   " }))).toEqual({ ok: false, error: "email_missing" });
    expect(await db.user.count()).toBe(0);
    expect(await db.account.count()).toBe(0);
  });

  it("auto-link is refused when the user already has a different identity from that provider", async () => {
    const existing = await oauthOnlyUser("oauth@example.com");
    await db.account.create({
      data: { userId: existing.id, provider: "GITHUB", providerAccountId: "gh-old", email: "oauth@example.com" },
    });
    const r = await resolveOAuthUser(profile({ providerAccountId: "gh-new", email: "oauth@example.com" }));
    expect(r).toEqual({ ok: false, error: "provider_already_linked" });
    expect(await db.account.count()).toBe(2);
  });
});

describe("resolveOAuthUser — linking (intent=link)", () => {
  it("attaches a new identity to the signed-in user, whatever email the provider reports", async () => {
    const me = await pwUser("me@example.com");
    const r = await resolveOAuthUser(
      profile({ email: "different@example.com", emailVerified: false }),
      { linkToUserId: me.id }
    );
    expect(r.ok && r.outcome).toBe("linked");
    expect(r.ok && r.user.id).toBe(me.id);
    const acc = await db.account.findFirstOrThrow({ where: { userId: me.id } });
    expect(acc).toMatchObject({ provider: "GITHUB", providerAccountId: "gh-1", email: "different@example.com" });
    // The provider email doesn't create or touch any other user.
    expect(await db.user.count()).toBe(1);
  });

  it("works with no provider email at all", async () => {
    const me = await pwUser("me@example.com");
    const r = await resolveOAuthUser(profile({ email: null, emailVerified: false }), { linkToUserId: me.id });
    expect(r.ok && r.outcome).toBe("linked");
  });

  it("account_in_use when the identity belongs to another user", async () => {
    const owner = await resolveOAuthUser(profile());
    const me = await pwUser("me@example.com");
    const r = await resolveOAuthUser(profile(), { linkToUserId: me.id });
    expect(r).toEqual({ ok: false, error: "account_in_use" });
    const acc = await db.account.findFirstOrThrow({ where: { providerAccountId: "gh-1" } });
    expect(acc.userId).toBe(owner.ok && owner.user.id);
  });

  it("re-linking your own identity is a harmless no-op", async () => {
    const me = await pwUser("me@example.com");
    await resolveOAuthUser(profile(), { linkToUserId: me.id });
    const r = await resolveOAuthUser(profile(), { linkToUserId: me.id });
    expect(r.ok && r.outcome).toBe("linked");
    expect(await db.account.count()).toBe(1);
  });

  it("provider_already_linked when you already have another identity from that provider", async () => {
    const me = await pwUser("me@example.com");
    await resolveOAuthUser(profile({ providerAccountId: "gh-a" }), { linkToUserId: me.id });
    const r = await resolveOAuthUser(profile({ providerAccountId: "gh-b" }), { linkToUserId: me.id });
    expect(r).toEqual({ ok: false, error: "provider_already_linked" });
    expect(await db.account.count()).toBe(1);
  });

  it("can link one Google and one GitHub identity to the same user", async () => {
    const me = await pwUser("me@example.com");
    const a = await resolveOAuthUser(profile({ provider: "GITHUB" }), { linkToUserId: me.id });
    const b = await resolveOAuthUser(profile({ provider: "GOOGLE", providerAccountId: "g-9" }), { linkToUserId: me.id });
    expect(a.ok && b.ok).toBe(true);
    expect(await db.account.count({ where: { userId: me.id } })).toBe(2);
  });

  it("login_required when the target user no longer exists", async () => {
    const r = await resolveOAuthUser(profile(), { linkToUserId: "cl_does_not_exist" });
    expect(r).toEqual({ ok: false, error: "login_required" });
    expect(await db.user.count()).toBe(0);
  });
});

describe("resolveOAuthUser — races (P2002)", () => {
  it("parallel first sign-ins of the same identity yield one user and one account", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => resolveOAuthUser(profile())));
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(results.map((r) => (r.ok ? r.user.id : null)));
    expect(ids.size).toBe(1);
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(1);
  });

  it("parallel auto-links of the same identity yield one account", async () => {
    const existing = await oauthOnlyUser("oauth@example.com");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => resolveOAuthUser(profile({ email: "oauth@example.com" })))
    );
    expect(results.every((r) => r.ok && r.user.id === existing.id)).toBe(true);
    expect(await db.account.count({ where: { provider: "GITHUB" } })).toBe(1);
  });

  it("parallel sign-ups with two different identities sharing one email don't crash", async () => {
    const [a, b] = await Promise.all([
      resolveOAuthUser(profile({ provider: "GITHUB", providerAccountId: "gh-x", email: "same@example.com" })),
      resolveOAuthUser(profile({ provider: "GOOGLE", providerAccountId: "g-x", email: "same@example.com" })),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(await db.user.count()).toBe(1);
    expect(await db.account.count()).toBe(2);
  });
});
