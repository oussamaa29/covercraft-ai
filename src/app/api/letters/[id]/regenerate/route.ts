import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { canRegenerate, toLetterDTO, writeLetter } from "@/lib/letters";
import { quotaExceeded } from "@/lib/quota";
import { regenerateSchema } from "@/lib/validation";

/**
 * Rewrites a letter from its stored inputs in another tone. The result is a
 * new letter (the original stays in history), and it costs one generation,
 * same as writing from scratch.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/letters/[id]/regenerate">
) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = regenerateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a tone" }, { status: 400 });

  const { id } = await ctx.params;
  const source = await db.generation.findFirst({ where: { id, userId: user.id } });
  if (!source) return NextResponse.json({ error: "Letter not found" }, { status: 404 });
  if (!canRegenerate(source)) {
    return NextResponse.json(
      { error: "This letter was written before inputs were saved, so it can't be regenerated." },
      { status: 409 }
    );
  }

  const overQuota = await quotaExceeded(user);
  if (overQuota) return overQuota;

  const input = {
    candidateName: source.candidateName || user.name,
    jobTitle: source.jobTitle,
    company: source.company,
    jobDescription: source.jobDescription ?? "",
    background: source.background ?? "",
    tone: parsed.data.tone,
  };
  const result = await writeLetter(input);
  if (!result.ok) return result.response;

  const letter = await db.generation.create({
    data: { ...input, userId: user.id, content: result.content },
  });
  return NextResponse.json({ letter: toLetterDTO(letter) });
}
