"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";
import { startCheckout } from "@/lib/checkout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface PricingCardsProps {
  isAuthenticated: boolean;
  currentPlan?: PlanId;
}

export function PricingCards({ isAuthenticated, currentPlan }: PricingCardsProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(planId: PlanId) {
    setError(null);
    setLoadingPlan(planId);
    try {
      window.location.assign(await startCheckout(planId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
          {error}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isFree = plan.price === 0;

          return (
            <Card
              key={plan.id}
              className={
                plan.mostPopular
                  ? "relative flex flex-col p-8 ring-2 ring-accent"
                  : "relative flex flex-col p-8"
              }
            >
              {plan.mostPopular && (
                <Badge
                  tone="accent"
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                >
                  Most popular
                </Badge>
              )}

              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  ${plan.price}
                </span>
                <span className="text-sm text-muted">/month</span>
              </div>

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
                    <Link
                      href="/register"
                      className="flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-medium hover:bg-surface-muted"
                    >
                      Start for free
                    </Link>
                  )
                ) : isAuthenticated ? (
                  <Button
                    variant={plan.mostPopular ? "primary" : "secondary"}
                    className="w-full"
                    disabled={loadingPlan !== null}
                    onClick={() => upgrade(plan.id)}
                  >
                    {loadingPlan === plan.id ? "Redirecting…" : `Upgrade to ${plan.name}`}
                  </Button>
                ) : (
                  <Link
                    href={`/register?plan=${plan.id}`}
                    className={
                      plan.mostPopular
                        ? "flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-medium text-accent-foreground hover:bg-accent-strong"
                        : "flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-medium hover:bg-surface-muted"
                    }
                  >
                    Get {plan.name}
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
