import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { PlanId } from "@/lib/plans";

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

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Badge tone={plan === "FREE" ? "neutral" : "accent"}>{plan}</Badge>
        <span className="text-sm text-muted">
          {isUnlimited ? "Unlimited generations" : `${used} / ${limit} generations this month`}
        </span>
      </div>

      {!isUnlimited && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {atLimit && (
            <Link href="/dashboard/billing" className="text-xs font-medium text-accent hover:underline">
              Upgrade
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
