"use client"; // Error boundaries must be Client Components

import "./globals.css";

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it brings its own <html>/<body> and stays dependency-free.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-6 font-sans text-foreground antialiased">
        <title>Something went wrong — CoverCraft</title>
        <div className="max-w-md text-center">
          <span className="font-mono text-sm text-highlight">Error</span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            CoverCraft couldn&apos;t load. This is usually temporary — please try again.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent-strong"
            >
              Try again
            </button>
            {/* A plain <a>: a full reload is the point when the layout is broken. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-surface-muted"
            >
              Back home
            </a>
          </div>
          {error.digest && (
            <p className="mt-6 font-mono text-xs text-muted">Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
