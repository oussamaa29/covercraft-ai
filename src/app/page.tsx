import {
  Sparkles,
  Zap,
  ShieldCheck,
  FileDown,
  History,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PricingCards } from "@/components/PricingCards";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Tailored, not templated",
    description:
      "Every letter is generated from the actual job description and your background — no fill-in-the-blank templates.",
  },
  {
    icon: Zap,
    title: "Ready in seconds",
    description: "Paste a job post, pick a tone, and get a polished draft before your coffee cools down.",
  },
  {
    icon: SlidersHorizontal,
    title: "Four tones to match the role",
    description: "Professional, friendly, confident, or concise — switch tone without rewriting from scratch.",
  },
  {
    icon: History,
    title: "Full history",
    description: "Every letter you generate is saved to your account so you can revisit or reuse it later.",
  },
  {
    icon: FileDown,
    title: "Clean export",
    description: "Pro plans export watermark-free, ready to paste into an email or application form.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    description: "Passwords are hashed, sessions are signed, and billing runs entirely through Stripe.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Paste the job post",
    description: "Drop in the job title, company, and description you're applying to.",
  },
  {
    step: "02",
    title: "Add your background",
    description: "A few lines about your experience — CoverCraft finds the overlap.",
  },
  {
    step: "03",
    title: "Get your letter",
    description: "A tailored draft lands in seconds, saved to your history for later.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-2 lg:items-center lg:pt-28">
        <div>
          <Badge tone="accent">
            <Sparkles size={13} /> AI cover letters
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            A tailored cover letter for every application, in seconds.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Stop rewriting the same paragraph. CoverCraft reads the job description and your
            background, then drafts a letter that actually references both.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink href={user ? "/dashboard" : "/register"} size="lg">
              {user ? "Go to dashboard" : "Start for free"} <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href="/pricing" variant="outline" size="lg">
              See pricing
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-muted">No credit card required for the free plan.</p>
        </div>

        <Card className="p-6 shadow-xl shadow-foreground/[0.03] sm:p-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-sm font-medium">Senior Frontend Engineer</p>
              <p className="text-xs text-muted">at Northwind Labs</p>
            </div>
            <Badge tone="accent">Generated in 4s</Badge>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-relaxed text-foreground/80">
            <p>
              Northwind&rsquo;s move to a component-driven design system is exactly the kind of
              problem I&rsquo;ve spent the last three years solving&mdash;most recently cutting our
              own team&rsquo;s UI bugs by 40% after a similar migration.
            </p>
            <p className="text-foreground/50">
              I&rsquo;d welcome the chance to bring that experience to your platform team&hellip;
            </p>
          </div>
          <div className="mt-6 flex gap-2">
            <Badge tone="neutral">Confident tone</Badge>
            <Badge tone="neutral">312 words</Badge>
          </div>
        </Card>
      </section>

      <section id="how-it-works" className="border-y border-border/70 bg-surface-muted/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step}>
                <span className="text-sm font-mono text-accent">{s.step}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Everything you need to apply faster</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-card border border-border p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-border/70 bg-surface-muted/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Simple, transparent pricing</h2>
            <p className="mt-2 text-muted">Start free. Upgrade the moment it&rsquo;s paying for itself.</p>
          </div>
          <PricingCards isAuthenticated={Boolean(user)} currentPlan={user?.plan} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Ready to stop starting from a blank page?</h2>
        <div className="mt-6">
          <ButtonLink href={user ? "/dashboard" : "/register"} size="lg">
            {user ? "Go to dashboard" : "Create your first letter"} <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
