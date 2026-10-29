import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { monthlyLimitFor } from "@/lib/plans";

export function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Counted from Generation rows, never a cached counter, so it can't drift. */
export function generationsThisMonth(userId: string): Promise<number> {
  return db.generation.count({ where: { userId, createdAt: { gte: startOfMonth() } } });
}

/**
 * The 402 to send when the user has no generations left this month, else
 * null. Shared by /api/generate and regenerate so both gate the same way.
 */
export async function quotaExceeded(user: Pick<User, "id" | "plan">): Promise<NextResponse | null> {
  const limit = monthlyLimitFor(user.plan);
  if (limit === Infinity) return null;
  if ((await generationsThisMonth(user.id)) < limit) return null;
  return NextResponse.json(
    {
      error: `You've used all ${limit} free generations this month. Upgrade to Pro for unlimited letters.`,
      code: "LIMIT_REACHED",
    },
    { status: 402 }
  );
}
