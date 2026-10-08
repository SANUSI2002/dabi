# Standalone doctor / professional portal

The existing professional portal is now deployed by `sabi-doctor` at
`https://doctor.sabihealth.org`. It is another Vercel project linked to the same
`SANUSI2002/dabi` repository and production branch `master`, not a new repository.

- Build: `npm run build:doctor`; output: `dist-doctor`.
- Install: `npm ci && npm ci --prefix apps/telemedicine`; Node 22.
- Doctor router, asset base and PWA scope/start URL are `/` on the new domain.
- `/api/*` stays reverse-proxied to the existing Sabi backend. No credentials,
  clinical records or account roles are copied or changed by the move.
- Backend `CLIENT_URLS` must include `https://doctor.sabihealth.org`, and
  `DOCTOR_PORTAL_URL=https://doctor.sabihealth.org` controls future verification emails.
- The landing page and patient portal use the new doctor login/registration links.
  Optional public overrides: `VITE_SABI_DOCTOR_URL` and `VITE_DOCTOR_PORTAL_URL`.
- Browser requests to the former `/doctor-portal/*` and
  `/telemedicine/doctor-portal/*` locations receive temporary redirects preserving
  their route/query. Browsers preserve an existing fragment when the redirect
  destination has none, so old email verification fragments are not sent to a server.
  Asset and service-worker requests remain on their old hosts for already-open clients.
- Session cookies remain host-only. Doctors sign in again on the new domain with
  their existing credentials; patient sign-in is unchanged. Do not broaden cookie
  scope to all subdomains or remove the verified-professional access checks.
- Existing local development paths remain unchanged.

Namecheap record: CNAME `doctor` to the project-specific hostname recommended by
Vercel. Existing site and email records remain unchanged. Deploy the new portal and
verify DNS/TLS before releasing the public links and legacy redirects.
