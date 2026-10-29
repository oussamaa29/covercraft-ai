"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-surface py-2.5 pl-3.5 pr-11 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

/** 0–4: one point each for ≥8 chars, ≥12 chars, mixed case, a digit or symbol. */
export function passwordScore(pw: string): number {
  if (pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[\d\W_]/.test(pw)) score++;
  return score;
}

const STRENGTH_HINT = [
  "At least 8 characters",
  "Weak — try a longer one, or add a number",
  "Okay — a little longer makes it much stronger",
  "Good",
  "Strong",
];

/**
 * Password field with a show/hide toggle and an optional strength meter.
 * `action` (e.g. a "Forgot password?" link) sits beside the label, outside
 * the <label> element so it can't steal the field's accessible name.
 */
export function PasswordInput({
  label,
  action,
  showStrength = false,
  className,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  action?: React.ReactNode;
  showStrength?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = passwordScore(value);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          {...rest}
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={showStrength ? `${id}-strength` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            onChange?.(e);
          }}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showStrength && (
        <div className="mt-2" id={`${id}-strength`} aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-200",
                  i > score
                    ? "bg-border"
                    : score <= 1
                      ? "bg-highlight"
                      : score === 2
                        ? "bg-accent/50"
                        : "bg-accent"
                )}
              />
            ))}
          </div>
          <p className={cn("mt-1 text-xs", value && score <= 1 ? "text-highlight" : "text-muted")}>
            {value ? STRENGTH_HINT[score] : STRENGTH_HINT[0]}
          </p>
        </div>
      )}
    </div>
  );
}
