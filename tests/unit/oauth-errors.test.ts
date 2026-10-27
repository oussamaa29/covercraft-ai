import { describe, expect, it } from "vitest";
import { oauthErrorMessage } from "@/lib/oauth-errors";

describe("oauthErrorMessage", () => {
  it.each([
    "provider_disabled",
    "oauth_denied",
    "invalid_state",
    "oauth_failed",
    "login_required",
    "email_missing",
    "email_unverified",
    "account_in_use",
    "provider_already_linked",
    // Added by the review fixes: verified email that belongs to a password user.
    "email_in_use",
  ])("maps %s to its own human message", (code) => {
    const msg = oauthErrorMessage(code);
    expect(msg).toBeTruthy();
    expect(msg).not.toBe(oauthErrorMessage("totally_unknown"));
    expect(msg).not.toContain(code);
  });

  it("unknown codes get a generic message", () => {
    expect(oauthErrorMessage("totally_unknown")).toMatch(/something went wrong/i);
  });

  it("prototype keys don't resolve to Object.prototype members", () => {
    for (const code of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(oauthErrorMessage(code)).toMatch(/something went wrong/i);
    }
  });

  it("no error → null (no banner)", () => {
    expect(oauthErrorMessage(undefined)).toBeNull();
    expect(oauthErrorMessage("")).toBeNull();
    expect(oauthErrorMessage(["invalid_state"])).toBeNull();
  });
});
