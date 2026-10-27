import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSession, getCurrentUser } from "@/lib/auth";
import {
  OAUTH_COOKIES,
  OAUTH_COOKIE_PATH,
  fetchOAuthProfile,
  isProviderEnabled,
  isProviderSlug,
  resolveOAuthUser,
} from "@/lib/oauth";
import type { OAuthErrorCode } from "@/lib/oauth-errors";
import { safeNextPath } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/oauth/[provider]/callback">
) {
  const { provider } = await ctx.params;
  if (!isProviderSlug(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const store = await cookies();
  const storedState = store.get(OAUTH_COOKIES.state)?.value;
  const codeVerifier = store.get(OAUTH_COOKIES.verifier)?.value ?? null;
  const intent = store.get(OAUTH_COOKIES.intent)?.value === "link" ? "link" : "login";
  const next = safeNextPath(store.get(OAUTH_COOKIES.next)?.value);

  // One-shot: whatever happens below, this state can't be replayed.
  for (const name of Object.values(OAUTH_COOKIES)) {
    store.delete({ name, path: OAUTH_COOKIE_PATH });
  }

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const fail = (code: OAuthErrorCode) =>
    redirectTo(`${intent === "link" ? "/dashboard/settings" : "/login"}?error=${code}`);

  if (!isProviderEnabled(provider)) return fail("provider_disabled");

  const params = request.nextUrl.searchParams;
  const providerError = params.get("error");
  if (providerError) {
    return fail(providerError === "access_denied" ? "oauth_denied" : "oauth_failed");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !storedState || state !== storedState) {
    return fail("invalid_state");
  }

  let linkToUserId: string | undefined;
  if (intent === "link") {
    const current = await getCurrentUser();
    if (!current) {
      return redirectTo("/login?error=login_required&next=%2Fdashboard%2Fsettings");
    }
    linkToUserId = current.id;
  }

  let result;
  try {
    const profile = await fetchOAuthProfile(provider, code, codeVerifier, request.nextUrl.origin);
    result = await resolveOAuthUser(profile, { linkToUserId });
  } catch (err) {
    // Details go to the server log only; the browser just gets a code.
    console.error(
      `[oauth:${provider}] callback failed:`,
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    return fail("oauth_failed");
  }

  if (!result.ok) return fail(result.error);

  if (intent === "link") return redirectTo(`/dashboard/settings?linked=${provider}`);

  await createSession(result.user);
  return redirectTo(next);
}
