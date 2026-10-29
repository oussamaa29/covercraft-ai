import type { Plan } from "@prisma/client";

export type PlanId = "FREE" | "PRO" | "BUSINESS";
export type BillingInterval = "month" | "year";

export function isInterval(v: unknown): v is BillingInterval {
  return v === "month" || v === "year";
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  /** Billed once a year: two months free. */
  yearlyPrice: number;
  priceId: string | undefined;
  /** Optional: without it the yearly toggle shows prices but checkout 503s. */
  priceIdYearly: string | undefined;
  monthlyLimit: number;
  tagline: string;
  features: string[];
  mostPopular?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    yearlyPrice: 0,
    priceId: undefined,
    priceIdYearly: undefined,
    monthlyLimit: 3,
    tagline: "Try it out on your next application.",
    features: [
      "3 AI cover letters / month",
      "1 saved candidate profile",
      "Standard generation speed",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 12,
    yearlyPrice: 120,
    priceId: process.env.STRIPE_PRICE_PRO,
    priceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    monthlyLimit: Infinity,
    tagline: "For an active job search.",
    mostPopular: true,
    features: [
      "Unlimited AI cover letters",
      "5 saved candidate profiles",
      "PDF export, no watermark",
      "Priority generation speed",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    price: 39,
    yearlyPrice: 390,
    priceId: process.env.STRIPE_PRICE_BUSINESS,
    priceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    monthlyLimit: Infinity,
    tagline: "For career coaches & small teams.",
    features: [
      "Everything in Pro",
      "Up to 5 team seats",
      "Shared letter templates",
      "Priority support",
    ],
  },
};

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === PLANS.PRO.priceId || priceId === PLANS.PRO.priceIdYearly) return "PRO";
  if (priceId === PLANS.BUSINESS.priceId || priceId === PLANS.BUSINESS.priceIdYearly) return "BUSINESS";
  return null;
}

export function monthlyLimitFor(plan: Plan | PlanId): number {
  return PLANS[plan as PlanId].monthlyLimit;
}

/** Saved candidate profiles, as advertised in each plan's feature list. */
export function profileLimitFor(plan: Plan | PlanId): number {
  return plan === "FREE" ? 1 : 5;
}
