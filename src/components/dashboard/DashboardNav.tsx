"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, PenLine, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/dashboard", label: "New letter", icon: PenLine },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  // "/dashboard" is a prefix of every other link, so it only matches exactly.
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical sidebar on ≥sm, horizontal scrollable bar below it. */
export function DashboardNav({ variant }: { variant: "sidebar" | "bar" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className={
        variant === "sidebar"
          ? "space-y-1 text-sm"
          : "-mx-6 flex gap-1 overflow-x-auto border-b border-border/70 px-6 py-3 text-sm"
      }
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium",
              variant === "bar" && "shrink-0",
              active
                ? "bg-surface-muted text-foreground"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            )}
          >
            <Icon size={16} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
