import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import {
  OAUTH_COOKIES,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_COOKIE_PATH,
  createAuthorizationUrl,
  isProviderEnabled,
  isProviderSlug,
  type OAuthIntent,
} from "@/lib/oauth";
import { safeNextPath } from "@/lib/validation";

// Starts the OAuth flow: remembers state (+ PKCE verifier) in short-lived
// cookies scoped to /api/auth/oauth, then sends the browser to the provider.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/oauth/[provider]">
) {
  const { provider } = await ctx.params;
  if (!isProviderSlug(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const intent: OAuthIntent = params.get("intent") === "link" ? "link" : "login";
  const errorPage = intent === "link" ? "/dashboard/settings" : "/login";

  if (!isProviderEnabled(provider)) {
    return NextResponse.redirect(new URL(`${errorPage}?error=provider_disabled`, request.url));
  }

  let next = safeNextPath(params.get("next"));
  if (intent === "link") {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(
        new URL("/login?error=login_required&next=%2Fdashboard%2Fsettings", request.url)
      );
    }
    next = "/dashboard/settings";
  }

  const { url, state, codeVerifier } = createAuthorizationUrl(provider, request.nextUrl.origin);

  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // lax (not strict) so the cookies come back on the provider's top-level
    // redirect to our callback.
    sameSite: "lax" as const,
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
  store.set(OAUTH_COOKIES.state, state, options);
  if (codeVerifier) store.set(OAUTH_COOKIES.verifier, codeVerifier, options);
  else store.delete({ name: OAUTH_COOKIES.verifier, path: OAUTH_COOKIE_PATH });
  store.set(OAUTH_COOKIES.next, next, options);
  store.set(OAUTH_COOKIES.intent, intent, options);

  return NextResponse.redirect(url);
}
