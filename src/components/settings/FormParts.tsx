import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Same input styling as the auth forms.
const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function Field({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input {...rest} className={cn(INPUT_CLASS, className)} />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export type NoticeState = { tone: "success" | "error"; message: string } | null;

export function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-4 py-3 text-sm",
        notice.tone === "success"
          ? "bg-accent-soft text-accent-strong"
          : "bg-highlight-soft text-highlight"
      )}
    >
      {notice.message}
    </p>
  );
}

// Kept here so the settings forms keep importing it from one place.
export { sendJson } from "@/lib/api-client";
