import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { enabledProviders } from "@/lib/oauth";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Sign up — CoverCraft" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const searchParams = await props.searchParams;
  const rawPlan = typeof searchParams.plan === "string" ? searchParams.plan : undefined;
  const plan = rawPlan && Object.hasOwn(PLANS, rawPlan) ? (rawPlan as PlanId) : undefined;
  const isPaidPlan = plan !== undefined && plan !== "FREE";

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        isPaidPlan
          ? `You'll be sent to checkout for the ${PLANS[plan].name} plan right after.`
          : "Free forever — 3 cover letters a month, no card required."
      }
    >
      {/* OAuth signups land on the billing page, which starts the same
          checkout RegisterForm starts after an email signup. */}
      <OAuthButtons
        enabled={enabledProviders()}
        next={isPaidPlan ? `/dashboard/billing?checkout=${plan}` : undefined}
      />
      <RegisterForm plan={plan} />
    </AuthShell>
  );
}
