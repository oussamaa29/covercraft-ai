import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { deleteAccountSchema } from "@/lib/validation";

/** Subscription states Stripe will never bill again. */
function isFinished(status: string | null | undefined): boolean {
  return status === "canceled" || status === "incomplete_expired";
}

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
  const subscriptionId = user.stripeSubscriptionId;
  if (isStripeConfigured && subscriptionId && !isFinished(user.subscriptionStatus)) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
      // Our status is a webhook-fed copy and can be stale (e.g. a missed
      // webhook after cancelling in the portal). Ask Stripe before refusing,
      // or the account could become impossible to delete.
      const alreadyGone =
        (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") ||
        (await stripe.subscriptions
          .retrieve(subscriptionId)
          .then((sub) => isFinished(sub.status))
          .catch(() => false));
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
