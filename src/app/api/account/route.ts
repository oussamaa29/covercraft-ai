import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { deleteAccountSchema } from "@/lib/validation";

export async function DELETE(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  if (parsed.data.confirmEmail !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "That doesn't match your account email" },
      { status: 400 }
    );
  }

  // Cancel billing first so a deleted account can't keep being charged.
  // Skipped when Stripe isn't configured (demo mode) or there's nothing live.
  if (isStripeConfigured && user.stripeSubscriptionId && user.subscriptionStatus !== "canceled") {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      const alreadyGone =
        err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
      if (!alreadyGone) {
        console.error("[account:delete] subscription cancel failed:", err);
        return NextResponse.json(
          {
            error:
              "We couldn't cancel your subscription, so your account wasn't deleted. Try again, or cancel it from Billing first.",
          },
          { status: 502 }
        );
      }
    }
  }

  // Generations and linked accounts go with it (onDelete: Cascade).
  await db.user.delete({ where: { id: user.id } });
  await destroySession();

  return NextResponse.json({ ok: true });
}
