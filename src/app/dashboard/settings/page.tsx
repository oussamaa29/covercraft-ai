import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDERS, PROVIDER_SLUGS, enabledProviders, isProviderSlug } from "@/lib/oauth";
import { oauthErrorMessage } from "@/lib/oauth-errors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { UserAvatar } from "@/components/UserAvatar";
import { PROVIDER_ICONS } from "@/components/auth/ProviderIcons";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { DisconnectButton } from "@/components/settings/DisconnectButton";
import { SessionControls } from "@/components/settings/SessionControls";
import { DeleteAccountForm } from "@/components/settings/DeleteAccountForm";
import { CandidateProfiles } from "@/components/settings/CandidateProfiles";
import { profileLimitFor } from "@/lib/plans";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Settings — CoverCraft" };

function Section({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default async function SettingsPage(props: PageProps<"/dashboard/settings">) {
  const user = await requireUser("/dashboard/settings");
  const searchParams = await props.searchParams;

  const [accounts, profiles] = await Promise.all([
    db.account.findMany({
      where: { userId: user.id },
      select: { provider: true, email: true },
    }),
    db.candidateProfile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, fullName: true, background: true },
    }),
  ]);
  const enabled = enabledProviders();
  const linked =
    typeof searchParams.linked === "string" && isProviderSlug(searchParams.linked)
      ? PROVIDERS[searchParams.linked].label
      : null;
  const error = oauthErrorMessage(searchParams.error);
  const hasPassword = Boolean(user.password);
  const hasSubscription = Boolean(user.stripeSubscriptionId) && user.plan !== "FREE";

  return (
    <div className="space-y-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Your profile, saved backgrounds, sign-in methods and sessions.</p>
      </div>

      {linked && (
        <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-strong">
          <CheckCircle2 size={16} /> {linked} connected — you can now log in with it.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">{error}</p>
      )}

      <Section title="Profile" description="How you appear in CoverCraft.">
        <div className="mb-5 flex items-center gap-3">
          <UserAvatar name={user.name} image={user.image} size="lg" />
          <p className="text-sm text-muted">
            {user.image
              ? "Profile picture from your connected Google or GitHub account."
              : "No profile picture yet — connecting Google or GitHub adds theirs."}
          </p>
        </div>
        <ProfileForm name={user.name} email={user.email} />
      </Section>

      <Section
        title="Candidate profiles"
        description="Save your background once, then pick it on the New letter page instead of retyping it."
      >
        <CandidateProfiles
          initial={profiles}
          limit={profileLimitFor(user.plan)}
          defaultName={user.name}
        />
      </Section>

      <Section
        title="Connected accounts"
        description="Log in with Google or GitHub instead of a password."
      >
        <ul className="divide-y divide-border">
          {PROVIDER_SLUGS.map((slug) => {
            const { id, label } = PROVIDERS[slug];
            const Icon = PROVIDER_ICONS[slug];
            const account = accounts.find((a) => a.provider === id);
            return (
              <li
                key={slug}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border">
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {label}
                      {account && <Badge tone="accent">Connected</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {account
                        ? (account.email ?? "Connected")
                        : enabled[slug]
                          ? "Not connected"
                          : "Not configured in this demo"}
                    </p>
                  </div>
                </div>
                {account ? (
                  <DisconnectButton provider={slug} />
                ) : enabled[slug] ? (
                  // Plain <a>: the OAuth start route sets cookies and must not be prefetched.
                  <a
                    href={`/api/auth/oauth/${slug}?intent=link`}
                    className={buttonClassName({ variant: "outline", size: "sm" })}
                  >
                    Connect
                  </a>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Connect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Password"
        description={
          hasPassword
            ? "Change the password you log in with."
            : "You sign in with Google or GitHub. Add a password to log in with your email too."
        }
      >
        <PasswordForm hasPassword={hasPassword} />
      </Section>

      <Section
        title="Sessions"
        description="Lost a device or logged in somewhere shared? Sign out everywhere except here."
      >
        <SessionControls />
      </Section>

      <Section
        title="Danger zone"
        description={`Permanently deletes your account, your saved letters and connected sign-ins${
          hasSubscription ? ", and cancels your subscription" : ""
        }. There's no undo.`}
        className="border-highlight/40"
      >
        <DeleteAccountForm email={user.email} />
      </Section>
    </div>
  );
}
