import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { generateSchema } from "@/lib/validation";
import { generateCoverLetter } from "@/lib/ai";
import { monthlyLimitFor } from "@/lib/plans";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const generations = await db.generation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const usedThisMonth = await db.generation.count({
    where: { userId: user.id, createdAt: { gte: startOfMonth() } },
  });

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

  const limit = monthlyLimitFor(user.plan);
  if (limit !== Infinity) {
    const usedThisMonth = await db.generation.count({
      where: { userId: user.id, createdAt: { gte: startOfMonth() } },
    });
    if (usedThisMonth >= limit) {
      return NextResponse.json(
        {
          error: `You've used all ${limit} free generations this month. Upgrade to Pro for unlimited letters.`,
          code: "LIMIT_REACHED",
        },
        { status: 402 }
      );
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const content = await generateCoverLetter(input);

  const generation = await db.generation.create({
    data: {
      userId: user.id,
      jobTitle: input.jobTitle,
      company: input.company,
      tone: input.tone,
      content,
    },
  });

  return NextResponse.json({ generation });
}
