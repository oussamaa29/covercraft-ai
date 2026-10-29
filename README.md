# CoverCraft

A small SaaS: users sign up, generate AI-tailored cover letters, and hit a
usage limit on the Free plan that upgrades them to a real Stripe
subscription (Pro / Business). The product itself is intentionally simple —
the point of this project is everything *around* the product: auth
(email + Google/GitHub), account management, plan-gating, and a Stripe
integration that survives retries and duplicate webhooks.

## Stack

- **Next.js 16** (App Router, Turbopack, Route Handlers)
- **Prisma 6** + Postgres (Neon in production, embedded Postgres locally)
- **Auth**: custom email/password (bcrypt + signed JWT session cookie via `jose`) plus Google and GitHub sign-in through [arctic](https://arcticjs.dev), a thin OAuth 2.0 client — no Auth.js, so the whole flow is visible in `src/lib/auth.ts`, `src/lib/oauth.ts` and `src/app/api/auth/`
- **Stripe**: Checkout, Customer Portal, and a webhook handler that reconciles subscription state
- **AI**: pluggable writer — Ollama (free, local), Gemini (free tier) or Anthropic, picked from env, with a labeled demo fallback when none is set (`src/lib/ai.ts`)
- **Tailwind v4** (CSS-based theme, no `tailwind.config.js`)

## Running it locally

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET
npm run db                  # terminal 1: local Postgres on :5433, leave it running
npx prisma migrate dev      # terminal 2
npm run dev
```

No Docker and no database account needed: `npm run db` runs a real
Postgres 17 (same major version as Neon) from the `embedded-postgres` npm
binaries, with data in `./.pgdata`. The localhost URLs in `.env.example`
already point at it. Prefer Neon? Put a dev branch's pooled and direct
connection strings in `DATABASE_URL` / `DIRECT_URL` instead.

That's enough to sign up, generate letters (as demo output), and use the
app end to end. Generate `AUTH_SECRET` with `openssl rand -base64 32`.
`GET /api/health` reports whether the database is reachable.

## Deploying (Vercel)

`npm run build` runs `prisma migrate deploy` before `next build`, so each
deploy applies pending migrations. Set `DATABASE_URL`, `DIRECT_URL`,
`AUTH_SECRET` and `APP_URL` (e.g. `https://covercraft.example.com`) in the
Vercel project, then `vercel --prod`.

### Enabling Google / GitHub sign-in

Both are optional. Until a provider's client ID **and** secret are set, its
button shows as disabled ("Not configured in this demo") and everything
else keeps working.

**Google**

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials),
   configure the OAuth consent screen (External, scopes `openid`, `email`,
   `profile`). It asks for a privacy policy and terms URL — use
   `${APP_URL}/privacy` and `${APP_URL}/terms`, which the app serves.
2. Create credentials → OAuth client ID → *Web application*, with these
   authorized redirect URIs:
   - `http://localhost:3000/api/auth/oauth/google/callback`
   - `https://<your-domain>/api/auth/oauth/google/callback`
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**GitHub**

1. [Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
   → New OAuth App. GitHub allows one callback URL per app, so create one
   app for local dev and one for production:
   - `http://localhost:3000/api/auth/oauth/github/callback`
   - `https://<your-domain>/api/auth/oauth/github/callback`
2. Generate a client secret and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

The redirect URI is built from `APP_URL` (falling back to the request
origin), so it has to match the host you browse on exactly — `localhost`
and `127.0.0.1` are different hosts, and the short-lived state cookies
won't survive the switch.

### Enabling real AI generation (free)

Without any AI config, `/api/generate` returns a clearly-labeled demo
letter, so the whole app is demoable with no key. To write real letters:

- **Ollama (free, local — recommended):** install [Ollama](https://ollama.com),
  run `ollama pull llama3.2:3b` (~2 GB), then set `OLLAMA_MODEL="llama3.2:3b"`.
  Any Ollama model works; bigger ones write better letters but run slower
  on a CPU.
- **Gemini (free tier):** create a key in Google AI Studio and set
  `GEMINI_API_KEY`. Works on a deployed site too, but the free daily quota
  is small.
- **Anthropic (paid):** set `ANTHROPIC_API_KEY`; it takes priority if set.

The dashboard badge shows which writer is active. If the configured
provider is down or out of quota, the request fails with a 503 and nothing
is saved, so a failed attempt never counts against the Free plan's limit.

### Enabling real billing

1. Create two recurring Prices in the Stripe Dashboard (test mode) for Pro
   and Business, and put their IDs in `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS`.
2. Set `STRIPE_SECRET_KEY` from the dashboard.
3. Forward webhooks to your local server and copy the signing secret it prints:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Use Stripe's test card `4242 4242 4242 4242`, any future expiry/CVC.

Without Stripe configured, the checkout/portal routes fail with a clear
503 instead of crashing — you can still demo the whole non-billing product.

## The part worth reading in an interview

`src/app/api/stripe/webhook/route.ts` is the one file I'd point to. Two
things about it are deliberate:

- **Idempotency by construction.** Every handler is a `set`, never an
  `increment` — replaying `checkout.session.completed` or
  `customer.subscription.updated` twice (which Stripe's retry policy
  guarantees will eventually happen) leaves the user row in the same state
  either way. No dedup table needed.
- **Signature verification before anything else.** `stripe.webhooks.constructEvent`
  runs on the raw request body before any parsing, so a forged request
  without a valid `stripe-signature` never reaches the database.

Plan-gating (`src/app/api/generate/route.ts`) is checked server-side by
counting `Generation` rows created since the start of the month — not a
cached counter — so it can't drift from reality, and it's re-checked on
every request rather than trusted from the client.

On the auth side, two more choices are deliberate:

- **Accounts link by email only when the provider vouches for it.**
  `resolveOAuthUser` in `src/lib/oauth.ts` attaches a Google/GitHub login
  to an existing account with the same email only if the provider marks
  that email verified (for GitHub, the *primary verified* address).
  Otherwise anyone could add `victim@example.com` to their own GitHub
  account and walk into the victim's CoverCraft account.
- **Stateless sessions that can still be revoked.** The session JWT carries
  the user's `sessionVersion`, and `getCurrentUser()` rejects any token
  whose version doesn't match the database. Changing your password or
  hitting "Sign out of all other devices" bumps it, which kills every
  existing cookie at once — then the acting browser gets a fresh one, so
  you stay logged in.

Login, signup and password changes are rate-limited with a fixed-window
counter in Postgres (`src/lib/rate-limit.ts`) rather than in memory, so
the limits hold across serverless instances.

## What's simplified on purpose

- **No email sending.** That means no forgot-password flow and no email
  verification for password signups — both need a mail provider, which
  this project avoids so it runs with zero paid services. (It's also why
  OAuth account linking leans on the *provider's* verification.)
- **Business "team seats"** exist as a plan tier and a schema-level concept
  (higher limits), but there's no invite flow — multi-seat billing would
  roughly double the scope for a feature the free/Pro gating already
  demonstrates.
- **No test suite yet.** The natural next addition: Vitest around the
  plan-limit logic, `resolveOAuthUser` and the webhook handlers (all pure
  enough to unit test against a database without hitting Stripe, Google or
  GitHub), plus a Playwright smoke test for signup → generate → upgrade.

## Project structure

```
src/
  app/
    api/
      auth/            # login, register, logout, oauth/[provider](/callback)
      account/         # settings APIs: profile, password, oauth links, sessions, delete
      generate/ stripe/ health/
    dashboard/         # protected app: letters, billing, settings
    login/ register/   # auth pages
    privacy/ terms/    # legal pages (linked from the Google consent screen)
    robots.ts sitemap.ts
  components/          # ui/ (kit), auth/, dashboard/, settings/
  lib/                 # auth, oauth, rate-limit, db, stripe, ai, plans, validation
  proxy.ts             # route protection (Next 16's renamed middleware)
prisma/
  schema.prisma
scripts/
  db.mjs               # local embedded Postgres (npm run db)
```
