import { Button, buttonClassName } from "@/components/ui/Button";
import { PROVIDER_ICONS } from "@/components/auth/ProviderIcons";

const PROVIDERS = [
  { slug: "google", label: "Google" },
  { slug: "github", label: "GitHub" },
] as const;

type Slug = (typeof PROVIDERS)[number]["slug"];

/**
 * "Continue with …" buttons above the email form. Unconfigured providers stay
 * visible but disabled, so the feature is still discoverable in demo mode.
 */
export function OAuthButtons({
  enabled,
  next,
}: {
  enabled: Record<Slug, boolean>;
  next?: string;
}) {
  const disabled = PROVIDERS.filter((p) => !enabled[p.slug]);
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(({ slug, label }) => {
          const Icon = PROVIDER_ICONS[slug];
          // Side by side to keep the form above the fold; the hidden prefix
          // keeps the accessible name "Continue with …".
          const text = (
            <>
              <span className="transition-transform duration-150 group-hover:scale-110 motion-reduce:group-hover:scale-100">
                <Icon />
              </span>
              <span className="sr-only">Continue with </span>
              {label}
            </>
          );
          return enabled[slug] ? (
            // A plain <a>, not <Link>: the target is a route handler that sets
            // cookies and redirects off-site, which must never be prefetched.
            <a
              key={slug}
              href={`/api/auth/oauth/${slug}${query}`}
              className={buttonClassName({ variant: "outline", className: "w-full" })}
            >
              {text}
            </a>
          ) : (
            // aria-disabled instead of `disabled` so hover still works and can
            // explain why the button is inert.
            <span key={slug} className="group/tip relative">
              <Button
                type="button"
                variant="outline"
                aria-disabled="true"
                aria-describedby={`oauth-${slug}-tip`}
                className="w-full cursor-not-allowed text-muted hover:translate-y-0 hover:shadow-none active:scale-100"
              >
                {text}
              </Button>
              <span
                id={`oauth-${slug}-tip`}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background opacity-0 shadow-sm transition-all duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100"
              >
                {label} sign-in isn&apos;t configured in this demo
              </span>
            </span>
          );
        })}
      </div>

      {disabled.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted">
          {disabled.length === PROVIDERS.length
            ? "Not configured in this demo"
            : `${disabled[0].label} sign-in: not configured in this demo`}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3" role="separator">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
