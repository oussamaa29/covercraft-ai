import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "cc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  userId: string;
  sessionVersion: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Add it to your .env file (see .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

const BCRYPT_COST = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Made once per instance, at the same cost as real hashes.
let dummyHash: Promise<string> | undefined;

/**
 * For login: always pays for one bcrypt compare, even when the email is
 * unknown or the user is OAuth-only (no password), so the response time
 * doesn't reveal which emails exist or how they signed up.
 */
export async function verifyLoginPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash("covercraft-timing-dummy", BCRYPT_COST);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

export async function signSessionToken({
  userId,
  sessionVersion,
}: SessionPayload): Promise<string> {
  return new SignJWT({ userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== "string") return null;
    // Tokens issued before sessionVersion existed carry no `sv`; they match
    // the column default (0) until the user's first revocation.
    const sessionVersion = typeof payload.sv === "number" ? payload.sv : 0;
    return { userId: payload.userId, sessionVersion };
  } catch {
    return null;
  }
}

export async function createSession(user: { id: string; sessionVersion: number }) {
  const token = await signSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Invalidates every session cookie issued so far for this user, then
 * re-issues one for the current request so the acting user stays signed in.
 */
export async function rotateSessions(userId: string) {
  const user = await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { id: true, sessionVersion: true },
  });
  await createSession(user);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await db.user.findUnique({ where: { id: session.userId } });
  // A signature-valid token from before a password change or "sign out
  // everywhere" is still rejected here.
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return user;
}

/**
 * For protected pages. No valid session → go through a handler that clears
 * any stale cookie (revoked, or its user is gone) before /login; the proxy
 * alone would bounce a signature-valid stale cookie straight back here.
 */
export async function requireUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/api/auth/session/expired?next=${encodeURIComponent(returnTo)}`);
  return user;
}
