"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PLANS, type BillingInterval, type PlanId } from "@/lib/plans";
import { startCheckout } from "@/lib/checkout";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface PricingCardsProps {
  isAuthenticated: boolean;
  currentPlan?: PlanId;
}

export function PricingCards({ isAuthenticated, currentPlan }: PricingCardsProps) {
  const [interval, setBilling] = useState<BillingInterval>("month");
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(planId: PlanId) {
    setError(null);
    setLoadingPlan(planId);
    try {
      window.location.assign(await startCheckout(planId, interval));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm"
        >
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setBilling(value)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
                interval === value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              {value === "month" ? "Monthly" : "Yearly"}
              {value === "year" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                    interval === "year"
                      ? "bg-accent-foreground/20 text-accent-foreground"
                      : "bg-accent-soft text-accent-strong"
                  )}
                >
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isFree = plan.price === 0;
          const perMonth = interval === "year" ? plan.yearlyPrice / 12 : plan.price;
          const shownPrice = Number.isInteger(perMonth) ? perMonth : perMonth.toFixed(2);

          return (
            <div
              key={plan.id}
              className={cn(
                "group relative flex flex-col rounded-card border bg-surface p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/[0.04] motion-reduce:hover:translate-y-0",
                plan.mostPopular
                  ? "border-accent ring-2 ring-accent"
                  : "border-border hover:border-accent/40"
              )}
            >
              {plan.mostPopular && (
                <Badge tone="accent" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most popular
                </Badge>
              )}

              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                {/* Keyed on the interval so the number fades in when it changes. */}
                <span
                  key={`${plan.id}-${interval}`}
                  className="animate-[fade-in_250ms_ease-out] text-4xl font-semibold tracking-tight tabular-nums motion-reduce:animate-none"
                >
                  ${shownPrice}
                </span>
                <span className="text-sm text-muted">/month</span>
              </div>
              <p className="mt-1 h-5 text-xs text-muted">
                {isFree
                  ? "Free forever"
                  : interval === "year"
                    ? `$${plan.yearlyPrice} billed yearly — save $${plan.price * 12 - plan.yearlyPrice}`
                    : "Billed monthly, cancel anytime"}
              </p>

              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : isFree ? (
                  isAuthenticated ? (
                    <Button variant="secondary" className="w-full" disabled>
                      Included
                    </Button>
                  ) : (
                    <ButtonLink href="/register" variant="outline" className="w-full">
                      Start for free
                    </ButtonLink>
                  )
                ) : isAuthenticated ? (
                  <Button
                    variant={plan.mostPopular ? "primary" : "outline"}
                    className="w-full"
                    disabled={loadingPlan !== null}
                    onClick={() => upgrade(plan.id)}
                  >
                    {loadingPlan === plan.id ? "Redirecting…" : `Upgrade to ${plan.name}`}
                  </Button>
                ) : (
                  <ButtonLink
                    href={`/register?plan=${plan.id}&interval=${interval}`}
                    variant={plan.mostPopular ? "primary" : "outline"}
                    className="w-full"
                  >
                    Get {plan.name}
                  </ButtonLink>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
