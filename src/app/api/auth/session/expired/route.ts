import { NextResponse, type NextRequest } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";

// Where protected pages send a visitor whose cookie is signed but no longer
// valid (revoked via sessionVersion, or the user was deleted). The proxy only
// checks the signature, so without clearing the cookie here it would bounce
// /login → /dashboard → /login forever. A still-valid session is left alone,
// so this can't be abused as a cross-site logout link.
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (await getCurrentUser()) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  await destroySession();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
