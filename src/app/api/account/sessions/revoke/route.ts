import { NextResponse } from "next/server";
import { getCurrentUser, rotateSessions } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";

// "Sign out of all other devices": bumping sessionVersion makes every
// existing cookie fail getCurrentUser(); this browser gets a fresh one.
export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await rotateSessions(user.id);

  return NextResponse.json({ ok: true });
}
