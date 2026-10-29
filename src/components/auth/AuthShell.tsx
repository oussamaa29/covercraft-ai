import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TonePreview } from "@/components/auth/TonePreview";

const BENEFITS = [
  "References the actual job description, not a template",
  "Four tones, regenerate in one click",
  "3 free letters a month — no card required",
];

/**
 * Shared layout for /login and /register: fills the viewport under the navbar
 * so the form is visible without scrolling, with a product preview beside it
 * on wide screens instead of empty margins.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-12 px-6 py-8 lg:grid-cols-2">
      <aside className="hidden lg:block">
        {/* A <p>, not a heading: it sits before the page's <h1> in DOM order. */}
        <p className="text-3xl font-semibold tracking-tight">
          A cover letter that sounds like you, <span className="text-accent">in seconds.</span>
        </p>
        <ul className="mt-6 space-y-3 text-sm text-muted">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <Check size={12} strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-8 max-w-md">
          <p className="mb-2 text-xs text-muted">Try it — pick a tone:</p>
          <TonePreview />
        </div>
      </aside>

      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-5 text-sm text-muted">{subtitle}</p>
        <Card className="p-6">{children}</Card>
      </div>
    </div>
  );
}
