"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FlaskConical,
  Loader2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import type { Tone } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { UsageMeter } from "@/components/dashboard/UsageMeter";
import { downloadText, letterFileName, sendJson } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import {
  TONE_OPTIONS,
  toneLabel,
  type CandidateProfileDTO,
  type GenerationDTO,
} from "@/lib/types";
import type { PlanId } from "@/lib/plans";

const DRAFT_KEY = "covercraft:draft";
const LIMITS = { jobDescription: 6000, background: 4000 };

interface FormState {
  candidateName: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  background: string;
  tone: Tone;
}

interface Props {
  userName: string;
  plan: PlanId;
  limit: number;
  usedThisMonth: number;
  initialGenerations: GenerationDTO[];
  profiles: CandidateProfileDTO[];
  profileLimit: number;
  /** Which writer is configured, e.g. "Ollama · llama3.2:3b" or "Demo mode". */
  aiLabel: string;
  aiIsDemo: boolean;
  aiIsLocal: boolean;
}

export function GenerationWorkspace({
  userName,
  plan,
  limit,
  usedThisMonth,
  initialGenerations,
  profiles: initialProfiles,
  profileLimit,
  aiLabel,
  aiIsDemo,
  aiIsLocal,
}: Props) {
  const toast = useToast();
  const empty: FormState = {
    candidateName: userName,
    jobTitle: "",
    company: "",
    jobDescription: "",
    background: "",
    tone: "PROFESSIONAL",
  };
  const [form, setForm] = useState<FormState>(empty);
  const [generations, setGenerations] = useState(initialGenerations);
  const [used, setUsed] = useState(usedThisMonth);
  const [active, setActive] = useState<GenerationDTO | null>(initialGenerations[0] ?? null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [savingProfile, setSavingProfile] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const draftLoaded = useRef(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Restore an unsent draft once, after mount (localStorage isn't there during SSR).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Partial<FormState> | null;
      if (saved && (saved.jobDescription || saved.jobTitle || saved.company)) {
        setForm((f) => ({ ...f, ...saved }));
        setDraftRestored(true);
      }
    } catch {
      // Private mode / blocked storage: just start empty.
    }
    draftLoaded.current = true;
  }, []);

  // Autosave the form while typing, so a refresh or closed tab loses nothing.
  useEffect(() => {
    if (!draftLoaded.current) return;
    const t = setTimeout(() => {
      try {
        if (form.jobDescription || form.jobTitle || form.company) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        }
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [form]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setForm(empty);
    setDraftRestored(false);
  }

  function applyProfile(id: string) {
    const p = profiles.find((x) => x.id === id);
    if (p) setForm((f) => ({ ...f, candidateName: p.fullName, background: p.background }));
  }

  async function saveAsProfile() {
    if (form.background.trim().length < 10) {
      toast("Write a few lines of background first", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const label = form.jobTitle.trim() ? `${form.jobTitle.trim()} profile` : "My profile";
      const { profile } = await sendJson("/api/profiles", "POST", {
        label: label.slice(0, 40),
        fullName: form.candidateName,
        background: form.background,
      });
      setProfiles((prev) => [...prev, profile]);
      toast(`Saved as “${profile.label}” — rename it in Settings`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { generation } = (await sendJson("/api/generate", "POST", form)) as {
        generation: GenerationDTO;
      };
      setGenerations((prev) => [generation, ...prev]);
      setActive(generation);
      setRevealId(generation.id);
      setUsed((n) => n + 1);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setDraftRestored(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const limitReached = limit !== Infinity && used >= limit;
  const canSaveProfile = profiles.length < profileLimit;

  return (
    <div className="space-y-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New cover letter</h1>
          <p className="mt-1 text-sm text-muted">Welcome back, {userName}.</p>
        </div>
        <Badge
          tone={aiIsDemo ? "neutral" : "accent"}
          title={aiIsDemo ? "No AI provider configured — letters are sample text" : undefined}
        >
          {aiIsDemo ? <FlaskConical size={13} /> : <Sparkles size={13} />}
          {aiIsDemo ? "Demo mode · sample letters" : `Written by ${aiLabel}`}
        </Badge>
      </div>

      <UsageMeter plan={plan} used={used} limit={limit} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <form
            ref={formRef}
            onSubmit={onSubmit}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !limitReached) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            className="space-y-4"
          >
            {error && (
              <p role="alert" className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
                {error}
              </p>
            )}
            {draftRestored && (
              <p className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-3.5 py-2 text-xs text-accent-strong">
                Draft restored from your last visit.
                <button
                  type="button"
                  onClick={clearDraft}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  <X size={12} /> Clear
                </button>
              </p>
            )}

            {profiles.length > 0 && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Saved profile</span>
                <select
                  defaultValue=""
                  onChange={(e) => applyProfile(e.target.value)}
                  className="h-[42px] w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  <option value="" disabled>
                    Fill name &amp; background from a profile…
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Your name"
                value={form.candidateName}
                onChange={(v) => set("candidateName", v)}
                required
              />
              <Field
                label="Job title"
                value={form.jobTitle}
                onChange={(v) => set("jobTitle", v)}
                placeholder="Senior Frontend Engineer"
                required
              />
            </div>
            <Field
              label="Company"
              value={form.company}
              onChange={(v) => set("company", v)}
              placeholder="Northwind Labs"
              required
            />

            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium">Tone</legend>
              {/* Native radios under the cards: arrow keys and screen readers work for free. */}
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((t) => (
                  <label
                    key={t.value}
                    className={cn(
                      "cursor-pointer rounded-lg border px-3 py-2.5 transition-all duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-soft",
                      form.tone === t.value
                        ? "border-accent bg-accent-soft/60"
                        : "border-border hover:border-accent/40 hover:bg-surface-muted"
                    )}
                  >
                    <input
                      type="radio"
                      name="tone"
                      value={t.value}
                      checked={form.tone === t.value}
                      onChange={() => set("tone", t.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        form.tone === t.value && "text-accent-strong"
                      )}
                    >
                      {t.label}
                    </span>
                    <span className="block text-xs text-muted">{t.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <TextArea
              label="Job description"
              value={form.jobDescription}
              onChange={(v) => set("jobDescription", v)}
              max={LIMITS.jobDescription}
              rows={6}
              placeholder="Paste the job posting here…"
              required
            />
            <TextArea
              label="Your background (optional)"
              value={form.background}
              onChange={(v) => set("background", v)}
              max={LIMITS.background}
              rows={3}
              placeholder="A few lines about relevant experience…"
              action={
                canSaveProfile && form.background.trim().length >= 10 ? (
                  <button
                    type="button"
                    onClick={saveAsProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong disabled:opacity-50"
                  >
                    <Save size={12} /> {savingProfile ? "Saving…" : "Save as profile"}
                  </button>
                ) : null
              }
            />

            <Button type="submit" className="w-full" disabled={loading || limitReached}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Writing your letter…
                </>
              ) : limitReached ? (
                "Monthly limit reached"
              ) : (
                "Generate letter"
              )}
            </Button>
            <p className="text-center text-xs text-muted" role="status">
              {loading && aiIsLocal
                ? "Running on a local model — the first letter can take up to a minute."
                : !limitReached && (
                    <>
                      <kbd className="rounded border border-border px-1 font-mono">Ctrl</kbd> +{" "}
                      <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to
                      generate · your draft is saved as you type
                    </>
                  )}
            </p>
          </form>
        </Card>

        <Card className="flex flex-col p-6">
          {loading ? (
            <LetterSkeleton />
          ) : active ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{active.jobTitle}</p>
                  <p className="truncate text-sm text-muted">
                    at {active.company} · {toneLabel(active.tone)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <CopyButton text={active.content} />
                  <IconButton
                    label="Download as .txt"
                    onClick={() =>
                      downloadText(letterFileName(active.jobTitle, active.company, "txt"), active.content)
                    }
                  >
                    <Download size={14} />
                  </IconButton>
                </div>
              </div>
              <RevealText
                key={active.id}
                text={active.content}
                animate={revealId === active.id}
                className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
              />
              <Link
                href={`/dashboard/letters/${active.id}`}
                className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent hover:text-accent-strong"
              >
                Edit, export PDF or try another tone <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
              <Sparkles size={20} className="text-accent" />
              Your generated letter will show up here.
            </div>
          )}
        </Card>
      </div>

      {generations.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Recent letters</h2>
            <Link
              href="/dashboard/letters"
              className="text-sm font-medium text-accent hover:text-accent-strong"
            >
              See all →
            </Link>
          </div>
          <Card className="divide-y divide-border overflow-hidden">
            {generations.slice(0, 5).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setActive(g);
                  setRevealId(null);
                }}
                aria-pressed={active?.id === g.id}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-surface-muted",
                  active?.id === g.id && "bg-surface-muted"
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{g.jobTitle}</span>{" "}
                  <span className="text-muted">at {g.company}</span>
                </span>
                <Badge tone="neutral">{toneLabel(g.tone)}</Badge>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {new Date(g.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT, "h-[42px]")}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  max,
  action,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  action?: React.ReactNode;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  const near = value.length > max * 0.9;
  // Not a wrapping <label>: the optional action is a button, and a label
  // labels its first labelable descendant — it would steal the name.
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {action}
      </div>
      <textarea
        {...rest}
        id={id}
        value={value}
        maxLength={max}
        aria-describedby={`${id}-count`}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT, "resize-y py-2.5")}
      />
      <span
        id={`${id}-count`}
        className={cn("mt-1 block text-right text-xs tabular-nums", near ? "text-highlight" : "text-muted")}
      >
        {value.length.toLocaleString()} / {max.toLocaleString()}
      </span>
    </div>
  );
}

/** Reveals a fresh letter word by word (~1s); clicking shows it all at once. */
function RevealText({
  text,
  animate,
  className,
}: {
  text: string;
  animate: boolean;
  className?: string;
}) {
  const words = text.split(/(\s+)/);
  const [count, setCount] = useState(animate ? 0 : words.length);

  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(words.length);
      return;
    }
    const step = Math.max(1, Math.ceil(words.length / 60));
    const id = setInterval(() => {
      setCount((c) => {
        if (c + step >= words.length) clearInterval(id);
        return Math.min(words.length, c + step);
      });
    }, 16);
    return () => clearInterval(id);
  }, [animate, words.length]);

  const done = count >= words.length;
  return (
    <p className={cn(className, !done && "cursor-pointer")} onClick={() => setCount(words.length)}>
      {done ? text : words.slice(0, count).join("")}
      {!done && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
    </p>
  );
}

function LetterSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-3" aria-hidden>
      <div className="h-4 w-1/2 rounded bg-surface-muted" />
      <div className="h-3 w-1/3 rounded bg-surface-muted" />
      <div className="pt-4" />
      {[100, 95, 98, 88, 0, 97, 92, 99, 70, 0, 94, 60].map((w, i) =>
        w === 0 ? (
          <div key={i} className="h-2" />
        ) : (
          <div key={i} className="h-3 rounded bg-surface-muted" style={{ width: `${w}%` }} />
        )
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface-muted"
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
    >
      {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
