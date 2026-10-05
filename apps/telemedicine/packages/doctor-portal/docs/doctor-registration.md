# Doctor registration

## Frontend routes

- /register: four-step account, professional details, credential documents, and review/consent form.
- /login: email/password sign-in and an authenticator challenge when the API requests MFA.
- /forgot-password: generic password-recovery response.
- /verify-email?token=...: explicit email verification. No client-side token approval.
- /registration/status: email verification and credential-review outcomes; no clinical session is created for pending applications.
- /preview: separate sample portal entry, disabled when an authentication API is configured. The previous doctor-switcher entry has been removed.

The implementation currently runs as a frontend preview. Submitting the preview never creates an account, uploads files, sends email, or grants new doctor access. Passwords and files stay in memory; an explicitly saved draft contains only contact and professional fields in sessionStorage. Consent and passwords must be re-entered after restoring a draft.

## Research and design decisions

- MDCN distinguishes registration from current licensure. Collect the folio/registration number, full registration certificate, current annual or life practising licence, and annual expiry date. Actual eligibility and verification must be determined by the reviewer/server, not by the browser.
  - https://www.mdcn.gov.ng/page/about-us/mdcn-act-other-regulation
  - https://www.mdcn.gov.ng/public/storage/documents/document_760520018.pdf
- OWASP recommends email ownership verification, long passphrases, password-manager support, secure sessions and MFA. The form accepts spaces/paste, uses a 15-character minimum with a 128-character maximum, and supports a server-issued sign-in MFA challenge. Blocklisted password checks and authentication are server responsibilities.
  - https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html
- Optional marketing consent is separate from mandatory registration declarations. Policy dialogs in preview are explicitly non-binding placeholders, not published legal terms. Live registration is blocked without configured, approved Terms and Privacy URLs.

These are implementation choices informed by the sources, not a compliance certification or an assertion that Sabi Health's legal policies have been approved.

## Authentication API contract

Set VITE_AUTH_API_BASE_URL, VITE_DOCTOR_TERMS_URL and VITE_DOCTOR_PRIVACY_URL and rebuild.

| Endpoint under API base | Request | Response / action |
| --- | --- | --- |
| POST /doctors/register | multipart FormData: application JSON, licence file, registrationCertificate file | applicationId, email, status=email_pending; send time-limited, single-use email verification link |
| POST /doctors/login | JSON email, password | doctor for an authenticated account, or mfaRequired=true with challengeId |
| POST /doctors/login/mfa | JSON challengeId, code | doctor after successful MFA verification |
| GET /doctors/session | session cookie | doctor for the current authenticated session; 401 if no session |
| POST /doctors/logout | session cookie | revoke session; 204 |
| POST /doctors/password-reset | JSON email | generic response; send recovery instructions if appropriate |
| POST /doctors/resend-verification | JSON email | generic response; rate-limit email requests |
| POST /doctors/verify-email | JSON token | verified email and review_pending status |

A doctor session requires id, name, accountStatus=active, emailVerified=true and licenceVerified=true. Optional display fields: specialty, hospital, hospitalId, initials, firstNameGreeting, email. Suspended, rejected and deactivated accounts are denied access. Set active only after credential approval and the authentication policy's MFA requirements have been satisfied.

Server requirements: HTTPS; secure HttpOnly session cookies; appropriate SameSite/CORS and CSRF protections; password hashing; breached-password checks; rate limits; generic account-enumeration-safe responses; unique canonical email/MDCN checks; server-issued doctor IDs; authoritative consent versioning; primary-source credential verification; document content/size validation and scanning; protected document storage; audit records; and server authorization on every clinical endpoint. Client checks are only usability safeguards. Revalidate every field and document on the server.

The existing clinical data stores remain local preview stores. Connecting authentication alone does not connect patient records, messaging, prescribing or the hospital queue to production APIs.

## Verification

Run npm test and npm run build. Tests cover registration validation, expiry dates, document constraints, consent, secret-free draft restoration, email canonicalization, and denial of unapproved sessions. Browser checks cover all four steps, sample file selection, review and preview completion.
