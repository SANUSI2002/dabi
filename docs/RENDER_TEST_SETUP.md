# Sabi live API test setup

The dedicated test API is `https://sabi-health-api-test.onrender.com` and its health endpoint is `/api/health`. It is separate from the existing staging backend. Its Render PostgreSQL database is disposable: the free database expires on 23 October 2026 and has no backups. Use synthetic data only; do not enter patient information.

## Local frontend integration

The root Vite app serves Sabi Health, EMR, Pharmacy, and Command Center on `http://127.0.0.1:5173`. Telemedicine runs on `http://127.0.0.1:5174`. Both development servers proxy `/api` to the test API so the browser can use same-origin requests and session cookies.

Create the ignored root `.env.development.local` with:

```dotenv
VITE_API_BASE_URL=same-origin
SABI_DEV_API_TARGET=https://sabi-health-api-test.onrender.com
```

Create the ignored `apps/telemedicine/packages/patient-portal/.env.development.local` with:

```dotenv
VITE_SABI_IDENTITY_API_URL=same-origin
VITE_SABI_IDENTITY_UI_URL=http://127.0.0.1:5173
SABI_DEV_API_TARGET=https://sabi-health-api-test.onrender.com
```

Run `npm run dev` from the repository root. Check both `http://127.0.0.1:5173/api/health` and `http://127.0.0.1:5174/api/health`. The local sign-in screens are `/emr/login`, `/pharmacy-portal/login`, `/command-center/login`, and telemedicine `/login` on port 5174. Use the patient sign-up flow for a test identity; an EMR, Pharmacy, or Command Center login also requires the appropriate organization membership or platform role. Old fixture credentials are not valid against the live API.

Run `node scripts/smoke-live-auth.mjs http://127.0.0.1:5173` or use port 5174. The script creates a random synthetic patient account and verifies registration, login, current user, refresh, and logout. It does not print the password.

## Vercel test deployments

The five existing Vercel projects use `VITE_API_BASE_URL=same-origin` for the root app and `VITE_SABI_IDENTITY_API_URL=same-origin` for telemedicine. The root `vercel.json` routes `/api/:path*` to the dedicated Render test service before the SPA fallback. The backend `CLIENT_URLS` includes the five custom-domain origins, the original five Vercel origins, and the two local development origins; `CLIENT_URL=https://sabihealth.org` supplies identity links. No database URL or backend secret is stored in Vercel or this frontend repository.

These custom domains are for synthetic testing only; the original `.vercel.app` addresses remain available:

| Surface | URL |
| --- | --- |
| Sabi Health | `https://sabihealth.org` |
| EMR | `https://emr.sabihealth.org` |
| Pharmacy | `https://pharmacy.sabihealth.org` |
| Command Center | `https://command.sabihealth.org` |
| Telemedicine | `https://telemedicine.sabihealth.org` |

Run `node scripts/smoke-live-auth.mjs https://pharmacy.sabihealth.org` to verify registration, cookie-backed login, current user, refresh, and logout through a public deployment. The script accepts only the named Sabi test sites, local origins, or the dedicated Render test API.

Telemedicine's `/signup/patient` now submits to `/api/v1/auth/register/patient`; it no longer claims success after only storing a local fallback. A successful registration returns the patient to `/login`. Dependent registration, professional onboarding, and organization membership provisioning are separate workflows and are not validated by this patient-registration test.

The free Render service can spin down after inactivity, delaying the first request. The free database expires on 23 October 2026 and has no backups. Replace both before any real use. Render currently auto-deploys backend `main` pushes to this test service, so verify `/api/health` and the deploy events after every backend push. The Vercel projects are CLI-deployed rather than Git-connected, so pushing frontend code does not automatically redeploy them.

## Domain-based password recovery

`sabihealth.org` is verified in Resend for outbound mail. Namecheap BasicDNS holds Resend's DKIM record (`resend._domainkey`), return-path CNAMEs (`rsend` and `send`), and a monitoring-only DMARC policy. Leave the separate Namecheap Private Email incoming-mail records intact. The test API uses server-only `RESEND_API_KEY` and `PASSWORD_RESET_EMAIL_FROM=Sabi Health <no-reply@sabihealth.org>`; never copy the API key into Vercel, `VITE_` variables, Git, or documentation. An HTTP 202 from `/api/v1/auth/password-reset/request` with a nonexistent address verifies API configuration, not actual delivery. Test a real mailbox through the UI before relying on recovery, and monitor Resend delivery logs. Rotate any key accidentally displayed or placed in another environment field.

## Command Center test access

Command Center is not a self-service account type. A standard Sabi ID created through patient sign-up does not receive a platform role. The live Command Center sign-in checks a backend platform assignment, then requires authenticator setup or a recent MFA verification before showing the server-owned organization registry. Package editing, approvals, and provisioning remain unavailable against the live API; the old browser-fixture controls must not be mistaken for saved live changes.

For the *first* test administrator only, operations can use the backend's `scripts/bootstrap-test-platform-admin.mjs` against its dedicated test database. The Sabi ID must already exist and be active. Supply `SABI_TEST_PLATFORM_ADMIN_EMAIL` and `DATABASE_URL` privately in the backend environment; run without `--apply` first to inspect the dry-run result. Applying requires `SABI_TEST_PLATFORM_BOOTSTRAP_CONFIRM=grant-test-platform-admin` and `--apply`. The script refuses non-test database names and refuses to create a second administrator. Do not put a database URL or password in the frontend, Git, chat, or logs. Subsequent staff assignments need a separately approved, audited management workflow.

Render's `/api/health` probe must not be rate-limited: repeated HTTP 429 responses caused Render to mark the instance failed and return 502 to all five sites on 23 September 2026. The backend regression test `test/health-rate-limit.test.js` protects this contract.

For a deliberate frontend update, deploy each existing project from this repository root using `npx --yes vercel@59.25.0 deploy --prod --yes --project <project-name> --scope sanusi2002s-projects`, where `<project-name>` is `sabi-health`, `sabi-emr`, `sabi-pharmacy`, `sabi-command-center`, or `sabi-telemedicine`. Review and commit the working tree before relying on a future Git-based deployment: the September 23 test rollout was built directly from local workspace files.
