import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { candidateProfileSchema } from "@/lib/validation";

// Scoped to the session user, like the letters routes: a foreign id is a 404.

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/profiles/[id]">) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = candidateProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const { count } = await db.candidateProfile.updateMany({
    where: { id, userId: user.id },
    data: parsed.data,
  });
  if (count === 0) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ profile: { id, ...parsed.data } });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/profiles/[id]">) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await db.candidateProfile.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
