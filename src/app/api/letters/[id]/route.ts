import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { toLetterDTO } from "@/lib/letters";
import { letterEditSchema } from "@/lib/validation";

// Every lookup is scoped to the session user: someone else's letter id gets
// the same 404 as a letter that doesn't exist.

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/letters/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const letter = await db.generation.findFirst({ where: { id, userId: user.id } });
  if (!letter) return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  return NextResponse.json({ letter: toLetterDTO(letter) });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/letters/[id]">) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = letterEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const { count } = await db.generation.updateMany({
    where: { id, userId: user.id },
    data: { content: parsed.data.content },
  });
  if (count === 0) return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  const letter = await db.generation.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ letter: toLetterDTO(letter) });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/letters/[id]">) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { count } = await db.generation.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
