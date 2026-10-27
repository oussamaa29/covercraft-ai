import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { passwordSchema } from "@/lib/validation";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Sets a first password (OAuth-only users) or changes the existing one.
// Either way every other session is signed out.
export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await rateLimit(`password:${user.id}`, LIMITS.password);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (user.password) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.password))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
    },
    select: { id: true, sessionVersion: true },
  });
  // The bump above just invalidated this request's cookie too.
  await createSession(updated);

  return NextResponse.json({ ok: true });
}
