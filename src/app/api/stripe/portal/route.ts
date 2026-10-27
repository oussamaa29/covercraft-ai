import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { stripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStripeConfigured || !user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found for this user yet." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/dashboard/billing`,
  });

  return NextResponse.json({ url: session.url });
}
