import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { LIMITS, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const limit = await rateLimit(`reset:${clientIp(request)}`, LIMITS.reset);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.path[0] === "token" ? "This reset link is invalid." : (issue?.message ?? "Invalid input") },
      { status: 400 }
    );
  }

  const user = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid, expired or already used. Request a new one." },
      { status: 400 }
    );
  }

  // Every other device was just signed out; this browser gets a fresh session.
  await createSession(user);
  return NextResponse.json({ ok: true });
}
