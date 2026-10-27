"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Notice, sendJson, type NoticeState } from "@/components/settings/FormParts";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setLoading(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    try {
      await sendJson("/api/account/password", "POST", {
        currentPassword: hasPassword ? form.get("currentPassword") : undefined,
        newPassword: form.get("newPassword"),
      });
      formEl.reset();
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
    <form onSubmit={onSubmit} className="space-y-4">
      <Notice notice={notice} />
      {hasPassword && (
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      )}
      <Field
        label={hasPassword ? "New password" : "Password"}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        hint="At least 8 characters. Saving it signs out your other devices."
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </Button>
    </form>
  );
}
