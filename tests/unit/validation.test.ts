import { describe, expect, it } from "vitest";
import {
  deleteAccountSchema,
  generateSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
  safeNextPath,
} from "@/lib/validation";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/billing?checkout=PRO", "/dashboard/billing?checkout=PRO"],
    ["/dashboard/settings#danger", "/dashboard/settings#danger"],
    ["/", "/"],
  ])("keeps same-origin path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "//evil.com/dashboard",
    "/\\evil.com",
    "/\\/evil.com",
    "https://evil.com",
    "http://evil.com/dashboard",
    "javascript:alert(1)",
    "evil.com",
    "dashboard",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\n/evil.com",
    " //evil.com",
    "\\\\evil.com",
    // Dot segments normalize to "//evil.com" once a URL parser sees them.
    "/.//evil.com",
    "/..//evil.com",
    "/a/..//evil.com",
    "",
  ])("rejects %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/dashboard");
  });

  it("rejects values decoded from encoded tricks (what searchParams hands the app)", () => {
    for (const encoded of ["%2F%2Fevil.com", "%2F%5Cevil.com", "https%3A%2F%2Fevil.com", "%2F%09%2Fevil.com"]) {
      expect(safeNextPath(decodeURIComponent(encoded))).toBe("/dashboard");
    }
  });

  it("leaves still-encoded slashes alone (they are a path, not a host)", () => {
    // "/%2F%2Fevil.com" is a same-origin path; browsers won't treat it as a host.
    const out = safeNextPath("/%2F%2Fevil.com");
    expect(new URL(out, "http://x.test").origin).toBe("http://x.test");
  });

  it("rejects non-strings and absurdly long values", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(["/a", "/b"])).toBe("/dashboard");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath("//evil.com", "/login")).toBe("/login");
  });
});

describe("zod schemas", () => {
  it("register: trims + lowercases email, enforces name and password length", () => {
    const ok = registerSchema.safeParse({ name: "  Ada  ", email: "  ADA@Example.COM ", password: "12345678" });
    expect(ok.success && ok.data).toEqual({ name: "Ada", email: "ada@example.com", password: "12345678" });
    expect(registerSchema.safeParse({ name: "A", email: "a@b.co", password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ada", email: "not-an-email", password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ada", email: "a@b.co", password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "x".repeat(81), email: "a@b.co", password: "12345678" }).success).toBe(false);
  });

  it("login: requires a password and a valid email", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: " A@B.CO ", password: "x" }).success).toBe(true);
  });

  it("generate: needs a 20+ char job description and a known tone", () => {
    const base = {
      candidateName: "Ada",
      jobTitle: "Engineer",
      company: "Acme",
      jobDescription: "x".repeat(20),
      tone: "PROFESSIONAL",
    };
    const ok = generateSchema.safeParse(base);
    expect(ok.success && ok.data.background).toBe("");
    expect(generateSchema.safeParse({ ...base, jobDescription: "too short" }).success).toBe(false);
    expect(generateSchema.safeParse({ ...base, tone: "SARCASTIC" }).success).toBe(false);
    expect(generateSchema.safeParse({ ...base, jobTitle: "x" }).success).toBe(false);
    expect(generateSchema.safeParse({ ...base, jobDescription: "x".repeat(6001) }).success).toBe(false);
  });

  it("profile / password / delete schemas", () => {
    expect(profileSchema.safeParse({ name: " a " }).success).toBe(false);
    expect(profileSchema.safeParse({ name: "Al" }).success).toBe(true);
    expect(passwordSchema.safeParse({ newPassword: "1234567" }).success).toBe(false);
    expect(passwordSchema.safeParse({ newPassword: "x".repeat(73) }).success).toBe(false);
    expect(passwordSchema.safeParse({ newPassword: "12345678" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmEmail: "" }).success).toBe(false);
    const del = deleteAccountSchema.safeParse({ confirmEmail: " ME@X.IO " });
    expect(del.success && del.data.confirmEmail).toBe("me@x.io");
  });
});
