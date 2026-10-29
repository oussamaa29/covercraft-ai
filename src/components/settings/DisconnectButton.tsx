"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { sendJson } from "@/components/settings/FormParts";

export function DisconnectButton({ provider }: { provider: "google" | "github" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setError(null);
    setLoading(true);
    try {
      await sendJson(`/api/account/oauth/${provider}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button variant="outline" size="sm" onClick={disconnect} disabled={loading}>
        {loading ? "Disconnecting…" : "Disconnect"}
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-highlight sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}
