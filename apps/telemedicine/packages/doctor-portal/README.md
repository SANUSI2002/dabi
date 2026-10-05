# Sabi Health Doctor Portal

Imported from the supplied doctor-portal archive and integrated into the existing telemedicine workspace.

## Entry points

- Telemedicine: `/doctor-portal/login` and `/doctor-portal/register`.
- Landing site fallback: `/telemedicine/doctor-portal/login`.
- Patient sign-in links to Doctor Portal; selecting Doctor during signup opens its registration page.
- The patient's existing `/doctor` directory stays separate from the clinician workspace.

## Run and build

From the repository root:

```
npm run dev:doctor
npm run dev:doctor-preview
npm run test:doctor
npm run build:telemedicine
npm run build:health
```

The local doctor server uses port 5175. Only explicit `doctor-preview` development mode permits sample sessions at `/doctor-portal/preview`. Production disables sample sign-in. Sample clinical workflows never run under a connected identity.

## Connected functionality

- Sabi Identity sign-in, authenticator/recovery challenges, session restoration, password reset requests and logout.
- Active account, verified email and verified DOCTOR profile are required for workspace entry.
- Dashboard, appointments (accept/decline/cancel/complete and HTTPS meeting links), calendar, publishing/removing availability, practice profile and NGN consultation fee.
- Patient lists use stable server identities and separate dependent IDs. Care requests can be accepted or declined.
- Prescription drafts, review, editing and issuing use the existing care-relationship and verified-prescriber APIs.
- Notifications, real device-session revocation and central MFA settings.

## Remaining services

The registration form requires a multipart credential-registration service. The existing `/professionals/register` JSON endpoint does not persist its documents or implement its email-verification workflow. Submission stays unavailable until those services are connected. Configure `VITE_DOCTOR_REGISTRATION_API_URL`, `VITE_DOCTOR_TERMS_URL` and `VITE_DOCTOR_PRIVACY_URL` only when the credential service exists.

Clinical notes/reports, messaging, hospital queue handoff, settled earnings/payouts, reviews and patient-record/AI-consent APIs still require integration. Their imported frontend flows remain available in local preview; connected accounts receive an availability screen instead of fabricated records or browser-only saves.

## Deployment

The Vercel build script includes this app in both telemedicine and health output folders. Deep links route to its own index. Backend changes expose account verification fields, stable patient IDs and a doctor-scoped single-appointment read route; deploy them alongside the frontend. No migration or role grant is introduced.
