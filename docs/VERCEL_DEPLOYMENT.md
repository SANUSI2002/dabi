# Sabi Vercel deployment map

One Git repository supplies **five Vercel projects**. All five projects use the repository root as their Root Directory. The Sabi Health project serves the public landing site and organization onboarding. EMR, Pharmacy, Command Center, and Telemedicine have separate deployments and origins. The landing build also retains the existing `/telemedicine/` patient app as a compatibility path until the dedicated Telemedicine domain is configured.

| Vercel project | Current Vercel address | Build command | Output Directory | Install command |
| --- | --- | --- | --- | --- |
| `sabi-health` | `https://sabi-health-delta.vercel.app` | `npm run build:health` | `dist-health` | `npm ci && npm ci --prefix apps/telemedicine` |
| `sabi-emr` | `https://sabi-emr.vercel.app` | `npm run build:emr` | `dist-emr` | `npm ci` |
| `sabi-pharmacy` | `https://sabi-pharmacy.vercel.app` | `npm run build:pharmacy` | `dist-pharmacy` | `npm ci` |
| `sabi-command-center` | `https://sabi-command-center.vercel.app` | `npm run build:command-center` | `dist-command-center` | `npm ci` |
| `sabi-telemedicine` | `https://sabi-telemedicine.vercel.app` | `npm run build:telemedicine` | `dist-telemedicine` | `npm ci --prefix apps/telemedicine` |

Set Framework Preset to **Other** if Vercel's Vite detection overrides the custom build/output settings. Set Node.js to 22.x (or another version compatible with the installed Vite release). The root `vercel.json` preserves SPA deep links; `/telemedicine/*` resolves to the embedded patient app, while other routes resolve to the root app. Static files are served before the rewrites.

## Vercel environment variables

The production projects use these public build-time cross-product URLs. They are Vercel addresses, not owned custom domains:

```text
VITE_SABI_HEALTH_URL=https://sabi-health-delta.vercel.app
VITE_SABI_EMR_URL=https://sabi-emr.vercel.app
VITE_SABI_PHARMACY_URL=https://sabi-pharmacy.vercel.app
VITE_SABI_COMMAND_CENTER_URL=https://sabi-command-center.vercel.app
VITE_SABI_TELEMEDICINE_URL=https://sabi-telemedicine.vercel.app
VITE_TELEMEDICINE_SIGN_IN_URL=https://sabi-telemedicine.vercel.app/login
VITE_HOSPITAL_ONBOARDING_URL=https://sabi-health-delta.vercel.app/register/organization
```

`VITE_HOSPITAL_ONBOARDING_URL` belongs to the Telemedicine project; without it, the standalone patient app's hospital-onboarding link would point to its own domain. Also set `VITE_API_BASE_URL` only when the authenticated backend is deployed and its CORS configuration allows all relevant origins. Never put API keys, database credentials, payment secrets, or signing keys into a `VITE_` variable; those are embedded in the public browser bundle. The landing compatibility copy uses Vite's `/telemedicine/` base; the dedicated Telemedicine project uses `/`.

For local verification:

```text
npm ci
npm ci --prefix apps/telemedicine
npm run build:health
npm run build:emr
npm run build:pharmacy
npm run build:command-center
npm run build:telemedicine
```

## Domains and Git

The public landing page's **Sign In** link opens a service chooser at `/access` (`/login` is also a chooser on the Health deployment). Direct sign-in entry points are `sabi-emr.vercel.app/login` for hospital organizations, `sabi-pharmacy.vercel.app/pharmacy/login` for pharmacy organizations, `sabi-command-center.vercel.app/command-center/login` for platform staff, and `sabi-telemedicine.vercel.app/login` for patients. The Telemedicine sign-in is its existing application; these routes do not create production identities or credentials.

1. The five projects above are created under the `sanusi2002s-projects` Vercel scope and deployed directly from this checkout. The Git remote is `https://github.com/SANUSI2002/dabi.git`.
2. Git auto-deployment is **not yet connected**. `vercel git connect` reported that the Vercel account needs a GitHub Login Connection. Connect GitHub `SANUSI2002` to the Vercel account and grant access to `dabi`, then connect the same repository to each of the five projects. Until then, a Git push does not trigger Vercel deployment; use the CLI or dashboard to deploy manually.
3. Once an owned domain is available, assign its apex or `www` to `sabi-health`, then `emr`, `pharmacy`, `command`, and `care` subdomains to the corresponding projects in **Settings → Domains**. Follow the DNS records Vercel shows for the registrar; do not guess the target CNAME.
4. Update the public URL variables above to the custom origins and redeploy. Test direct links and refreshes at `/` on the landing site, `/login` on EMR, `/pharmacy/login` on Pharmacy, `/command-center` on Command Center, and `/login` and `/pharmacy-market` on Telemedicine.

## Release limitation

These builds package the current frontend. They **do not** make the unfinished backend production-ready. Production fixtures are disabled: organization authentication, platform-admin authentication, patient/pharmacy order exchange, authoritative payments, tenant enforcement, and server-side inventory/dispensing still require backend endpoints. The EMR, Pharmacy, and Command Center builds share root-app code; separate origins are not a server-side security boundary. Do not use this deployment for real patient, prescription, inventory, or payment data until those services, access controls, and production tests are in place.
