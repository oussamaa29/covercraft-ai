import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { PricingCards } from "@/components/PricingCards";

export const metadata: Metadata = {
  title: "Pricing — CoverCraft",
};

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel your subscription anytime from the billing page — it's a self-service Stripe portal, no email required.",
  },
  {
    q: "What happens to my letters if I downgrade?",
    a: "Nothing gets deleted. Your history stays; you'll just be limited to 3 new generations per month again on the Free plan.",
  },
  {
    q: "Do you store my job descriptions?",
    a: "No. Only the job title, company and the generated letter are saved, so you can find it again later in your dashboard history.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "The Free plan itself works as an ongoing trial — 3 real generations a month, no time limit and no card required.",
  },
];

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

      <div className="mx-auto mt-24 max-w-2xl">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="py-5">
              <h3 className="font-medium">{q}</h3>
              <p className="mt-1.5 text-sm text-muted">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
