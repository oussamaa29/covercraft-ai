import type { PlanId } from "@/lib/plans";

/**
 * Client-side: asks the API for a Stripe Checkout session for the signed-in
 * user and returns its URL. Throws with the API's message (e.g. the 503 when
 * Stripe isn't configured).
 */
export async function startCheckout(plan: PlanId): Promise<string> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong");
  return data.url;
}
