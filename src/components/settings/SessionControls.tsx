"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LogoutButton } from "@/components/LogoutButton";
import { Notice, sendJson, type NoticeState } from "@/components/settings/FormParts";

export function SessionControls() {
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);

  async function revokeOthers() {
    setNotice(null);
    setLoading(true);
    try {
      await sendJson("/api/account/sessions/revoke", "POST");
      setNotice({ tone: "success", message: "Signed out of every other device." });
    } catch (err) {
      setNotice({ tone: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Notice notice={notice} />
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={revokeOthers} disabled={loading}>
          {loading ? "Signing out…" : "Sign out of all other devices"}
        </Button>
        <LogoutButton size="md" />
      </div>
    </div>
  );
}
