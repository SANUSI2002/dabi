# Sabi Vercel deployment map

One Git repository supplies **three Vercel projects**. All three projects use the repository root as their Root Directory. Sabi Health contains the public landing site at `/` and the existing telemedicine/patient portal at `/telemedicine/`. EMR and Pharmacy are separate deployments with their own domains and browser storage.

| Vercel project | Example domain (replace with your owned domain) | Build command | Output Directory | Install command |
| --- | --- | --- | --- | --- |
| `sabi-health` | `www.example.com` | `npm run build:health` | `dist-health` | `npm ci && npm ci --prefix apps/telemedicine` |
| `sabi-emr` | `emr.example.com` | `npm run build:emr` | `dist-emr` | `npm ci` |
| `sabi-pharmacy` | `pharmacy.example.com` | `npm run build:pharmacy` | `dist-pharmacy` | `npm ci` |

Set Framework Preset to **Other** if Vercel's Vite detection overrides the custom build/output settings. Set Node.js to 22.x (or another version compatible with the installed Vite release). The root `vercel.json` preserves SPA deep links; `/telemedicine/*` resolves to the embedded patient app, while other routes resolve to the root app. Static files are served before the rewrites.

## Vercel environment variables

Set these in **all three projects** once the real domains or their temporary `*.vercel.app` URLs are known:

```text
VITE_SABI_HEALTH_URL=https://www.example.com
VITE_SABI_EMR_URL=https://emr.example.com
VITE_SABI_PHARMACY_URL=https://pharmacy.example.com
VITE_TELEMEDICINE_SIGN_IN_URL=https://www.example.com/telemedicine/login
```

Also set `VITE_API_BASE_URL` only when the authenticated backend is deployed and its CORS configuration allows the three origins. Never put API keys, database credentials, payment secrets, or signing keys into a `VITE_` variable; those are embedded in the public browser bundle. The telemedicine app can be served at a nested path because its router and asset URLs use Vite's `/telemedicine/` base during this build.

For local verification:

```text
npm ci
npm ci --prefix apps/telemedicine
npm run build:health
npm run build:emr
npm run build:pharmacy
```

## Domains and Git

1. Add this repository to Vercel three times, applying the project settings above. Do not create three separate Git repositories.
2. Assign the apex or `www` domain to `sabi-health`, the `emr` subdomain to `sabi-emr`, and the `pharmacy` subdomain to `sabi-pharmacy` in each project's **Settings → Domains**. Follow the DNS records Vercel shows for your registrar; do not guess the target CNAME.
3. Add the environment variables, redeploy, and test direct links and refreshes at `/`, `/telemedicine/login`, `/telemedicine/pharmacy-market`, `/login` on EMR, and `/pharmacy/login` on Pharmacy.
4. After the Git repository URL is supplied, add it as `origin` and push the prepared commit. No remote URL is currently configured in this checkout.

## Release limitation

These builds package the current frontend. They **do not** make the unfinished backend production-ready. Production fixtures are disabled: organization authentication, patient/pharmacy order exchange, authoritative payments, tenant enforcement, and server-side inventory/dispensing still require backend endpoints. Do not use this deployment for real patient, prescription, inventory, or payment data until those services, access controls, and production tests are in place.
