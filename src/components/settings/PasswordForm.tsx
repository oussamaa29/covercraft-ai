"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice, sendJson, type NoticeState } from "@/components/settings/FormParts";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);
  // Remounting clears the fields and the strength meter after a save.
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      await sendJson("/api/account/password", "POST", {
        currentPassword: hasPassword ? form.get("currentPassword") : undefined,
        newPassword: form.get("newPassword"),
      });
      setFormKey((k) => k + 1);
      setNotice({
        tone: "success",
        message: hasPassword
          ? "Password changed. Other devices have been signed out."
          : "Password set. You can now log in with your email too.",
      });
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-4">
      <Notice notice={notice} />
      {hasPassword && (
        <PasswordInput
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      )}
      <PasswordInput
        label={hasPassword ? "New password" : "Password"}
        name="newPassword"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        showStrength
        required
      />
      <p className="text-xs text-muted">Saving it signs out your other devices.</p>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </Button>
    </form>
  );
}
