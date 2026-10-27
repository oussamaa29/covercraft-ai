import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

vi.mock("next/headers", async () => (await import("./helpers/cookie-jar")).nextHeadersMock);

import {
  SESSION_COOKIE,
  createSession,
  getCurrentUser,
  hashPassword,
  requireUser,
  rotateSessions,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { truncateAll } from "../test-db";
import { jar, lastSet, resetJar } from "./helpers/cookie-jar";

const mkUser = () => db.user.create({ data: { email: "a@example.com", name: "Ada", password: null } });

beforeEach(async () => {
  resetJar();
  await truncateAll(db);
});
afterAll(async () => {
  await db.$disconnect();
});

describe("password hashing", () => {
  it("hashes with bcrypt and verifies", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips userId + sessionVersion", async () => {
    const token = await signSessionToken({ userId: "u1", sessionVersion: 3 });
    expect(await verifySessionToken(token)).toEqual({ userId: "u1", sessionVersion: 3 });
  });

  it("rejects tampered, foreign-secret and expired tokens", async () => {
    const token = await signSessionToken({ userId: "u1", sessionVersion: 0 });
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ userId: "admin", sv: 0 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`)).toBeNull();
    expect(await verifySessionToken(`${h}.${p}.${s.slice(0, -2)}xx`)).toBeNull();
    const foreign = await new SignJWT({ userId: "u1", sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("some-other-secret"));
    expect(await verifySessionToken(foreign)).toBeNull();
    const expired = await new SignJWT({ userId: "u1", sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    expect(await verifySessionToken(expired)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
  });

  it("legacy tokens without `sv` count as version 0", async () => {
    const legacy = await new SignJWT({ userId: "u1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    expect(await verifySessionToken(legacy)).toEqual({ userId: "u1", sessionVersion: 0 });
  });
});

describe("createSession / getCurrentUser / sessionVersion", () => {
  it("createSession sets an httpOnly, lax, 30-day cookie on /", async () => {
    const user = await mkUser();
    await createSession(user);
    const set = lastSet(SESSION_COOKIE)!;
    expect(set.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    expect(await getCurrentUser()).toMatchObject({ id: user.id });
  });

  it("no cookie / bad cookie / deleted user → null", async () => {
    expect(await getCurrentUser()).toBeNull();
    resetJar({ [SESSION_COOKIE]: "nope" });
    expect(await getCurrentUser()).toBeNull();
    resetJar({ [SESSION_COOKIE]: await signSessionToken({ userId: "gone", sessionVersion: 0 }) });
    expect(await getCurrentUser()).toBeNull();
  });

  it("rotateSessions kills older cookies but re-issues a working one", async () => {
    const user = await mkUser();
    const oldToken = await signSessionToken({ userId: user.id, sessionVersion: 0 });
    resetJar({ [SESSION_COOKIE]: oldToken });
    expect(await getCurrentUser()).not.toBeNull();

    await rotateSessions(user.id);
    const fresh = lastSet(SESSION_COOKIE)!.value;
    expect(fresh).not.toBe(oldToken);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion).toBe(1);

    expect(await getCurrentUser()).toMatchObject({ id: user.id }); // jar now holds the fresh cookie
    resetJar({ [SESSION_COOKIE]: oldToken });
    expect(await getCurrentUser()).toBeNull();
  });

  it("requireUser redirects a stale cookie through the cookie-clearing route", async () => {
    resetJar({ [SESSION_COOKIE]: await signSessionToken({ userId: "gone", sessionVersion: 0 }) });
    const err = await requireUser("/dashboard/settings").catch((e: unknown) => e);
    // next/navigation's redirect() throws an error whose digest carries the URL.
    expect(String((err as { digest?: string }).digest)).toContain(
      "/api/auth/session/expired?next=%2Fdashboard%2Fsettings"
    );
    expect(jar.deletes).toHaveLength(0);
  });
});
