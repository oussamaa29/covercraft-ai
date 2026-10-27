import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy — CoverCraft" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="October 27, 2026"
      intro={
        <p>
          CoverCraft is a portfolio project built and run by one developer. It stores the
          minimum it needs to work, doesn&rsquo;t sell or share your data, and runs no
          analytics or ad trackers. Here&rsquo;s exactly what that means.
        </p>
      }
    >
      <LegalSection title="What's stored">
        <ul>
          <li>
            <strong>Your account:</strong> email address, name, and — if you set one — a
            bcrypt hash of your password (never the password itself).
          </li>
          <li>
            <strong>Profile picture:</strong> the avatar URL Google or GitHub provides, if you
            sign in with them. The image itself stays on their servers.
          </li>
          <li>
            <strong>Connected sign-ins:</strong> which provider, your account ID there, and the
            email it reported.
          </li>
          <li>
            <strong>Your letters:</strong> the job title, company, tone and generated text of
            each cover letter, so your history is there next time. The job description and
            background you paste are used to generate the letter and aren&rsquo;t saved.
          </li>
          <li>
            <strong>Billing:</strong> your plan plus Stripe&rsquo;s customer and subscription
            IDs. Card details go straight to Stripe and never touch CoverCraft.
          </li>
          <li>
            <strong>Abuse protection:</strong> short-lived counters keyed by IP address (and
            email, for log-in attempts) that slow down password guessing. Old ones are
            cleared out automatically.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who else sees it">
        <ul>
          <li>
            <strong>Anthropic</strong> receives the job details and background you submit when
            real AI generation is switched on, to write the letter.
          </li>
          <li>
            <strong>Stripe</strong> processes payments if you upgrade.
          </li>
          <li>
            <strong>The hosting and database providers</strong> store the data above and may
            keep standard request logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          One session cookie (<code>cc_session</code>, HTTP-only, 30 days) keeps you logged in.
          While you sign in with Google or GitHub, a few extra cookies live for at most 10
          minutes to protect that step from forgery, then they&rsquo;re deleted. That&rsquo;s
          all — no analytics, advertising or third-party cookies on this site.
        </p>
      </LegalSection>

      <LegalSection title="Google and GitHub sign-in">
        <p>Only the permissions needed to identify you are requested:</p>
        <ul>
          <li>
            <strong>Google</strong> (<code>openid profile email</code>): your Google account ID,
            name, email address and whether Google has verified it, and your profile picture.
          </li>
          <li>
            <strong>GitHub</strong> (<code>read:user user:email</code>): your GitHub user ID,
            username, name and avatar, plus your email addresses — only the primary one is
            kept.
          </li>
        </ul>
        <p>
          The access token is used once during sign-in to read that profile, then thrown away.
          CoverCraft can&rsquo;t post, read your repositories or access anything else.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          Go to <Link href="/dashboard/settings" className="font-medium text-foreground hover:text-accent">Settings</Link>{" "}
          → Danger zone. Deleting your account immediately removes your account, letters and
          connected sign-ins, and cancels any active subscription. Stripe keeps its own payment
          records as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Open an issue or get in touch through{" "}
          <a
            href="https://github.com/oussamaa29"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-accent"
          >
            GitHub
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
