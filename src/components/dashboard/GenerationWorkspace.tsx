"use client";

import { useState, type FormEvent } from "react";
import { Copy, Check, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { UsageMeter } from "@/components/dashboard/UsageMeter";
import type { GenerationDTO } from "@/lib/types";
import type { PlanId } from "@/lib/plans";
import type { Tone } from "@prisma/client";

const TONES: { value: Tone; label: string }[] = [
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "FRIENDLY", label: "Friendly" },
  { value: "CONFIDENT", label: "Confident" },
  { value: "CONCISE", label: "Concise" },
];

interface Props {
  userName: string;
  plan: PlanId;
  limit: number;
  usedThisMonth: number;
  initialGenerations: GenerationDTO[];
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
  aiLabel,
  aiIsDemo,
  aiIsLocal,
}: Props) {
  const [generations, setGenerations] = useState(initialGenerations);
  const [used, setUsed] = useState(usedThisMonth);
  const [active, setActive] = useState<GenerationDTO | null>(initialGenerations[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      candidateName: form.get("candidateName"),
      jobTitle: form.get("jobTitle"),
      company: form.get("company"),
      jobDescription: form.get("jobDescription"),
      background: form.get("background") ?? "",
      tone: form.get("tone"),
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      const generation: GenerationDTO = data.generation;
      setGenerations((prev) => [generation, ...prev]);
      setActive(generation);
      setUsed((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const limitReached = limit !== Infinity && used >= limit;

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
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Your name" name="candidateName" defaultValue={userName} required />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Tone</span>
                <select
                  name="tone"
                  defaultValue="PROFESSIONAL"
                  className="h-[42px] w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Job title" name="jobTitle" placeholder="Senior Frontend Engineer" required />
              <Field label="Company" name="company" placeholder="Northwind Labs" required />
            </div>
            <TextArea
              label="Job description"
              name="jobDescription"
              rows={6}
              placeholder="Paste the job posting here…"
              required
            />
            <TextArea
              label="Your background (optional)"
              name="background"
              rows={3}
              placeholder="A few lines about relevant experience…"
            />
            <Button type="submit" className="w-full" disabled={loading || limitReached}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Generating…
                </>
              ) : limitReached ? (
                "Monthly limit reached"
              ) : (
                "Generate letter"
              )}
            </Button>
            {loading && aiIsLocal && (
              <p className="text-center text-xs text-muted" role="status">
                Running on a local model — the first letter can take up to a minute.
              </p>
            )}
          </form>
        </Card>

        <Card className="flex flex-col p-6">
          {active ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{active.jobTitle}</p>
                  <p className="text-sm text-muted">at {active.company}</p>
                </div>
                <CopyButton text={active.content} />
              </div>
              <p className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {active.content}
              </p>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-muted">
              Your generated letter will show up here.
            </div>
          )}
        </Card>
      </div>

      {generations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">History</h2>
          <Card className="divide-y divide-border">
            {generations.map((g) => (
              <button
                key={g.id}
                onClick={() => setActive(g)}
                className={`flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-surface-muted ${
                  active?.id === g.id ? "bg-surface-muted" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{g.jobTitle}</span>{" "}
                  <span className="text-muted">at {g.company}</span>
                </span>
                <Badge tone="neutral">{g.tone}</Badge>
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

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...rest}
        className="h-[42px] w-full rounded-lg border border-border bg-surface px-3.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
    </label>
  );
}

function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }
) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        {...rest}
        className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
    </label>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
    >
      {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
