"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Notice, sendJson, type NoticeState } from "@/components/settings/FormParts";

export function DeleteAccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);
  const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matches) return;
    setNotice(null);
    setLoading(true);

    try {
      await sendJson("/api/account", "DELETE", { confirmEmail });
      router.push("/");
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Notice notice={notice} />
      <Field
        label={
          <>
            Type <span className="font-semibold">{email}</span> to confirm
          </>
        }
        name="confirmEmail"
        type="email"
        autoComplete="off"
        value={confirmEmail}
        onChange={(e) => setConfirmEmail(e.target.value)}
        required
      />
      <Button
        type="submit"
        variant="outline"
        className="border-highlight/40 text-highlight hover:bg-highlight-soft"
        disabled={!matches || loading}
      >
        {loading ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
