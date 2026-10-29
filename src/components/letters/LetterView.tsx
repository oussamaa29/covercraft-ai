"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tone } from "@prisma/client";
import {
  Check,
  Copy,
  Download,
  FileDown,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { downloadText, letterFileName, sendJson } from "@/lib/api-client";
import { TONE_OPTIONS, toneLabel, type GenerationDTO } from "@/lib/types";

export function LetterView({ letter, watermark }: { letter: GenerationDTO; watermark: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [content, setContent] = useState(letter.content);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(letter.content);
  const [busy, setBusy] = useState<null | "save" | "regenerate" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const otherTones = TONE_OPTIONS.filter((t) => t.value !== letter.tone);
  const [tone, setTone] = useState<Tone>(otherTones[0].value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  // The delete button asks once, then disarms itself if not confirmed.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  async function save() {
    if (draft.trim() === content.trim()) return setEditing(false);
    setBusy("save");
    try {
      const { letter: saved } = await sendJson(`/api/letters/${letter.id}`, "PATCH", { content: draft });
      setContent(saved.content);
      setEditing(false);
      toast("Changes saved");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save", "error");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regenerate");
    try {
      const { letter: created } = await sendJson(`/api/letters/${letter.id}/regenerate`, "POST", { tone });
      toast(`New ${toneLabel(tone)} version created`);
      router.push(`/dashboard/letters/${created.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't regenerate", "error");
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy("delete");
    try {
      await sendJson(`/api/letters/${letter.id}`, "DELETE");
      toast("Letter deleted");
      router.push("/dashboard/letters");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete", "error");
      setBusy(null);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  const edited = new Date(letter.updatedAt).getTime() - new Date(letter.createdAt).getTime() > 1000;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{letter.jobTitle}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            at {letter.company}
            <Badge tone="neutral">{toneLabel(letter.tone)}</Badge>
            <span>
              {new Date(letter.createdAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {edited && " · edited"}
            </span>
          </p>
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setDraft(content); setEditing(true); }}>
              <Pencil size={14} /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadText(letterFileName(letter.jobTitle, letter.company, "txt"), content)}
            >
              <Download size={14} /> .txt
            </Button>
            {/* The browser's print dialog has "Save as PDF" — free, no PDF library. */}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileDown size={14} /> PDF
            </Button>
          </div>
        )}
      </div>

      <Card className="p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
        {editing ? (
          <div className="space-y-4">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Letter text"
              className="field-sizing-content min-h-96 w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={busy === "save"}>
                {busy === "save" && <Loader2 size={15} className="animate-spin" />} Save changes
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <span className="text-xs text-muted">Ctrl/⌘ + S to save · Esc to cancel</span>
            </div>
          </div>
        ) : (
          <article className="mx-auto max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed print:max-w-none print:text-[12pt]">
            {content}
          </article>
        )}
        {watermark && (
          <p className="mt-12 hidden text-center text-[9pt] text-muted print:block">
            Made with CoverCraft
          </p>
        )}
      </Card>

      {!editing && (
        <div className="grid gap-4 print:hidden md:grid-cols-2">
          <Card className="p-5">
            <p className="font-medium">Try another tone</p>
            <p className="mt-1 text-sm text-muted">
              Rewrites this letter from the same job description. Uses one generation; this
              version stays in your history.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                disabled={!letter.canRegenerate}
                aria-label="New tone"
                className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-50"
              >
                {otherTones.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={regenerate} disabled={!letter.canRegenerate || busy !== null}>
                {busy === "regenerate" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {busy === "regenerate" ? "Rewriting…" : "Rewrite"}
              </Button>
            </div>
            {!letter.canRegenerate && (
              <p className="mt-2 text-xs text-muted">
                This letter was written before inputs were saved, so it can&apos;t be rewritten.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <p className="font-medium">PDF export</p>
            <p className="mt-1 text-sm text-muted">
              Click PDF, then choose “Save as PDF” as the printer.
              {watermark
                ? " On the Free plan the PDF carries a small “Made with CoverCraft” line — Pro removes it."
                : " No watermark on your plan."}
            </p>
            <div className="mt-4 flex justify-between gap-3">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <FileDown size={14} /> Save as PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={busy !== null}
                className="text-highlight hover:bg-highlight-soft hover:text-highlight"
              >
                {busy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {confirmDelete ? "Click again to delete" : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
