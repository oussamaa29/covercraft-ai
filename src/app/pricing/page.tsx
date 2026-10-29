import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { PricingCards } from "@/components/PricingCards";
import { PlanComparison } from "@/components/marketing/PlanComparison";
import { Faq } from "@/components/marketing/Faq";

export const metadata: Metadata = {
  title: "Pricing — CoverCraft",
};

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Pricing that scales with your search
        </h1>
        <p className="mt-3 text-muted">Start free. Upgrade only once it&rsquo;s saving you real time.</p>
      </div>

      <PricingCards isAuthenticated={Boolean(user)} currentPlan={user?.plan} />

      <div className="mt-20">
        <h2 className="mb-6 text-xl font-semibold">Compare plans</h2>
        <PlanComparison />
      </div>

      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="mb-6 text-xl font-semibold">Frequently asked questions</h2>
        <Faq />
      </div>
    </div>
  );
}
