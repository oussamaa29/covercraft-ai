"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { sendJson } from "@/lib/api-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirm")) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await sendJson("/api/auth/reset", "POST", { token, password });
      toast("Password updated — you're logged in");
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
          {error}{" "}
          {error.includes("Request a new one") && (
            <Link href="/forgot-password" className="font-medium underline">
              Get a new link
            </Link>
          )}
        </p>
      )}
      <PasswordInput
        label="New password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        autoFocus
        showStrength
        required
      />
      <PasswordInput
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Set new password"}
      </Button>
      <p className="text-center text-xs text-muted">
        This signs you out on every other device.
      </p>
    </form>
  );
}
