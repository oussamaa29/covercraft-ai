import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured) {
    return NextResponse.json(
      { error: "Billing isn't configured on this deployment yet (missing STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const planId = body?.plan as PlanId | undefined;
  const plan = planId ? PLANS[planId] : undefined;

  if (!plan || !plan.priceId) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    // Saved before checkout: every webhook finds the user by this id. The
    // null guard means a second tab racing this one can't overwrite it; the
    // loser reuses the winner's customer instead.
    const saved = await db.user.updateMany({
      where: { id: user.id, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });
    if (saved.count === 1) {
      customerId = customer.id;
    } else {
      const fresh = await db.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      });
      customerId = fresh?.stripeCustomerId ?? customer.id;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    subscription_data: { metadata: { userId: user.id } },
    success_url: `${origin}/dashboard/billing?success=1`,
    cancel_url: `${origin}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
