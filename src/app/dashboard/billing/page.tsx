import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PricingCards } from "@/components/PricingCards";
import { BillingPortalButton } from "@/components/dashboard/BillingPortalButton";
import { AutoCheckout } from "@/components/dashboard/AutoCheckout";
import { PLANS, isInterval, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Billing — CoverCraft" };

export default async function BillingPage(props: PageProps<"/dashboard/billing">) {
  const user = await requireUser("/dashboard/billing");

  const searchParams = await props.searchParams;
  const showSuccess = searchParams.success === "1";
  const plan = PLANS[user.plan];

  // ?checkout=PRO|BUSINESS comes from the OAuth buttons on /register?plan=….
  // Only free users are sent on: an existing subscriber who happened to sign
  // in that way shouldn't be pushed into a second checkout.
  const rawCheckout = searchParams.checkout;
  const checkoutPlan: PlanId | null =
    (rawCheckout === "PRO" || rawCheckout === "BUSINESS") && user.plan === "FREE"
      ? rawCheckout
      : null;

  return (
    <div className="space-y-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted">Manage your plan and payment details.</p>
      </div>

      {checkoutPlan && (
        <AutoCheckout
          plan={checkoutPlan}
          planName={PLANS[checkoutPlan].name}
          interval={isInterval(searchParams.interval) ? searchParams.interval : "month"}
        />
      )}

      {showSuccess && (
        <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          <CheckCircle2 size={16} /> Subscription active — thanks for upgrading!
        </p>
      )}

      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={user.plan === "FREE" ? "neutral" : "accent"}>{plan.name} plan</Badge>
            {user.subscriptionStatus && user.plan !== "FREE" && (
              <Badge tone={user.subscriptionStatus === "active" ? "accent" : "highlight"}>
                {user.subscriptionStatus}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">
            {user.plan === "FREE"
              ? "3 generations per month, on us."
              : user.currentPeriodEnd
                ? `Renews ${user.currentPeriodEnd.toLocaleDateString()}`
                : "Unlimited generations."}
          </p>
        </div>
        {user.stripeCustomerId && <BillingPortalButton />}
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Change plan</h2>
        <PricingCards isAuthenticated currentPlan={user.plan} />
      </div>
    </div>
  );
}
