import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "accent" | "neutral" | "highlight";

const toneClasses: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-strong",
  neutral: "bg-surface-muted text-muted",
  highlight: "bg-highlight-soft text-highlight",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: { tone?: Tone } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
