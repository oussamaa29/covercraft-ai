import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { rejectCrossSite } from "@/lib/csrf";
import { sendMail } from "@/lib/mail";
import { createResetToken } from "@/lib/password-reset";
import { LIMITS, clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { configuredAppUrl } from "@/lib/site";
import { forgotPasswordSchema } from "@/lib/validation";

/**
 * Always answers the same 200, whether or not the email has an account, and
 * does the lookup + email in after() so response time doesn't tell either.
 * OAuth-only users get a link too: it's how they can add a password.
 */
export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email } = parsed.data;

  const byIp = await rateLimit(`forgot:ip:${clientIp(request)}`, LIMITS.forgot);
  if (!byIp.ok) return tooManyRequests(byIp.retryAfterSeconds);
  const byEmail = await rateLimit(`forgot:email:${email}`, LIMITS.forgot);
  // Over the per-email limit: same answer as success, just no new email.
  if (!byEmail.ok) return NextResponse.json({ ok: true });

  const origin = configuredAppUrl() ?? new URL(request.url).origin;
  after(async () => {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return;
    const token = await createResetToken(user.id);
    const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: "Reset your CoverCraft password",
      text: [
        `Hi ${user.name},`,
        "",
        "Someone (hopefully you) asked to reset your CoverCraft password. Open this link to choose a new one:",
        "",
        link,
        "",
        "It works once and expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.",
      ].join("\n"),
      html: resetEmailHtml(user.name, link),
    }).catch((err) => console.error("[forgot] sending failed:", err));
  });

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Emails can't use the app's CSS variables, so the brand accent is inlined.
function resetEmailHtml(name: string, link: string) {
  const href = escapeHtml(link);
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#16181a">
  <p style="font-weight:600;font-size:18px;margin:0 0 16px">CoverCraft</p>
  <p>Hi ${escapeHtml(name)},</p>
  <p>Someone (hopefully you) asked to reset your CoverCraft password.</p>
  <p style="margin:24px 0"><a href="${href}" style="background:#0f9d6b;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Choose a new password</a></p>
  <p style="color:#5b6169;font-size:13px">The link works once and expires in 1 hour. If you didn't ask for this, ignore this email — your password won't change.</p>
</div>`;
}
