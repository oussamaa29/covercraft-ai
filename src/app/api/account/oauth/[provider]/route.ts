import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { PROVIDERS, isProviderSlug } from "@/lib/oauth";

class LastSignInMethodError extends Error {}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/account/oauth/[provider]">
) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await ctx.params;
  if (!isProviderSlug(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const { id: providerId, label } = PROVIDERS[provider];

  try {
    const removed = await db.$transaction(async (tx) => {
      // Lock the user row so two parallel disconnects (Google + GitHub on a
      // password-less account) can't both pass the check and strand the user.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { password: true, accounts: { select: { provider: true } } },
      });
      if (!fresh.accounts.some((a) => a.provider === providerId)) return false;

      const otherProviders = fresh.accounts.filter((a) => a.provider !== providerId).length;
      if (!fresh.password && otherProviders === 0) throw new LastSignInMethodError();

      await tx.account.delete({
        where: { userId_provider: { userId: user.id, provider: providerId } },
      });
      return true;
    });

    if (!removed) {
      return NextResponse.json({ error: `${label} isn't connected` }, { status: 404 });
    }
  } catch (err) {
    if (err instanceof LastSignInMethodError) {
      return NextResponse.json(
        {
          error: `${label} is your only way to sign in. Set a password or connect another account first.`,
        },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
