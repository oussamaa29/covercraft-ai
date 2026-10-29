"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { startCheckout } from "@/lib/checkout";
import type { PlanId } from "@/lib/plans";

// Finishes "sign up for Pro" for OAuth signups: they arrive here from the
// provider callback, and this kicks off the same checkout RegisterForm does.
export function AutoCheckout({ plan, planName }: { plan: PlanId; planName: string }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in dev; one checkout session is enough.
    if (started.current) return;
    started.current = true;
    // Drop ?checkout= from this history entry before leaving, so Back from
    // Stripe (or a refresh after an error) lands on plain billing instead of
    // bouncing to a fresh checkout session.
    const clearTrigger = () => window.history.replaceState(null, "", "/dashboard/billing");
    startCheckout(plan)
      .then((url) => {
        clearTrigger();
        window.location.assign(url);
      })
      .catch((err) => {
        clearTrigger();
        setError(err instanceof Error ? err.message : "Something went wrong");
      });
  }, [plan]);

  if (error) {
    return (
      <p className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">{error}</p>
    );
  }

  return (
    <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-strong">
      <Loader2 size={16} className="animate-spin" /> Taking you to checkout for the {planName}{" "}
      plan…
    </p>
  );
}
