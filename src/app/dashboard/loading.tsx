// Rendered inside the dashboard layout, so the nav stays put while a page loads.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 py-10" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-surface-muted" />
      </div>
      <div className="h-16 animate-pulse rounded-card bg-surface-muted" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-card bg-surface-muted" />
        <div className="h-80 animate-pulse rounded-card bg-surface-muted" />
      </div>
    </div>
  );
}
