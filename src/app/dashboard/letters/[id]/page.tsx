import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toLetterDTO } from "@/lib/letters";
import { LetterView } from "@/components/letters/LetterView";

export const metadata: Metadata = { title: "Letter — CoverCraft" };

export default async function LetterPage(props: PageProps<"/dashboard/letters/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/letters/${encodeURIComponent(id)}`);

  // Scoped to the owner: another user's id is indistinguishable from a missing one.
  const letter = await db.generation.findFirst({ where: { id, userId: user.id } });
  if (!letter) notFound();

  return (
    <div className="space-y-6 py-10 print:py-0">
      <Link
        href="/dashboard/letters"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground print:hidden"
      >
        <ArrowLeft size={15} /> My letters
      </Link>
      <LetterView letter={toLetterDTO(letter)} watermark={user.plan === "FREE"} />
    </div>
  );
}
