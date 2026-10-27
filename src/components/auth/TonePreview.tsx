"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const SAMPLES = {
  Professional:
    "Your posting asks for someone who can own the onboarding flow end to end. At Nimbus I rebuilt ours, cutting time-to-first-value from nine days to three.",
  Friendly:
    "I've been using your product for two years, so seeing you hire for onboarding felt like a sign. At Nimbus I rebuilt ours and loved every minute of it.",
  Confident:
    "You need onboarding that converts. I've done exactly that: at Nimbus I cut time-to-first-value from nine days to three, and I'll do it again for you.",
  Concise:
    "Onboarding owner, 4 years. Rebuilt Nimbus's flow: time-to-first-value 9 → 3 days. Ready to do the same here.",
} as const;

type ToneName = keyof typeof SAMPLES;

/** Small live demo on the auth pages: pick a tone, watch the letter change. */
export function TonePreview() {
  const [tone, setTone] = useState<ToneName>("Professional");

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Letter tone">
        {(Object.keys(SAMPLES) as ToneName[]).map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={tone === name}
            onClick={() => setTone(name)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              tone === name
                ? "bg-accent text-accent-foreground"
                : "bg-surface-muted text-muted hover:text-foreground"
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Product Manager · Lumen
      </p>
      <p key={tone} className="mt-2 animate-[fade-in_250ms_ease-out] text-sm motion-reduce:animate-none leading-relaxed">
        {SAMPLES[tone]}
      </p>
    </div>
  );
}
