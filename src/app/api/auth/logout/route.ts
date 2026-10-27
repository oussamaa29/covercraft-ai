import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";

export async function POST(request: Request) {
  // Otherwise any site could log visitors out with a hidden form.
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  await destroySession();
  return NextResponse.json({ ok: true });
}
