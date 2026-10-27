import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="sm:hidden">
        <DashboardNav variant="bar" />
      </div>
      <div className="flex gap-8">
        <aside className="hidden w-48 shrink-0 py-10 sm:block">
          <DashboardNav variant="sidebar" />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
