import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { enabledProviders } from "@/lib/oauth";
import { oauthErrorMessage } from "@/lib/oauth-errors";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Log in — CoverCraft" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = safeNextPath(searchParams.next);
  const error = oauthErrorMessage(searchParams.error);

  return (
    <AuthShell title="Welcome back" subtitle="Log in to keep drafting.">
      {error && (
        <p className="mb-5 rounded-lg bg-highlight-soft px-4 py-3 text-sm text-highlight">
          {error}
        </p>
      )}
      <OAuthButtons enabled={enabledProviders()} next={next} />
      <LoginForm next={next} />
    </AuthShell>
  );
}
