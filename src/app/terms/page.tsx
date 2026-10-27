import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms — CoverCraft" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="October 27, 2026"
      intro={
        <p>
          CoverCraft is a portfolio project that demonstrates a small SaaS end to end. You&rsquo;re
          welcome to use it; these terms just set honest expectations.
        </p>
      }
    >
      <LegalSection title="The service">
        <p>
          It&rsquo;s provided as is, without warranties or uptime guarantees. It may change, be
          reset, or be taken offline. Keep your own copy of any letter you care about.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          Keep your login to yourself and use an email address you control. You&rsquo;re
          responsible for what happens under your account.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <ul>
          <li>No attempts to break, overload or get around the limits of the service.</li>
          <li>No automated or bulk generation, scraping, or reselling.</li>
          <li>Nothing illegal, harassing, or that infringes someone else&rsquo;s rights.</li>
        </ul>
        <p>Accounts that break these rules may be removed.</p>
      </LegalSection>

      <LegalSection title="AI-generated letters">
        <p>
          Letters are drafts written by an AI model (or a labeled demo template when AI is
          switched off). They can be wrong or miss the point — read and edit them before you
          send anything. What you write and generate is yours.
        </p>
      </LegalSection>

      <LegalSection title="Plans and billing">
        <p>
          Paid plans are handled by Stripe and renew monthly until cancelled. You can cancel
          any time from the billing page. On the public demo Stripe runs in test mode, so no
          real money is charged.
        </p>
      </LegalSection>

      <LegalSection title="Leaving">
        <p>
          You can delete your account whenever you like from{" "}
          <Link href="/dashboard/settings" className="font-medium text-foreground hover:text-accent">
            Settings
          </Link>
          . See the{" "}
          <Link href="/privacy" className="font-medium text-foreground hover:text-accent">
            privacy page
          </Link>{" "}
          for what that removes.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
