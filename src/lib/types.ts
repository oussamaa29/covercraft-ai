import type { Tone } from "@prisma/client";

export interface GenerationDTO {
  id: string;
  jobTitle: string;
  company: string;
  tone: Tone;
  content: string;
  createdAt: string;
  updatedAt: string;
  /** False for letters written before their inputs were stored. */
  canRegenerate: boolean;
}

export interface CandidateProfileDTO {
  id: string;
  label: string;
  fullName: string;
  background: string;
}

export const TONE_OPTIONS: { value: Tone; label: string; hint: string }[] = [
  { value: "PROFESSIONAL", label: "Professional", hint: "Polished and safe for any company" },
  { value: "FRIENDLY", label: "Friendly", hint: "Warm, for startups and smaller teams" },
  { value: "CONFIDENT", label: "Confident", hint: "Leads with impact and results" },
  { value: "CONCISE", label: "Concise", hint: "Short and direct, no filler" },
];

export function toneLabel(tone: Tone): string {
  return TONE_OPTIONS.find((t) => t.value === tone)?.label ?? tone;
}
