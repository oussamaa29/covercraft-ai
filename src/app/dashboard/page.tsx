import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyLimitFor, profileLimitFor } from "@/lib/plans";
import { generationsThisMonth } from "@/lib/quota";
import { GenerationWorkspace } from "@/components/dashboard/GenerationWorkspace";
import { aiProvider, aiProviderLabel } from "@/lib/ai";
import { toLetterDTO } from "@/lib/letters";

export const metadata: Metadata = { title: "Dashboard — CoverCraft" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const [generations, usedThisMonth, profiles] = await Promise.all([
    db.generation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    generationsThisMonth(user.id),
    db.candidateProfile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, fullName: true, background: true },
    }),
  ]);

  return (
    <GenerationWorkspace
      userName={user.name}
      plan={user.plan}
      limit={monthlyLimitFor(user.plan)}
      usedThisMonth={usedThisMonth}
      aiLabel={aiProviderLabel()}
      aiIsDemo={aiProvider() === "demo"}
      aiIsLocal={aiProvider() === "ollama"}
      initialGenerations={generations.map(toLetterDTO)}
      profiles={profiles}
      profileLimit={profileLimitFor(user.plan)}
    />
  );
}
