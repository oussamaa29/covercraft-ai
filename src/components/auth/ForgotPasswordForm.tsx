"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendJson } from "@/lib/api-client";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try {
      await sendJson("/api/auth/forgot", "POST", { email });
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <MailCheck size={22} />
        </span>
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>,
          we&apos;ve sent a link to reset its password. It expires in 1 hour.
        </p>
        <p className="text-sm text-muted">
          Nothing after a few minutes? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      {error && (
        <p role="alert" className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
          {error}
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </form>
  );
}
