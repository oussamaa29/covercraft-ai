import "server-only";
import {
  GitHub,
  Google,
  decodeIdToken,
  generateCodeVerifier,
  generateState,
} from "arctic";
import { Prisma, type OAuthProvider, type User } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { configuredAppUrl } from "@/lib/site";
import type { OAuthErrorCode } from "@/lib/oauth-errors";

export const PROVIDER_SLUGS = ["google", "github"] as const;
export type ProviderSlug = (typeof PROVIDER_SLUGS)[number];

export const PROVIDERS: Record<
  ProviderSlug,
  { id: OAuthProvider; label: string; env: string; scopes: string[] }
> = {
  google: { id: "GOOGLE", label: "Google", env: "GOOGLE", scopes: ["openid", "profile", "email"] },
  github: { id: "GITHUB", label: "GitHub", env: "GITHUB", scopes: ["read:user", "user:email"] },
};

export function providerSlug(id: OAuthProvider): ProviderSlug {
  return id === "GOOGLE" ? "google" : "github";
}

export function isProviderSlug(value: string): value is ProviderSlug {
  return (PROVIDER_SLUGS as readonly string[]).includes(value);
}

function credentials(slug: ProviderSlug) {
  const { env } = PROVIDERS[slug];
  const clientId = process.env[`${env}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${env}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

// A provider is offered only when both halves of its credentials are set —
// otherwise the app runs in demo mode with the buttons disabled.
export function isProviderEnabled(slug: ProviderSlug): boolean {
  return credentials(slug) !== null;
}

export function enabledProviders(): Record<ProviderSlug, boolean> {
  return { google: isProviderEnabled("google"), github: isProviderEnabled("github") };
}

// --- The redirect dance ---------------------------------------------------

export const OAUTH_COOKIE_PATH = "/api/auth/oauth";
export const OAUTH_COOKIE_MAX_AGE = 60 * 10;
export const OAUTH_COOKIES = {
  state: "cc_oauth_state",
  verifier: "cc_oauth_verifier",
  next: "cc_oauth_next",
  intent: "cc_oauth_intent",
} as const;

export type OAuthIntent = "login" | "link";

export function redirectUri(slug: ProviderSlug, requestOrigin: string): string {
  return `${configuredAppUrl() ?? requestOrigin}/api/auth/oauth/${slug}/callback`;
}

function googleClient(requestOrigin: string) {
  const creds = credentials("google");
  if (!creds) throw new Error("Google OAuth is not configured");
  return new Google(creds.clientId, creds.clientSecret, redirectUri("google", requestOrigin));
}

function githubClient(requestOrigin: string) {
  const creds = credentials("github");
  if (!creds) throw new Error("GitHub OAuth is not configured");
  return new GitHub(creds.clientId, creds.clientSecret, redirectUri("github", requestOrigin));
}

export function createAuthorizationUrl(slug: ProviderSlug, requestOrigin: string) {
  const state = generateState();
  if (slug === "google") {
    // GitHub's OAuth apps don't support PKCE; Google's do, so use it there.
    const codeVerifier = generateCodeVerifier();
    const url = googleClient(requestOrigin).createAuthorizationURL(
      state,
      codeVerifier,
      PROVIDERS.google.scopes
    );
    return { url, state, codeVerifier };
  }
  const url = githubClient(requestOrigin).createAuthorizationURL(state, PROVIDERS.github.scopes);
  return { url, state, codeVerifier: null };
}

// --- Profiles ---------------------------------------------------------------

/** What every provider is normalized into before touching the database. */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
}

const googleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  email_verified: z.unknown().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
});

const githubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  avatar_url: z.string().nullish(),
});

const githubEmailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() })
);

function httpsUrl(value: string | null | undefined): string | null {
  return value && value.startsWith("https://") ? value : null;
}

export async function fetchOAuthProfile(
  slug: ProviderSlug,
  code: string,
  codeVerifier: string | null,
  requestOrigin: string
): Promise<OAuthProfile> {
  if (slug === "google") {
    if (!codeVerifier) throw new Error("Missing PKCE code verifier");
    const tokens = await googleClient(requestOrigin).validateAuthorizationCode(code, codeVerifier);
    // The ID token came straight from Google's token endpoint over TLS, so
    // decoding without verifying its signature is fine here (OIDC §3.1.3.7).
    const claims = googleClaimsSchema.parse(decodeIdToken(tokens.idToken()));
    return {
      provider: "GOOGLE",
      providerAccountId: claims.sub,
      email: claims.email?.trim().toLowerCase() || null,
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: claims.name?.trim() || null,
      image: httpsUrl(claims.picture),
    };
  }

  const tokens = await githubClient(requestOrigin).validateAuthorizationCode(code);
  const headers = {
    Authorization: `Bearer ${tokens.accessToken()}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "CoverCraft",
  };
  const init = { headers, cache: "no-store" as const, signal: AbortSignal.timeout(10_000) };

  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", init),
    fetch("https://api.github.com/user/emails", init),
  ]);
  if (!userRes.ok) throw new Error(`GitHub /user responded ${userRes.status}`);
  const ghUser = githubUserSchema.parse(await userRes.json());

  // /user only exposes the *public* email, with no verification flag. The
  // primary address from /user/emails is the one GitHub vouches for.
  let email = ghUser.email ?? null;
  let emailVerified = false;
  if (emailsRes.ok) {
    const primary = githubEmailsSchema.parse(await emailsRes.json()).find((e) => e.primary);
    if (primary) {
      email = primary.email;
      emailVerified = primary.verified;
    }
  }

  return {
    provider: "GITHUB",
    providerAccountId: String(ghUser.id),
    email: email?.trim().toLowerCase() || null,
    emailVerified,
    name: ghUser.name?.trim() || ghUser.login,
    image: httpsUrl(ghUser.avatar_url),
  };
}

// --- Account resolution -----------------------------------------------------

export type ResolveResult =
  | { ok: true; user: User; outcome: "signed_in" | "linked" | "auto_linked" | "created" }
  | { ok: false; error: OAuthErrorCode };

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Maps a provider identity to a CoverCraft user, in this order:
 *  1. identity already linked → its user (or `account_in_use` when linking
 *     it to someone else);
 *  2. `linkToUserId` given → attach it to that (signed-in) user;
 *  3. a user with the same email exists → auto-link, but only when the
 *     provider says the email is verified;
 *  4. otherwise create a new password-less user.
 * Pure apart from the database, so it can be exercised without a provider.
 */
export async function resolveOAuthUser(
  profile: OAuthProfile,
  options: { linkToUserId?: string } = {}
): Promise<ResolveResult> {
  try {
    return await resolveOnce(profile, options.linkToUserId);
  } catch (err) {
    // Two callbacks for the same identity racing: the loser trips a unique
    // constraint. Resolving again finds the winner's rows and takes path 1 or 3.
    if (isUniqueViolation(err)) return resolveOnce(profile, options.linkToUserId);
    throw err;
  }
}

async function resolveOnce(profile: OAuthProfile, linkToUserId?: string): Promise<ResolveResult> {
  const { provider, providerAccountId } = profile;
  const email = profile.email?.trim().toLowerCase() || null;
  const account = { provider, providerAccountId, email };

  const existing = await db.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
  if (existing) {
    if (linkToUserId && existing.userId !== linkToUserId) {
      return { ok: false, error: "account_in_use" };
    }
    return { ok: true, user: existing.user, outcome: linkToUserId ? "linked" : "signed_in" };
  }

  if (linkToUserId) {
    const target = await db.user.findUnique({ where: { id: linkToUserId } });
    if (!target) return { ok: false, error: "login_required" };
    return linkAccount(target, account, profile.image, "linked");
  }

  if (!email) return { ok: false, error: "email_missing" };
  // Without the provider vouching for the address, anyone could add
  // victim@example.com to their own GitHub account and sign in as the victim.
  if (!profile.emailVerified) return { ok: false, error: "email_unverified" };

  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) {
    // Password signups never prove they own their email, so an attacker could
    // pre-register victim@example.com and wait for the victim's Google login
    // to merge into it. Only password-less users, who were created here from
    // a provider-verified email, are safe to auto-link.
    if (byEmail.password) return { ok: false, error: "email_in_use" };
    return linkAccount(byEmail, account, profile.image, "auto_linked");
  }

  const name = (profile.name?.trim() || email.split("@")[0]).slice(0, 80);
  const user = await db.user.create({
    data: { email, name, password: null, image: profile.image, accounts: { create: account } },
  });
  return { ok: true, user, outcome: "created" };
}

async function linkAccount(
  user: User,
  account: { provider: OAuthProvider; providerAccountId: string; email: string | null },
  image: string | null,
  outcome: "linked" | "auto_linked"
): Promise<ResolveResult> {
  const clash = await db.account.findUnique({
    where: { userId_provider: { userId: user.id, provider: account.provider } },
  });
  if (clash) return { ok: false, error: "provider_already_linked" };

  const updated = await db.$transaction(async (tx) => {
    await tx.account.create({ data: { ...account, userId: user.id } });
    // Adopt the provider's avatar only if the user doesn't have one yet.
    if (!user.image && image) {
      return tx.user.update({ where: { id: user.id }, data: { image } });
    }
    return user;
  });
  return { ok: true, user: updated, outcome };
}
