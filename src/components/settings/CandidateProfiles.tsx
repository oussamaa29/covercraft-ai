"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/settings/FormParts";
import { sendJson } from "@/lib/api-client";
import type { CandidateProfileDTO } from "@/lib/types";

type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

/** Saved name + background blocks the New letter form can pre-fill from. */
export function CandidateProfiles({
  initial,
  limit,
  defaultName,
}: {
  initial: CandidateProfileDTO[];
  limit: number;
  defaultName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [profiles, setProfiles] = useState(initial);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const full = profiles.length >= limit;
  const current = editing?.mode === "edit" ? profiles.find((p) => p.id === editing.id) : undefined;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const body = {
      label: form.get("label"),
      fullName: form.get("fullName"),
      background: form.get("background"),
    };
    try {
      if (editing?.mode === "edit") {
        const { profile } = await sendJson(`/api/profiles/${editing.id}`, "PATCH", body);
        setProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)));
        toast("Profile updated");
      } else {
        const { profile } = await sendJson("/api/profiles", "POST", body);
        setProfiles((prev) => [...prev, profile]);
        toast("Profile saved");
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await sendJson(`/api/profiles/${id}`, "DELETE");
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      toast("Profile deleted");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete", "error");
    }
  }

  return (
    <div className="space-y-4">
      {profiles.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <UserRound size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="line-clamp-2 text-xs text-muted">
                  {p.fullName} — {p.background}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing({ mode: "edit", id: p.id })}
                  aria-label={`Edit ${p.label}`}
                  className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={`Delete ${p.label}`}
                  className="rounded-lg p-2 text-muted hover:bg-highlight-soft hover:text-highlight"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form
          key={editing.mode === "edit" ? editing.id : "new"}
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-border bg-surface-muted/40 p-4"
        >
          {error && (
            <p role="alert" className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Profile name"
              name="label"
              placeholder="e.g. Frontend roles"
              defaultValue={current?.label}
              maxLength={40}
              required
            />
            <Field
              label="Your full name"
              name="fullName"
              defaultValue={current?.fullName ?? defaultName}
              maxLength={80}
              required
            />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Background</span>
            <textarea
              name="background"
              rows={4}
              defaultValue={current?.background}
              maxLength={4000}
              required
              placeholder="Experience, key results, skills you want every letter to draw on…"
              className="w-full resize-y rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : editing.mode === "edit" ? "Save changes" : "Save profile"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {profiles.length} / {limit} used
          </p>
          {full ? (
            limit === 1 ? (
              <Link href="/pricing" className="text-sm font-medium text-accent hover:text-accent-strong">
                Upgrade for up to 5 profiles →
              </Link>
            ) : null
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing({ mode: "new" })}>
              <Plus size={15} /> Add a profile
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
