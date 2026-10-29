import { Check, Minus } from "lucide-react";

type Cell = boolean | string;

const ROWS: { label: string; values: [Cell, Cell, Cell] }[] = [
  { label: "AI cover letters per month", values: ["3", "Unlimited", "Unlimited"] },
  { label: "Four tones + rewrite in another tone", values: [true, true, true] },
  { label: "Letter history, search & editing", values: [true, true, true] },
  { label: "Saved candidate profiles", values: ["1", "5", "5"] },
  { label: "PDF export", values: ["With small footer", "No watermark", "No watermark"] },
  { label: "Google & GitHub sign-in", values: [true, true, true] },
  { label: "Team seats", values: [false, false, "Up to 5"] },
  { label: "Priority support", values: [false, false, true] },
];

const PLANS = ["Free", "Pro", "Business"];

export function PlanComparison() {
  return (
    // relative: contains the absolutely positioned sr-only labels, which would
    // otherwise escape the scroll box and widen the page on phones.
    <div className="relative overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Plan comparison</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-5 py-4 text-left font-medium text-muted">
              Feature
            </th>
            {PLANS.map((p) => (
              <th
                key={p}
                scope="col"
                className={p === "Pro" ? "px-5 py-4 text-center font-semibold text-accent-strong" : "px-5 py-4 text-center font-semibold"}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ROWS.map(({ label, values }) => (
            <tr key={label} className="transition-colors hover:bg-surface-muted/60">
              <th scope="row" className="px-5 py-3.5 text-left font-normal">
                {label}
              </th>
              {values.map((v, i) => (
                <td key={i} className={i === 1 ? "bg-accent-soft/30 px-5 py-3.5 text-center" : "px-5 py-3.5 text-center"}>
                  {v === true ? (
                    <>
                      <Check size={16} className="mx-auto text-accent" aria-hidden />
                      <span className="sr-only">Included</span>
                    </>
                  ) : v === false ? (
                    <>
                      <Minus size={16} className="mx-auto text-muted/60" aria-hidden />
                      <span className="sr-only">Not included</span>
                    </>
                  ) : (
                    <span className="text-foreground/90">{v}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
