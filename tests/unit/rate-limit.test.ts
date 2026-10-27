import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LIMITS, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { truncateAll } from "../test-db";

// The app's Rule type is literal (10 / 5 / 10); tests use their own small limits.
type Rule = Parameters<typeof rateLimit>[1];
const mkRule = (limit: number, windowMs = 60_000) => ({ limit, windowMs }) as unknown as Rule;

beforeEach(async () => {
  await truncateAll(db);
});
afterAll(async () => {
  await db.$disconnect();
});

describe("rate limiter", () => {
  it("configured limits match the spec", () => {
    expect(LIMITS.login).toEqual({ limit: 10, windowMs: 15 * 60_000 });
    expect(LIMITS.register).toEqual({ limit: 5, windowMs: 60 * 60_000 });
    expect(LIMITS.password).toEqual({ limit: 10, windowMs: 15 * 60_000 });
  });

  it("allows `limit` calls per window, then blocks with a sane Retry-After", async () => {
    const rule = mkRule(3);
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await rateLimit("k", rule));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    for (const r of results) {
      expect(r.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("keys are independent", async () => {
    const rule = mkRule(1);
    expect((await rateLimit("a", rule)).ok).toBe(true);
    expect((await rateLimit("a", rule)).ok).toBe(false);
    expect((await rateLimit("b", rule)).ok).toBe(true);
  });

  it("a new window starts once the old one expires", async () => {
    const rule = mkRule(1);
    await rateLimit("w", rule);
    expect((await rateLimit("w", rule)).ok).toBe(false);
    await db.rateLimit.update({ where: { key: "w" }, data: { windowStart: new Date(Date.now() - 61_000) } });
    const r = await rateLimit("w", rule);
    expect(r.ok).toBe(true);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "w" } })).count).toBe(1);
  });

  it("concurrent requests can't over-admit", async () => {
    const rule = mkRule(10);
    const results = await Promise.all(Array.from({ length: 25 }, () => rateLimit("c", rule)));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });

  it("tooManyRequests → 429 JSON with Retry-After", async () => {
    const res = tooManyRequests(125);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("125");
    expect((await res.json()).error).toMatch(/3 minutes/);
    expect((await tooManyRequests(30).json()).error).toMatch(/1 minute\b/);
  });

  it("clientIp uses the first x-forwarded-for entry, else 'unknown'", () => {
    const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "  198.51.100.2 " }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});
