import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Choose a new password — CoverCraft",
  // The token is in the URL: keep these pages out of search engines.
  robots: { index: false },
};

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      {typeof token === "string" && token.length >= 20 ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted">
            This reset link is incomplete. Open the link from the email again, or request a new
            one.
          </p>
          <ButtonLink href="/forgot-password" className="w-full">
            Request a new link
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
