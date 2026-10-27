import "server-only";
import { NextResponse } from "next/server";
import { configuredAppUrl } from "@/lib/site";

/**
 * CSRF guard for every state-changing route that sets or relies on the
 * session cookie. A cross-site `<form enctype="text/plain">` can smuggle a
 * valid JSON body, and SameSite=Lax doesn't stop the response from *setting*
 * a cookie (login CSRF). So:
 *  - Content-Type must be application/json. Forms can't send it, and a
 *    cross-site fetch that does triggers a CORS preflight we never answer.
 *  - When the browser sends Origin, it must be this site's.
 * Returns the response to send back when the request is refused, else null.
 * The Stripe webhook doesn't use it: it's server-to-server and signed.
 */
export function rejectCrossSite(request: Request): NextResponse | null {
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    return NextResponse.json({ error: "Expected a JSON request" }, { status: 415 });
  }

  const origin = request.headers.get("origin");
  if (origin !== null && !isOwnOrigin(origin, request.headers)) {
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }
  return null;
}

function isOwnOrigin(origin: string, headers: Headers): boolean {
  let originHost: string;
  try {
    // Opaque origins arrive as the literal "null", which doesn't parse.
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // Same hosts Next itself trusts for Server Actions, plus APP_URL for
  // deployments whose proxy rewrites Host.
  const appUrl = configuredAppUrl();
  const ownHosts = [
    headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
    headers.get("host"),
    appUrl ? new URL(appUrl).host : undefined,
  ];
  return ownHosts.some((host) => host?.toLowerCase() === originHost);
}
