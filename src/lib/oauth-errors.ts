// Error codes the OAuth routes put in `?error=`. Only these codes ever reach
// the URL — provider error text and tokens never do.
const MESSAGES = {
  provider_disabled: "That sign-in option isn't configured on this deployment.",
  oauth_denied: "Sign-in was cancelled.",
  invalid_state: "Your sign-in attempt expired or couldn't be verified. Please try again.",
  oauth_failed: "We couldn't complete sign-in with that provider. Please try again.",
  login_required: "Log in first, then connect the account from Settings.",
  email_missing:
    "That account didn't share an email address with us, so we can't create a CoverCraft account from it.",
  email_unverified:
    "The provider hasn't verified that email address. Verify it there first, or log in with your password and connect the account from Settings.",
  account_in_use: "That account is already connected to a different CoverCraft user.",
  provider_already_linked:
    "Your CoverCraft account is already connected to a different account from that provider.",
} as const;

export type OAuthErrorCode = keyof typeof MESSAGES;

export function oauthErrorMessage(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;
  // hasOwn, not `in`: "?error=constructor" must not resolve to a prototype key.
  return Object.hasOwn(MESSAGES, code)
    ? MESSAGES[code as OAuthErrorCode]
    : "Something went wrong signing you in. Please try again.";
}
