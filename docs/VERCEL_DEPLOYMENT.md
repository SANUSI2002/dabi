# Sabi Vercel deployment map

One Git repository supplies **five Vercel projects**. All five projects use the repository root as their Root Directory. The Sabi Health project serves the public landing site and organization onboarding. EMR, Pharmacy, Command Center, and Telemedicine have separate deployments and origins. The landing build also retains the existing `/telemedicine/` patient app as a compatibility path until the dedicated Telemedicine domain is configured.

| Vercel project | Example domain (replace with your owned domain) | Build command | Output Directory | Install command |
| --- | --- | --- | --- | --- |
| `sabi-health` | `www.example.com` | `npm run build:health` | `dist-health` | `npm ci && npm ci --prefix apps/telemedicine` |
| `sabi-emr` | `emr.example.com` | `npm run build:emr` | `dist-emr` | `npm ci` |
| `sabi-pharmacy` | `pharmacy.example.com` | `npm run build:pharmacy` | `dist-pharmacy` | `npm ci` |
| `sabi-command-center` | `command.example.com` | `npm run build:command-center` | `dist-command-center` | `npm ci` |
| `sabi-telemedicine` | `care.example.com` | `npm run build:telemedicine` | `dist-telemedicine` | `npm ci --prefix apps/telemedicine` |

Set Framework Preset to **Other** if Vercel's Vite detection overrides the custom build/output settings. Set Node.js to 22.x (or another version compatible with the installed Vite release). The root `vercel.json` preserves SPA deep links; `/telemedicine/*` resolves to the embedded patient app, while other routes resolve to the root app. Static files are served before the rewrites.

## Vercel environment variables

Set these in the projects that need cross-product links once real domains or temporary `*.vercel.app` URLs are known. The URLs below are placeholders, not owned domains:

```text
VITE_SABI_HEALTH_URL=https://www.example.com
VITE_SABI_EMR_URL=https://emr.example.com
VITE_SABI_PHARMACY_URL=https://pharmacy.example.com
VITE_SABI_COMMAND_CENTER_URL=https://command.example.com
VITE_SABI_TELEMEDICINE_URL=https://care.example.com
VITE_TELEMEDICINE_SIGN_IN_URL=https://care.example.com/login
VITE_HOSPITAL_ONBOARDING_URL=https://www.example.com/register/organization
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

1. Add this repository to Vercel five times, applying the project settings above. Do not create five separate Git repositories.
2. Assign the apex or `www` domain to `sabi-health`, then the `emr`, `pharmacy`, `command`, and `care` subdomains to the corresponding projects in **Settings → Domains**. Follow the DNS records Vercel shows for your registrar; do not guess the target CNAME.
3. Add the environment variables, redeploy, and test direct links and refreshes at `/` on the landing site, `/login` on EMR, `/pharmacy/login` on Pharmacy, `/command-center` on Command Center, and `/login` and `/pharmacy-market` on Telemedicine.
4. After the Git repository URL is supplied, add it as `origin` and push the prepared commit. No remote URL is currently configured in this checkout.

## Release limitation

These builds package the current frontend. They **do not** make the unfinished backend production-ready. Production fixtures are disabled: organization authentication, platform-admin authentication, patient/pharmacy order exchange, authoritative payments, tenant enforcement, and server-side inventory/dispensing still require backend endpoints. The EMR, Pharmacy, and Command Center builds share root-app code; separate origins are not a server-side security boundary. Do not use this deployment for real patient, prescription, inventory, or payment data until those services, access controls, and production tests are in place.
