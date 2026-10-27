import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

// Hover lifts the filled/bordered variants a pixel and deepens their shadow;
// press squashes slightly. `translate` and `scale` are separate properties in
// Tailwind v4, so the two compose instead of overriding each other.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-sm shadow-accent/20 hover:bg-accent-strong hover:-translate-y-0.5 hover:shadow-md hover:shadow-accent/30",
  secondary:
    "bg-surface-muted text-foreground border border-border hover:bg-border/60 hover:-translate-y-0.5",
  outline:
    "border border-border text-foreground hover:bg-surface-muted hover:border-accent/50 hover:-translate-y-0.5 hover:shadow-sm",
  ghost: "text-foreground hover:bg-surface-muted hover:text-accent-strong",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-7 text-base rounded-xl",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Button styling for elements that aren't <button>/<Link>, e.g. a plain <a>. */
export function buttonClassName({ variant = "primary", size = "md", className }: CommonProps = {}) {
  return cn(
    "group inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={buttonClassName({
        variant,
        size,
        className: cn("disabled:opacity-50 disabled:pointer-events-none", className),
      })}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
}: CommonProps & { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClassName({ variant, size, className })}>
      {children}
    </Link>
  );
}
