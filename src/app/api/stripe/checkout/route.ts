import { NextResponse } from "next/server";
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
    customerId = customer.id;
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
