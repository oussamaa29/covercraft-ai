import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="font-mono text-sm text-accent">404</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page doesn&rsquo;t exist, or it moved. Nothing you did wrong.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Back home</ButtonLink>
        <ButtonLink href="/dashboard" variant="outline">
          Go to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
