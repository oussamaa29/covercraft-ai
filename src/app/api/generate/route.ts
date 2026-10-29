import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { generateSchema } from "@/lib/validation";
import { toLetterDTO, writeLetter } from "@/lib/letters";
import { monthlyLimitFor } from "@/lib/plans";
import { generationsThisMonth, quotaExceeded } from "@/lib/quota";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [generations, usedThisMonth] = await Promise.all([
    db.generation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    generationsThisMonth(user.id),
  ]);

  return NextResponse.json({
    generations,
    usedThisMonth,
    limit: monthlyLimitFor(user.plan),
    plan: user.plan,
  });
}

export async function POST(request: Request) {
  const refused = rejectCrossSite(request);
  if (refused) return refused;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const overQuota = await quotaExceeded(user);
  if (overQuota) return overQuota;

  const body = await request.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await writeLetter(parsed.data);
  if (!result.ok) return result.response;

  const input = parsed.data;
  const generation = await db.generation.create({
    data: {
      userId: user.id,
      jobTitle: input.jobTitle,
      company: input.company,
      tone: input.tone,
      content: result.content,
      // Kept so the letter can be regenerated in another tone later.
      candidateName: input.candidateName,
      jobDescription: input.jobDescription,
      background: input.background,
    },
  });

  return NextResponse.json({ generation: toLetterDTO(generation) });
}
