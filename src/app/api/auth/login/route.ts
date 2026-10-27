import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyLoginPassword, createSession } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { loginSchema } from "@/lib/validation";
import { LIMITS, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const limit = await rateLimit(`login:${clientIp(request)}:${email}`, LIMITS.login);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const user = await db.user.findUnique({ where: { email } });

  // Unknown emails and OAuth-only users (no password) get the same answer,
  // after the same bcrypt work, as a wrong password — so neither the body
  // nor the timing reveals whether or how an email signed up.
  const valid = await verifyLoginPassword(password, user?.password);
  if (!user || !valid) {
    return NextResponse.json(
      { error: "Incorrect email or password" },
      { status: 401 }
    );
  }

  await createSession(user);

  return NextResponse.json({ ok: true });
}
