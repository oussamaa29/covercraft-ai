"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Phone-only (<sm) menu: the header links plus account actions. */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  // Close after navigating (adjusting state during render, as React
  // recommends over an effect), and on Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = "block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface-muted";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-surface-muted"
      >
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-16 animate-[fade-in_150ms_ease-out] border-b border-border bg-background px-6 pb-5 pt-2 shadow-lg motion-reduce:animate-none"
        >
          <nav aria-label="Mobile" className="space-y-1">
            <Link href="/#how-it-works" className={link}>
              How it works
            </Link>
            <Link href="/pricing" className={link}>
              Pricing
            </Link>
            {signedIn && (
              <>
                <Link href="/dashboard" className={link}>
                  New letter
                </Link>
                <Link href="/dashboard/letters" className={link}>
                  My letters
                </Link>
                <Link href="/dashboard/settings" className={link}>
                  Settings
                </Link>
              </>
            )}
          </nav>
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            {signedIn ? (
              <LogoutButton className="flex-1" />
            ) : (
              <>
                <ButtonLink href="/login" variant="outline" size="sm" className="flex-1">
                  Log in
                </ButtonLink>
                <ButtonLink href="/register" size="sm" className="flex-1">
                  Sign up free
                </ButtonLink>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
