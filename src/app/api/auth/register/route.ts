import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { registerSchema } from "@/lib/validation";
import { LIMITS, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const limit = await rateLimit(`register:${clientIp(request)}`, LIMITS.register);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const user = await db.user.create({
    data: { name, email, password: await hashPassword(password) },
  });

  await createSession(user);

  return NextResponse.json({ ok: true });
}
