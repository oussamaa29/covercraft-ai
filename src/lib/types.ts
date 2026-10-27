import type { Tone } from "@prisma/client";

export interface GenerationDTO {
  id: string;
  jobTitle: string;
  company: string;
  tone: Tone;
  content: string;
  createdAt: string;
}
