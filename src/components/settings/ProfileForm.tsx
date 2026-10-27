"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Notice, sendJson, type NoticeState } from "@/components/settings/FormParts";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      await sendJson("/api/account/profile", "PATCH", { name: form.get("name") });
      setNotice({ tone: "success", message: "Profile saved." });
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
      <Field
        label="Name"
        name="name"
        type="text"
        autoComplete="name"
        defaultValue={name}
        minLength={2}
        maxLength={80}
        required
      />
      <Field
        label="Email"
        type="email"
        value={email}
        readOnly
        className="bg-surface-muted text-muted"
        hint="Your sign-in email can't be changed here."
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
