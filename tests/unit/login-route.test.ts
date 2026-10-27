import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("next/headers", async () => (await import("./helpers/cookie-jar")).nextHeadersMock);

import { POST as login } from "@/app/api/auth/login/route";
import { SESSION_COOKIE, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncateAll } from "../test-db";
import { lastSet, resetJar } from "./helpers/cookie-jar";

let ip = 0;
const post = (body: unknown) =>
  login(
    new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.77.0.${++ip}` },
      body: JSON.stringify(body),
    })
  );

beforeEach(async () => {
  resetJar();
  await truncateAll(db);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db.$disconnect();
});

describe("POST /api/auth/login (handler)", () => {
  it("OAuth-only user: generic 401, and bcrypt is never handed a null hash", async () => {
    await db.user.create({ data: { email: "oauth@example.com", name: "O", password: null } });
    const spy = vi.spyOn(bcrypt, "compare");
    const res = await post({ email: "oauth@example.com", password: "whatever" });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Incorrect email or password");
    for (const call of spy.mock.calls) {
      expect(typeof call[1]).toBe("string");
    }
    expect(lastSet(SESSION_COOKIE)).toBeUndefined();
  });

  it("unknown email still pays for a bcrypt compare (no timing oracle)", async () => {
    const spy = vi.spyOn(bcrypt, "compare");
    const res = await post({ email: "nobody@example.com", password: "whatever" });
    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalled();
    for (const call of spy.mock.calls) {
      expect(typeof call[1]).toBe("string");
    }
  });

  it("OAuth-only user also pays for a bcrypt compare", async () => {
    await db.user.create({ data: { email: "oauth2@example.com", name: "O", password: null } });
    const spy = vi.spyOn(bcrypt, "compare");
    await post({ email: "oauth2@example.com", password: "whatever" });
    expect(spy).toHaveBeenCalled();
  });

  it("correct password → 200 and a session cookie", async () => {
    await db.user.create({
      data: { email: "pw@example.com", name: "P", password: await hashPassword("password123") },
    });
    const res = await post({ email: " PW@example.com ", password: "password123" });
    expect(res.status).toBe(200);
    expect(lastSet(SESSION_COOKIE)?.value).toBeTruthy();
  });
});
