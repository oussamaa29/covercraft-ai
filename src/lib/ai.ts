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

export type AiProvider = "anthropic" | "gemini" | "ollama" | "demo";

/** A configured provider failed (down, quota, timeout). Nothing is saved. */
export class AiUnavailableError extends Error {}

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";
// An alias Google keeps pointed at the current Flash model, so the default
// doesn't go stale when a model generation is retired.
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

/**
 * Picked from env on every call (not at import) so tests and a changed .env
 * take effect without a rebuild. First configured one wins; with none, the
 * app stays fully usable on a labeled demo letter.
 */
export function aiProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OLLAMA_MODEL) return "ollama";
  return "demo";
}

/** Short human label for the dashboard, e.g. "Ollama · llama3.2:3b". */
export function aiProviderLabel(): string {
  switch (aiProvider()) {
    case "anthropic":
      return "Claude";
    case "gemini":
      return `Gemini · ${process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}`;
    case "ollama":
      return `Ollama · ${process.env.OLLAMA_MODEL}`;
    case "demo":
      return "Demo mode";
  }
}

const SYSTEM_PROMPT =
  "You write tailored, specific cover letters. No generic filler, no clichés like 'I am writing to express my interest'. Reference concrete details from the job description and the candidate's background. Output plain text only, no markdown, no title, no preamble such as 'Here is your letter' — just the letter, ready to paste into an email.";

function userPrompt(input: GenerateCoverLetterInput): string {
  return [
    `Candidate name: ${input.candidateName}`,
    `Target role: ${input.jobTitle} at ${input.company}`,
    `Tone: ${TONE_LABEL[input.tone]}`,
    `Job description:\n${input.jobDescription}`,
    `Candidate background:\n${input.background || "(not provided)"}`,
    "Write a cover letter (250-350 words) tailored to this role. Sign it with the candidate's name.",
  ].join("\n\n");
}

export async function generateCoverLetter(
  input: GenerateCoverLetterInput
): Promise<string> {
  const provider = aiProvider();
  if (provider === "demo") return mockCoverLetter(input);

  let text: string;
  try {
    text =
      provider === "anthropic"
        ? await viaAnthropic(input)
        : provider === "gemini"
          ? await viaGemini(input)
          : await viaOllama(input);
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError(`${provider} request failed`, { cause: err });
  }

  const letter = cleanLetter(text);
  if (!letter) throw new AiUnavailableError(`${provider} returned an empty letter`);
  return letter;
}

async function viaAnthropic(input: GenerateCoverLetterInput): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(input) }],
  });
  const block = message.content[0];
  return block?.type === "text" ? block.text : "";
}

async function viaGemini(input: GenerateCoverLetterInput): Promise<string> {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt(input) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );
  // 429 = free-tier quota used up; surfaced as "unavailable", not a crash.
  if (!res.ok) throw new AiUnavailableError(`Gemini responded ${res.status}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function viaOllama(input: GenerateCoverLetterInput): Promise<string> {
  const base = (process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(input) },
      ],
      options: { temperature: 0.7 },
      // Keep the model in memory between letters (Ollama's default is 5 min),
      // so only the first letter of a session pays the load time.
      keep_alive: "30m",
    }),
    // Local models on a CPU can take a while, especially the first (cold) run.
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new AiUnavailableError(`Ollama responded ${res.status}`);

  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

/** Small models sometimes wrap the letter in markdown or a chatty preamble. */
export function cleanLetter(text: string): string {
  return text
    .replace(/^```[a-z]*\n?|\n?```$/g, "")
    .replace(/^(here(?:'s| is)[^\n]*:)\s*\n+/i, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
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
    "[Demo output — connect a free local model with Ollama (see README) to generate real, tailored letters.]",
  ].join("\n");
}
