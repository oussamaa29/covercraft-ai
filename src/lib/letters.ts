import "server-only";
import { NextResponse } from "next/server";
import type { Generation } from "@prisma/client";
import { AiUnavailableError, generateCoverLetter, type GenerateCoverLetterInput } from "@/lib/ai";
import type { GenerationDTO } from "@/lib/types";

/**
 * Runs the AI writer, turning a provider outage into a clean 503. Nothing is
 * saved on failure, so a failed attempt doesn't use up the monthly quota.
 */
export async function writeLetter(
  input: GenerateCoverLetterInput
): Promise<{ ok: true; content: string } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, content: await generateCoverLetter(input) };
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) throw err;
    console.error("[generate]", err.message, err.cause ?? "");
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "The AI writer is unavailable right now. Please try again in a moment.",
          code: "AI_UNAVAILABLE",
        },
        { status: 503 }
      ),
    };
  }
}

/** Letters written before inputs were stored can't be regenerated. */
export function canRegenerate(g: Pick<Generation, "jobDescription">): boolean {
  return Boolean(g.jobDescription);
}

export function toLetterDTO(g: Generation): GenerationDTO {
  return {
    id: g.id,
    jobTitle: g.jobTitle,
    company: g.company,
    tone: g.tone,
    content: g.content,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    canRegenerate: canRegenerate(g),
  };
}
