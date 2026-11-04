# LumaBridge

A verified global giving platform. People in need register and are vetted by human auditors before anything goes public. Donors give without an account, anonymously or publicly, in 16 currencies.

```
apps/
  web/   Next.js 15 · React 19 · TypeScript · Tailwind · Framer Motion · React Query · React Hook Form · Zod
  api/   Express · PostgreSQL · Prisma · Redis · JWT · Cloudinary · payment gateway adapters
```

## Quick start

Requires Node 20+, PostgreSQL 16 and Redis 7 (or `npm run infra:up` with Docker).

```bash
npm install
cp apps/api/.env.example apps/api/.env      # then generate real secrets (see below)
cp apps/web/.env.example apps/web/.env.local
npm run infra:up                            # Postgres + Redis via Docker (skip if you run your own)
npm run db:generate
npm run db:migrate                          # applies prisma/migrations
npm run db:seed                             # 16 demo campaigns, 100+ donations, staff accounts
npm run dev                                 # API :4000, web :3000
```

Demo logins after seeding (development only):

| Role | Email | Password |
| --- | --- | --- |
| Auditor | auditor@lumabridge.dev | `Auditor#LumaBridge1` |
| Admin | admin@lumabridge.dev | `Admin#LumaBridge1` |
| Beneficiary | amina.1@demo.lumabridge.dev | `Beneficiary#1234` |

Staff accounts require TOTP. The seed prints a demo authenticator secret (`JBSWY3DPEHPK3PXP`); add it to any authenticator app.

Generate secrets with `openssl rand -hex 32` for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `DATA_ENCRYPTION_KEY`, and any long random string for `FINGERPRINT_PEPPER`. **Never reuse the example values.**

## What is built

**Public**: animated globe hero, live counters and donation ticker, masonry campaign feed with search and filters (country, city, category, age, gender, urgency, sort), verified profiles with timeline, gallery, comments, share and report, transparency report, FAQ, legal and contact pages, light/dark/system theme, sitemap and robots.

**Donors (no account)**: preset or custom amount, 16 currencies converted at a live rate before payment, anonymous or public identity with optional message, confetti and receipt on success.

**Beneficiaries**: 4-step registration, dashboard with verification journey, profile completion and next steps, campaign editor (draft, images, submit), document manager, encrypted payout methods (choose which are public), supporter list with thank-you notes, notifications, timeline updates.

**Auditors**: TOTP-protected console, prioritised review queue, full applicant record, protected document viewer, verification checklist, approve / request info / reject, fraud alerts, community reports, suspend / ban / reinstate, activity log. Admins can add auditors and permanently ban.

## Anti-scam and security

- Nothing is public until an auditor approves it; approval needs the five core checks and every approval gets a unique verification ID.
- Duplicate detection on national ID, phone, document hash, emergency contact and signup IP (HMAC fingerprints, no plaintext lookups).
- Automated document scoring and a 0-100 fraud score; scores of 80+ require an admin to approve. Scores flag, humans decide.
- Community reports feed the score and the auditor queue.
- JWT access tokens held in memory only; refresh token in an httpOnly cookie with rotation, reuse detection and double-submit CSRF.
- Role-based access, mandatory 2FA for staff, per-endpoint rate limits, account lockout, Origin guard, Helmet, strict input validation (Zod).
- National IDs and payout details encrypted with AES-256-GCM. Private documents are sniffed by content (not filename), stored privately and served only to authenticated auditors, with every access written to the audit log.
- Beneficiaries are shown as first name and last initial; rejected applications stay private.

## Payments

Adapters live in `apps/api/src/payments/gateways`: Stripe (cards, Apple Pay, Google Pay), PayPal, Flutterwave, Paystack, M-Pesa, Wise (manual confirm by admin) and a crypto gateway (BTC, ETH, USDT). A gateway is offered to donors only when its keys are configured. With `PAYMENTS_MOCK=true` a "Test payment" option confirms instantly for local development. **Set `PAYMENTS_MOCK=false` in production.** Webhook endpoints are under `/api/webhooks/*` and verify signatures.

Set `PLATFORM_FEE_PERCENT` to take a fee; it is shown to donors before paying and on the Transparency page.

## Tests

```bash
npm run typecheck
node apps/api/test/smoke.mjs     # 63 API checks; needs a freshly seeded DB and a running API
```

The smoke suite covers donations and privacy projection, registration, duplicate detection, upload sniffing, review gating, 2FA, suspension, audit logging, CSRF and rate limiting. Re-seed (`npm run db:seed`) between runs, because the suite creates data and exercises rate limits.

## Deployment

| Piece | Suggested host | Notes |
| --- | --- | --- |
| Web | Vercel | Set `API_URL` to the API's public URL and `NEXT_PUBLIC_SITE_URL`. Next proxies `/api` and `/files`, so cookies stay first-party. |
| API | Railway or Render | `npm run build -w apps/api`, start with `npm run start -w apps/api`, run `npm run db:deploy` on release. Set `NODE_ENV=production` and `WEB_ORIGIN` to the web origin. |
| Database / cache | Managed Postgres + Redis | |
| Files | Cloudinary | Fill the three `CLOUDINARY_*` vars. Without them files go to local disk, which is fine for development only. |
| CDN / WAF | Cloudflare | |

### Transactional email

The API uses Resend to email account notifications, including signup, campaign review updates, and successful donations. Set `RESEND_API_KEY` and `RESEND_FROM` in the API environment only; never expose the API key to the web app. `RESEND_FROM` must be a sender address verified in Resend for production. Email delivery is best-effort, so a provider outage does not block account or donation workflows; notifications remain available in the dashboard.

Production checklist: real secrets, `PAYMENTS_MOCK=false`, HTTPS everywhere, seeded demo accounts removed (never run the seed against production), Cloudinary configured, legal pages reviewed by counsel, gateway webhooks registered, backups on.

## Known limits

- Currency rates and the crypto gateway need live provider keys to be exercised end to end; the code paths are covered only up to the mock gateway.
- The seed's demo campaigns use generated artwork, not photographs.
- Legal pages are templates, not legal advice.
