import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyLimitFor } from "@/lib/plans";
import { GenerationWorkspace } from "@/components/dashboard/GenerationWorkspace";
import { aiProvider, aiProviderLabel } from "@/lib/ai";

export const metadata: Metadata = { title: "Dashboard — CoverCraft" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [generations, usedThisMonth] = await Promise.all([
    db.generation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.generation.count({
      where: { userId: user.id, createdAt: { gte: monthStart } },
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
      initialGenerations={generations.map((g) => ({
        id: g.id,
        jobTitle: g.jobTitle,
        company: g.company,
        tone: g.tone,
        content: g.content,
        createdAt: g.createdAt.toISOString(),
      }))}
    />
  );
}
