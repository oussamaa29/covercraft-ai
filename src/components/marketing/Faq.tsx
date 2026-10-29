import { ChevronDown } from "lucide-react";

export const FAQ = [
  {
    q: "How does CoverCraft write the letter?",
    a: "It reads the job description you paste and the background you give it, then drafts a letter that connects the two — in the tone you pick. You can edit it, rewrite it in another tone, or export it as a PDF.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel your subscription anytime from the billing page — it's a self-service Stripe portal, no email required.",
  },
  {
    q: "What happens to my letters if I downgrade?",
    a: "Nothing gets deleted. Your history stays; you'll just be limited to 3 new letters per month again on the Free plan.",
  },
  {
    q: "Do you store my job descriptions?",
    a: "Yes — with the letter, so you can rewrite it in another tone later. Deleting a letter (or your account) deletes them too. Nothing is shared or used for anything else.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "The Free plan itself works as an ongoing trial — 3 real letters a month, no time limit and no card required.",
  },
  {
    q: "What's the difference between monthly and yearly?",
    a: "Same features. Yearly is billed once and works out to two months free.",
  },
];

/** Accessible accordion built on <details>: keyboard and screen readers for free. */
export function Faq({ items = FAQ }: { items?: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-border rounded-card border border-border bg-surface">
      {items.map(({ q, a }) => (
        <details key={q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft">
            {q}
            <ChevronDown
              size={18}
              className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="animate-[fade-in_200ms_ease-out] pb-4 text-sm leading-relaxed text-muted motion-reduce:animate-none">
            {a}
          </p>
        </details>
      ))}
    </div>
  );
}
