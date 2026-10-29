"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Tone } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { TONE_OPTIONS } from "@/lib/types";

// Hand-written samples (no API call): the landing page stays instant and free.
const JOBS = [
  {
    id: "frontend",
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    letters: {
      PROFESSIONAL:
        "Northwind's move to a component-driven design system is exactly the problem I've spent the last three years on — most recently cutting our UI bug rate by 40% after a similar migration at Nimbus.",
      FRIENDLY:
        "I've followed Northwind's design-system posts for a while, so seeing this role felt like a sign. At Nimbus I led almost the same migration, and it cut our UI bugs by 40% along the way.",
      CONFIDENT:
        "You're rebuilding your frontend on a design system; I've already done that once. At Nimbus I led the migration end to end and cut UI bugs by 40%. I'd like to do it again at Northwind.",
      CONCISE:
        "Design-system migration: done it at Nimbus, UI bugs down 40%. React and TypeScript daily for 5 years. Ready to own Northwind's.",
    },
  },
  {
    id: "designer",
    title: "Product Designer",
    company: "Lumen",
    letters: {
      PROFESSIONAL:
        "Lumen's focus on making onboarding feel effortless matches my recent work: I redesigned Orbit's first-run flow and lifted week-one activation from 31% to 48%.",
      FRIENDLY:
        "Lumen is one of the few apps I recommend to friends, so I'd love to help shape it. My favourite recent project was Orbit's onboarding — activation went from 31% to 48%.",
      CONFIDENT:
        "Onboarding is where products win or lose users, and it's where I do my best work. I took Orbit's week-one activation from 31% to 48%, and I can do the same for Lumen.",
      CONCISE:
        "Product designer, 6 years. Rebuilt Orbit's onboarding: activation 31% → 48%. Strong in research, prototyping and Figma systems.",
    },
  },
  {
    id: "data",
    title: "Data Analyst",
    company: "Orbit Health",
    letters: {
      PROFESSIONAL:
        "Orbit Health's goal of using patient data to cut readmissions is the kind of measurable impact I look for. At CareLink, my readmission model helped reduce 30-day returns by 12%.",
      FRIENDLY:
        "Healthcare data is where I feel I make the most difference, so Orbit Health's mission really resonates. At CareLink I built a readmission model that cut 30-day returns by 12%.",
      CONFIDENT:
        "You want fewer readmissions; I've delivered exactly that. My model at CareLink reduced 30-day returns by 12%, and I'm ready to bring that rigour to Orbit Health.",
      CONCISE:
        "SQL, Python, dbt. Built CareLink's readmission model: 30-day returns −12%. Comfortable presenting to clinicians and execs.",
    },
  },
] as const;

/** Hero demo: pick a sample job and a tone, watch the opening paragraph change. */
export function LiveDemo() {
  const [jobId, setJobId] = useState<(typeof JOBS)[number]["id"]>("frontend");
  const [tone, setTone] = useState<Tone>("CONFIDENT");
  const job = JOBS.find((j) => j.id === jobId) ?? JOBS[0];
  const text = job.letters[tone];

  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-xl shadow-foreground/[0.03] sm:p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Try it — pick a job</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Sample job">
        {JOBS.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-pressed={jobId === j.id}
            onClick={() => setJobId(j.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150",
              jobId === j.id
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:border-accent/40 hover:text-foreground"
            )}
          >
            {j.title}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-sm font-medium">{job.title}</p>
          <p className="text-xs text-muted">at {job.company}</p>
        </div>
        <Badge tone="accent">
          <Sparkles size={12} /> Tailored
        </Badge>
      </div>

      <p
        key={`${jobId}-${tone}`}
        aria-live="polite"
        className="mt-5 min-h-[7.5rem] animate-[fade-in_250ms_ease-out] text-sm leading-relaxed text-foreground/85 motion-reduce:animate-none"
      >
        {text}
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Tone">
        {TONE_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={tone === t.value}
            onClick={() => setTone(t.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              tone === t.value
                ? "bg-accent text-accent-foreground"
                : "bg-surface-muted text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-muted tabular-nums">
          {text.split(/\s+/).length} words
        </span>
      </div>
    </div>
  );
}
