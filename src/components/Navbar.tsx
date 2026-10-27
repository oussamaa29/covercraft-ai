import Link from "next/link";
import { FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/Button";
import { LogoutButton } from "@/components/LogoutButton";
import { UserAvatar } from "@/components/UserAvatar";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileText size={17} strokeWidth={2.25} />
          </span>
          CoverCraft
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
          <Link href="/#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <ButtonLink href="/dashboard" variant="ghost" size="sm">
                Dashboard
              </ButtonLink>
              {/* On phones the bar is too narrow for all three; Log out also
                  lives on the settings page the avatar links to. */}
              <LogoutButton className="hidden sm:inline-flex" />
              <Link
                href="/dashboard/settings"
                aria-label="Account settings"
                title={user.name}
                className="flex rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-border"
              >
                <UserAvatar name={user.name} image={user.image} />
              </Link>
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/register" variant="primary" size="sm">
                Sign up free
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
