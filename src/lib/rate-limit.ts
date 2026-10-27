import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const MINUTE = 60 * 1000;

export const LIMITS = {
  login: { limit: 10, windowMs: 15 * MINUTE },
  register: { limit: 5, windowMs: 60 * MINUTE },
  password: { limit: 10, windowMs: 15 * MINUTE },
} as const;

type Rule = (typeof LIMITS)[keyof typeof LIMITS];

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Fixed-window counter stored in Postgres, so it holds across serverless
 * instances (an in-memory Map would reset on every cold start). Every call
 * counts as one attempt.
 */
export async function rateLimit(
  key: string,
  { limit, windowMs }: Rule
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const now = new Date();

  // Prisma turns this into a single INSERT … ON CONFLICT DO UPDATE, so
  // concurrent requests can't lose increments.
  let row = await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, windowStart: now },
    update: { count: { increment: 1 } },
  });

  if (now.getTime() - row.windowStart.getTime() >= windowMs) {
    // The window expired: start a new one. Matching on the old windowStart
    // means only one of several racing requests performs the reset.
    const reset = await db.rateLimit.updateMany({
      where: { key, windowStart: row.windowStart },
      data: { count: 1, windowStart: now },
    });
    row =
      reset.count === 1
        ? { ...row, count: 1, windowStart: now }
        : await db.rateLimit.findUniqueOrThrow({ where: { key } });
  }

  // Opportunistic cleanup so stale keys don't pile up forever.
  if (Math.random() < 0.01) {
    await db.rateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * MINUTE) } } })
      .catch(() => {});
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000)
  );
  return { ok: row.count <= limit, retryAfterSeconds };
}

export function tooManyRequests(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return NextResponse.json(
    {
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
