"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { PlanId } from "@/lib/plans";

function nextMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });
}

export function UsageMeter({
  plan,
  used,
  limit,
}: {
  plan: PlanId;
  used: number;
  limit: number;
}) {
  const isUnlimited = limit === Infinity;
  const pct = isUnlimited ? 0 : Math.min(100, (used / Math.max(limit, 1)) * 100);
  const atLimit = !isUnlimited && used >= limit;
  // Start at 0 and grow to the real value after mount, so the bar animates in.
  const [shown, setShown] = useState(0);
  const [resetsOn, setResetsOn] = useState<string | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  // Formatted client-side: the date depends on the viewer's timezone/locale.
  useEffect(() => setResetsOn(nextMonthStart()), []);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between",
        atLimit ? "border-highlight/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-3">
        <Badge tone={plan === "FREE" ? "neutral" : "accent"}>{plan}</Badge>
        <span className={cn("text-sm", atLimit ? "text-highlight" : "text-muted")}>
          {isUnlimited
            ? "Unlimited generations"
            : atLimit
              ? `All ${limit} letters used this month`
              : `${used} / ${limit} letters this month`}
          {!isUnlimited && resetsOn && (
            <span className="text-muted"> · resets {resetsOn}</span>
          )}
        </span>
      </div>

      {!isUnlimited && (
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-label="Letters used this month"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={used}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                atLimit ? "bg-highlight" : "bg-accent"
              )}
              style={{ width: `${shown}%` }}
            />
          </div>
          <Link
            href="/dashboard/billing"
            className={cn(
              "text-xs font-medium hover:underline",
              atLimit ? "rounded-lg bg-accent px-2.5 py-1 text-accent-foreground hover:no-underline hover:bg-accent-strong" : "text-accent"
            )}
          >
            {atLimit ? "Upgrade to Pro" : "Upgrade"}
          </Link>
        </div>
      )}
    </div>
  );
}
