import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, Tone } from "@prisma/client";
import { FileText, PenLine, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { TONE_OPTIONS, toneLabel } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "My letters — CoverCraft" };

const PAGE_SIZE = 12;

type Filters = { q: string; tone?: Tone; sort: "new" | "old"; page: number };

function hrefFor(filters: Filters, patch: Partial<Filters>): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.tone) params.set("tone", next.tone);
  if (next.sort === "old") params.set("sort", "old");
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/dashboard/letters?${qs}` : "/dashboard/letters";
}

export default async function LettersPage(props: PageProps<"/dashboard/letters">) {
  const user = await requireUser("/dashboard/letters");
  const sp = await props.searchParams;

  const rawTone = typeof sp.tone === "string" ? sp.tone : undefined;
  const filters: Filters = {
    q: typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "",
    tone: TONE_OPTIONS.some((t) => t.value === rawTone) ? (rawTone as Tone) : undefined,
    sort: sp.sort === "old" ? "old" : "new",
    page: Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1),
  };

  const where: Prisma.GenerationWhereInput = {
    userId: user.id,
    ...(filters.tone && { tone: filters.tone }),
    ...(filters.q && {
      OR: [
        { jobTitle: { contains: filters.q, mode: "insensitive" } },
        { company: { contains: filters.q, mode: "insensitive" } },
      ],
    }),
  };

  const [letters, matching, total] = await Promise.all([
    db.generation.findMany({
      where,
      orderBy: { createdAt: filters.sort === "old" ? "asc" : "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.generation.count({ where }),
    db.generation.count({ where: { userId: user.id } }),
  ]);
  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const filtered = Boolean(filters.q || filters.tone);

  return (
    <div className="space-y-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My letters</h1>
          <p className="mt-1 text-sm text-muted">
            {total === 0
              ? "Every letter you write is saved here."
              : `${total} letter${total === 1 ? "" : "s"} saved`}
          </p>
        </div>
        <ButtonLink href="/dashboard" size="sm">
          <PenLine size={15} /> New letter
        </ButtonLink>
      </div>

      {total === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <FileText size={22} />
          </span>
          <p className="mt-4 font-medium">No letters yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Paste a job description on the New letter page and your first tailored letter will
            land here.
          </p>
          <ButtonLink href="/dashboard" className="mt-6">
            Write my first letter
          </ButtonLink>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* A plain GET form: search works without client JS and the URL stays shareable. */}
            <form action="/dashboard/letters" className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                name="q"
                defaultValue={filters.q}
                placeholder="Search by job title or company…"
                aria-label="Search letters"
                className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              {filters.tone && <input type="hidden" name="tone" value={filters.tone} />}
              {filters.sort === "old" && <input type="hidden" name="sort" value="old" />}
            </form>
            <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Filter by tone">
              <FilterChip href={hrefFor(filters, { tone: undefined, page: 1 })} active={!filters.tone}>
                All tones
              </FilterChip>
              {TONE_OPTIONS.map((t) => (
                <FilterChip
                  key={t.value}
                  href={hrefFor(filters, { tone: t.value, page: 1 })}
                  active={filters.tone === t.value}
                >
                  {t.label}
                </FilterChip>
              ))}
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
              <FilterChip
                href={hrefFor(filters, { sort: filters.sort === "new" ? "old" : "new", page: 1 })}
                active={false}
              >
                {filters.sort === "new" ? "Newest first" : "Oldest first"} ↕
              </FilterChip>
            </div>
          </div>

          {letters.length === 0 ? (
            <Card className="px-6 py-12 text-center text-sm text-muted">
              No letters match{filters.q ? ` “${filters.q}”` : ""}
              {filters.tone ? ` in ${toneLabel(filters.tone)} tone` : ""}.{" "}
              <Link href="/dashboard/letters" className="font-medium text-foreground hover:text-accent">
                Clear filters
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {letters.map((l) => (
                <Link
                  key={l.id}
                  href={`/dashboard/letters/${l.id}`}
                  className="group rounded-card border border-border bg-surface p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium group-hover:text-accent-strong">
                        {l.jobTitle}
                      </p>
                      <p className="truncate text-sm text-muted">at {l.company}</p>
                    </div>
                    <Badge tone="neutral" className="shrink-0">
                      {toneLabel(l.tone)}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                    {l.content}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    {l.createdAt.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              <PageLink href={hrefFor(filters, { page: filters.page - 1 })} disabled={filters.page <= 1}>
                ← Previous
              </PageLink>
              <span className="text-muted">
                Page {filters.page} of {pages}
              </span>
              <PageLink href={hrefFor(filters, { page: filters.page + 1 })} disabled={filters.page >= pages}>
                Next →
              </PageLink>
            </nav>
          )}
          {filtered && letters.length > 0 && (
            <p className="text-xs text-muted">
              {matching} matching letter{matching === 1 ? "" : "s"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "bg-surface-muted text-muted hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) return <span className="px-3 py-1.5 text-muted/50">{children}</span>;
  return (
    <Link href={href} className="rounded-lg px-3 py-1.5 font-medium hover:bg-surface-muted">
      {children}
    </Link>
  );
}
