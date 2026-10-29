import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSite } from "@/lib/csrf";
import { profileLimitFor } from "@/lib/plans";
import { candidateProfileSchema } from "@/lib/validation";

const select = { id: true, label: true, fullName: true, background: true } as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = await db.candidateProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select,
  });
  return NextResponse.json({ profiles, limit: profileLimitFor(user.plan) });
}

export async function POST(request: Request) {
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

  const limit = profileLimitFor(user.plan);
  // Count and create in one serializable transaction so two tabs can't both
  // squeeze in the last free slot.
  let profile;
  try {
    profile = await db.$transaction(
      async (tx) => {
        if ((await tx.candidateProfile.count({ where: { userId: user.id } })) >= limit) return null;
        return tx.candidateProfile.create({ data: { ...parsed.data, userId: user.id }, select });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    // P2034: Postgres aborted the losing side of a concurrent create.
    if ((err as { code?: string }).code !== "P2034") throw err;
    return NextResponse.json({ error: "Please try again." }, { status: 409 });
  }
  if (!profile) {
    return NextResponse.json(
      {
        error:
          limit === 1
            ? "The Free plan keeps 1 saved profile. Edit it, or upgrade to Pro for up to 5."
            : `You can keep up to ${limit} saved profiles.`,
        code: "PROFILE_LIMIT",
      },
      { status: 402 }
    );
  }
  return NextResponse.json({ profile });
}
