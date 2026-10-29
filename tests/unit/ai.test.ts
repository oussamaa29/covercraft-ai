import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./helpers/cookie-jar")).nextHeadersMock);

import {
  AiUnavailableError,
  aiProvider,
  aiProviderLabel,
  cleanLetter,
  generateCoverLetter,
  type GenerateCoverLetterInput,
} from "@/lib/ai";
import { POST as generate } from "@/app/api/generate/route";
import { SESSION_COOKIE, signSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncateAll } from "../test-db";
import { resetJar } from "./helpers/cookie-jar";

const INPUT: GenerateCoverLetterInput = {
  candidateName: "Ada Lovelace",
  jobTitle: "Frontend Engineer",
  company: "Northwind Labs",
  jobDescription: "We need React, TypeScript and accessibility experience to build our product.",
  background: "4 years of React at Nimbus.",
  tone: "CONFIDENT",
};

const AI_ENV = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GEMINI_MODEL", "OLLAMA_MODEL", "OLLAMA_URL"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  for (const key of AI_ENV) vi.stubEnv(key, "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("aiProvider()", () => {
  it("falls back to demo mode with nothing configured", () => {
    expect(aiProvider()).toBe("demo");
    expect(aiProviderLabel()).toBe("Demo mode");
  });

  it("picks Ollama when OLLAMA_MODEL is set", () => {
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    expect(aiProvider()).toBe("ollama");
    expect(aiProviderLabel()).toBe("Ollama · llama3.2:3b");
  });

  it("prefers Gemini over Ollama, and Anthropic over both", () => {
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubEnv("GEMINI_API_KEY", "g-key");
    expect(aiProvider()).toBe("gemini");
    expect(aiProviderLabel()).toBe("Gemini · gemini-flash-latest");
    vi.stubEnv("ANTHROPIC_API_KEY", "a-key");
    expect(aiProvider()).toBe("anthropic");
  });
});

describe("generateCoverLetter()", () => {
  it("demo mode returns a labeled sample without any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const letter = await generateCoverLetter(INPUT);
    expect(letter).toContain("Northwind Labs");
    expect(letter).toContain("[Demo output");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Ollama: posts a non-streaming chat to the local server and returns the cleaned letter", async () => {
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubEnv("OLLAMA_URL", "http://127.0.0.1:11434/");
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ message: { content: "Here is your cover letter:\n\nDear Northwind team,\n\n**React** is my thing.\n\nAda" } })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const letter = await generateCoverLetter(INPUT);

    expect(letter).toBe("Dear Northwind team,\n\nReact is my thing.\n\nAda");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "llama3.2:3b", stream: false });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain("Frontend Engineer at Northwind Labs");
    expect(body.messages[1].content).toContain("confident and direct");
  });

  it("Ollama not running → AiUnavailableError (not a raw fetch error)", async () => {
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(generateCoverLetter(INPUT)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("Gemini: calls generateContent with the key in a header, never in the URL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-gemini-key");
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: "Dear team," }, { text: " hello." }] } }] })
    );
    vi.stubGlobal("fetch", fetchSpy);

    expect(await generateCoverLetter(INPUT)).toBe("Dear team, hello.");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
    );
    expect(url).not.toContain("secret-gemini-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-gemini-key");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toMatch(/cover letters/);
    expect(body.contents[0].parts[0].text).toContain("Ada Lovelace");
  });

  it("Gemini quota exhausted (429) → AiUnavailableError", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: 429 } }, 429)));
    await expect(generateCoverLetter(INPUT)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("an empty answer is treated as a failure, not saved as a blank letter", async () => {
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: { content: "   " } })));
    await expect(generateCoverLetter(INPUT)).rejects.toBeInstanceOf(AiUnavailableError);
  });
});

describe("cleanLetter()", () => {
  it("strips code fences, a chatty preamble and bold markers", () => {
    expect(cleanLetter("```\nHere's the letter:\n\nDear **team**,\nAda\n```")).toBe("Dear team,\nAda");
  });
  it("leaves a normal letter alone", () => {
    expect(cleanLetter("Dear team,\n\nHere is why I fit: React.\n\nAda")).toBe(
      "Dear team,\n\nHere is why I fit: React.\n\nAda"
    );
  });
});

describe("POST /api/generate when the AI provider is down", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns 503 AI_UNAVAILABLE and does not use up the monthly quota", async () => {
    await truncateAll(db);
    const user = await db.user.create({ data: { email: "ai@example.com", name: "Ai", password: null } });
    resetJar({ [SESSION_COOKIE]: await signSessionToken({ userId: user.id, sessionVersion: 0 }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("OLLAMA_MODEL", "llama3.2:3b");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));

    const res = await generate(
      new Request("http://localhost:3000/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(INPUT),
      })
    );

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("AI_UNAVAILABLE");
    expect(await db.generation.count({ where: { userId: user.id } })).toBe(0);
  });
});
