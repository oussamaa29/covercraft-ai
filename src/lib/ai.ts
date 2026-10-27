import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Tone } from "@prisma/client";

const TONE_LABEL: Record<Tone, string> = {
  PROFESSIONAL: "professional and polished",
  FRIENDLY: "warm and approachable, while staying credible",
  CONFIDENT: "confident and direct, leading with impact",
  CONCISE: "concise, no filler, straight to the point",
};

export interface GenerateCoverLetterInput {
  candidateName: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  background: string;
  tone: Tone;
}

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function generateCoverLetter(
  input: GenerateCoverLetterInput
): Promise<string> {
  if (!client) {
    return mockCoverLetter(input);
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 700,
    system:
      "You write tailored, specific cover letters. No generic filler, no clichés like 'I am writing to express my interest'. Reference concrete details from the job description and the candidate's background. Output plain text only, no markdown, ready to paste into an email.",
    messages: [
      {
        role: "user",
        content: [
          `Candidate name: ${input.candidateName}`,
          `Target role: ${input.jobTitle} at ${input.company}`,
          `Tone: ${TONE_LABEL[input.tone]}`,
          `Job description:\n${input.jobDescription}`,
          `Candidate background:\n${input.background}`,
          "Write a cover letter (250-350 words) tailored to this role.",
        ].join("\n\n"),
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : mockCoverLetter(input);
}

function mockCoverLetter({
  candidateName,
  jobTitle,
  company,
  background,
  tone,
}: GenerateCoverLetterInput): string {
  const opener: Record<Tone, string> = {
    PROFESSIONAL: `I'm applying for the ${jobTitle} role at ${company}.`,
    FRIENDLY: `I came across the ${jobTitle} opening at ${company} and had to reach out.`,
    CONFIDENT: `${company} needs a ${jobTitle} who can hit the ground running — that's me.`,
    CONCISE: `${jobTitle} at ${company}. Here's why I'm a fit.`,
  };

  return [
    opener[tone],
    "",
    background.trim()
      ? `Relevant background: ${background.trim()}`
      : "My background lines up closely with what this role needs, particularly in the areas the listing calls out.",
    "",
    `I'd welcome the chance to talk through how I can contribute at ${company}.`,
    "",
    candidateName || "Your name",
    "",
    "[Demo output — set ANTHROPIC_API_KEY to generate real, tailored letters.]",
  ].join("\n");
}
