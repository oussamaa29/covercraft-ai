import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./helpers/cookie-jar")).nextHeadersMock);
// after() needs a live request scope; in unit tests run the callback inline.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => Promise.resolve().then(fn),
}));

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSessionToken } from "@/lib/auth";
import { createResetToken, resetPasswordWithToken } from "@/lib/password-reset";
import { POST as forgot } from "@/app/api/auth/forgot/route";
import { PATCH as editLetter, DELETE as deleteLetter } from "@/app/api/letters/[id]/route";
import { POST as regenerate } from "@/app/api/letters/[id]/regenerate/route";
import { POST as createProfile } from "@/app/api/profiles/route";
import { truncateAll } from "../test-db";
import { resetJar } from "./helpers/cookie-jar";

const json = (url: string, method: string, body?: unknown, ip = "10.9.0.1") =>
  new Request(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function signIn(user: { id: string; sessionVersion: number }) {
  resetJar({ [SESSION_COOKIE]: await signSessionToken({ userId: user.id, sessionVersion: user.sessionVersion }) });
}
const makeUser = (email: string, plan: "FREE" | "PRO" = "FREE") =>
  db.user.create({ data: { email, name: email.split("@")[0], password: "x", plan } });
const makeLetter = (userId: string, extra: Record<string, unknown> = {}) =>
  db.generation.create({
    data: {
      userId,
      jobTitle: "Engineer",
      company: "Acme",
      tone: "PROFESSIONAL",
      content: "Dear Acme, a letter long enough to count.",
      candidateName: "Ada",
      jobDescription: "Acme needs an engineer to build things reliably.",
      background: "",
      ...extra,
    },
  });

beforeEach(async () => {
  await truncateAll(db);
  resetJar();
  for (const k of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OLLAMA_MODEL"]) vi.stubEnv(k, "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await db.$disconnect();
});

describe("password reset tokens", () => {
  it("stores only a hash, works once, and signs out every device", async () => {
    const user = await makeUser("r@example.com");
    const token = await createResetToken(user.id);
    const row = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(row.tokenHash).not.toContain(token);

    const updated = await resetPasswordWithToken(token, "newpassword1");
    expect(updated?.sessionVersion).toBe(user.sessionVersion + 1);
    expect(updated?.password).not.toBe("x");
    expect(await resetPasswordWithToken(token, "another-pass1")).toBeNull();
  });

  it("a newer link invalidates the older one", async () => {
    const user = await makeUser("r2@example.com");
    const first = await createResetToken(user.id);
    const second = await createResetToken(user.id);
    expect(await resetPasswordWithToken(first, "newpassword1")).toBeNull();
    expect(await resetPasswordWithToken(second, "newpassword1")).not.toBeNull();
  });

  it("expired tokens are refused", async () => {
    const user = await makeUser("r3@example.com");
    const token = await createResetToken(user.id);
    await db.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resetPasswordWithToken(token, "newpassword1")).toBeNull();
  });

  it("two racing resets with the same token: exactly one wins", async () => {
    const user = await makeUser("r4@example.com");
    const token = await createResetToken(user.id);
    const results = await Promise.all([
      resetPasswordWithToken(token, "racer-one-1"),
      resetPasswordWithToken(token, "racer-two-2"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("POST /api/auth/forgot", () => {
  it("answers the same for known and unknown emails, and only issues a token for real users", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await makeUser("known@example.com");
    const known = await forgot(json("/api/auth/forgot", "POST", { email: "known@example.com" }, "10.9.1.1"));
    const unknown = await forgot(json("/api/auth/forgot", "POST", { email: "ghost@example.com" }, "10.9.1.2"));
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(await known.json()).toEqual(await unknown.json());
    await new Promise((r) => setTimeout(r, 50)); // let after() finish
    expect(await db.passwordResetToken.count()).toBe(1);
  });

  it("refuses a cross-site text/plain post (CSRF guard)", async () => {
    const res = await forgot(
      new Request("http://localhost:3000/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ email: "known@example.com" }),
      })
    );
    expect(res.status).toBe(415);
  });
});

describe("letters API ownership", () => {
  it("another user's letter is a 404 for edit and delete, and stays untouched", async () => {
    const owner = await makeUser("owner@example.com");
    const intruder = await makeUser("intruder@example.com");
    const letter = await makeLetter(owner.id);
    await signIn(intruder);

    const edit = await editLetter(
      json(`/api/letters/${letter.id}`, "PATCH", { content: "Hacked content that is long enough." }) as never,
      params(letter.id) as never
    );
    const del = await deleteLetter(json(`/api/letters/${letter.id}`, "DELETE") as never, params(letter.id) as never);
    expect([edit.status, del.status]).toEqual([404, 404]);
    expect((await db.generation.findUniqueOrThrow({ where: { id: letter.id } })).content).toBe(letter.content);
  });

  it("the owner can edit their letter", async () => {
    const owner = await makeUser("owner2@example.com");
    const letter = await makeLetter(owner.id);
    await signIn(owner);
    const res = await editLetter(
      json(`/api/letters/${letter.id}`, "PATCH", { content: "A freshly edited cover letter body." }) as never,
      params(letter.id) as never
    );
    expect(res.status).toBe(200);
    expect((await res.json()).letter.content).toBe("A freshly edited cover letter body.");
  });
});

describe("POST /api/letters/[id]/regenerate", () => {
  it("creates a new letter in the new tone and keeps the original", async () => {
    const owner = await makeUser("regen@example.com");
    const letter = await makeLetter(owner.id);
    await signIn(owner);
    const res = await regenerate(json(`/api/letters/${letter.id}/regenerate`, "POST", { tone: "CONCISE" }) as never, params(letter.id) as never);
    expect(res.status).toBe(200);
    const { letter: created } = await res.json();
    expect(created.id).not.toBe(letter.id);
    expect(created.tone).toBe("CONCISE");
    expect(await db.generation.count({ where: { userId: owner.id } })).toBe(2);
  });

  it("counts against the Free quota (402 when used up)", async () => {
    const owner = await makeUser("quota@example.com");
    const letter = await makeLetter(owner.id);
    await makeLetter(owner.id);
    await makeLetter(owner.id);
    await signIn(owner);
    const res = await regenerate(json(`/api/letters/${letter.id}/regenerate`, "POST", { tone: "FRIENDLY" }) as never, params(letter.id) as never);
    expect(res.status).toBe(402);
  });

  it("letters written before inputs were stored can't be regenerated (409)", async () => {
    const owner = await makeUser("legacy@example.com");
    const letter = await makeLetter(owner.id, { jobDescription: null });
    await signIn(owner);
    const res = await regenerate(json(`/api/letters/${letter.id}/regenerate`, "POST", { tone: "FRIENDLY" }) as never, params(letter.id) as never);
    expect(res.status).toBe(409);
  });
});

describe("candidate profiles limit", () => {
  const body = { label: "Main", fullName: "Ada", background: "Ten years of building reliable systems." };

  it("Free keeps 1, the 2nd is a 402", async () => {
    const user = await makeUser("free@example.com");
    await signIn(user);
    expect((await createProfile(json("/api/profiles", "POST", body))).status).toBe(200);
    const second = await createProfile(json("/api/profiles", "POST", { ...body, label: "Two" }));
    expect(second.status).toBe(402);
    expect((await second.json()).code).toBe("PROFILE_LIMIT");
  });

  it("Pro keeps 5", async () => {
    const user = await makeUser("pro@example.com", "PRO");
    await signIn(user);
    for (let i = 0; i < 5; i++) {
      expect((await createProfile(json("/api/profiles", "POST", { ...body, label: `P${i}` }))).status).toBe(200);
    }
    expect((await createProfile(json("/api/profiles", "POST", { ...body, label: "P6" }))).status).toBe(402);
  });

  it("parallel creates can't squeeze past the limit", async () => {
    const user = await makeUser("race@example.com");
    await signIn(user);
    await Promise.all([0, 1, 2].map((i) => createProfile(json("/api/profiles", "POST", { ...body, label: `R${i}` }))));
    expect(await db.candidateProfile.count({ where: { userId: user.id } })).toBe(1);
  });
});
