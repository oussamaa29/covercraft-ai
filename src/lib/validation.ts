import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const generateSchema = z.object({
  candidateName: z.string().trim().min(1).max(80),
  jobTitle: z.string().trim().min(2).max(120),
  company: z.string().trim().min(1).max(120),
  jobDescription: z.string().trim().min(20, "Paste more of the job description").max(6000),
  background: z.string().trim().max(4000).default(""),
  tone: z.enum(["PROFESSIONAL", "FRIENDLY", "CONFIDENT", "CONCISE"]),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
});

export const passwordSchema = z.object({
  // Required by the route only when the user already has a password.
  currentPassword: z.string().max(200).optional(),
  // bcrypt ignores everything past 72 bytes, so a longer cap buys nothing.
  newPassword: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
});

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase().min(1, "Type your email to confirm"),
});

/**
 * Only same-origin paths are allowed as post-login destinations. "//evil.com"
 * and "/\evil.com" are protocol-relative to browsers, so they're rejected too.
 */
export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  // URL parsers drop tabs/newlines, so "/\t/evil.com" becomes "//evil.com".
  // Resolving against a dummy origin catches that and any similar trick.
  const base = "http://same-origin.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return fallback;
  }
  // Dot segments survive the checks above but resolve to a protocol-relative
  // path: "/.//evil.com" → "//evil.com". Return the normalized form, so what
  // was validated is exactly what the router navigates to.
  if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
  return url.pathname + url.search + url.hash;
}
