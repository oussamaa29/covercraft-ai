"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import type { BillingInterval, PlanId } from "@/lib/plans";
import { startCheckout } from "@/lib/checkout";

export function RegisterForm({
  plan,
  interval = "month",
}: {
  plan?: PlanId;
  interval?: BillingInterval;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      if (plan && plan !== "FREE") {
        try {
          window.location.assign(await startCheckout(plan, interval));
          return;
        } catch {
          // Billing unavailable: the account exists, so carry on to the dashboard.
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      {error && (
        <p role="alert" className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
          {error}
        </p>
      )}
      <Field label="Name" name="name" type="text" autoComplete="name" autoFocus required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        showStrength
        required
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 transition-colors hover:text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...rest}
        className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
    </label>
  );
}
