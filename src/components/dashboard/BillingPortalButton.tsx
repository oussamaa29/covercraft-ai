"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" onClick={openPortal} disabled={loading}>
        {loading ? "Opening…" : "Manage billing"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-highlight">
          {error}
        </p>
      )}
    </div>
  );
}
