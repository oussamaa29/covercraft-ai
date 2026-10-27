"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="font-mono text-sm text-highlight">Error</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        An unexpected error stopped this page from loading. Trying again usually fixes it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Back home
        </ButtonLink>
      </div>
      {/* Production hides the message; the digest matches the server log entry. */}
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-muted">Reference: {error.digest}</p>
      )}
    </div>
  );
}
