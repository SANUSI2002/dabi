# Google backend acceptance preview

The existing production `vercel.json` is intentionally unchanged. Use the separate
`vercel.google-preview.json` only for a **preview** deployment of the existing
`sabi-health` project, never `--prod` or alias reassignment during acceptance.

The preview builds the root app, `/telemedicine/` patient portal and
`/telemedicine/doctor-portal/` professional portal from this reviewed checkout.
API calls stay same-origin and are proxied to the new Google API. Production
doctor redirects are omitted only in this preview so sign-in stays in its own
session and backend. No secrets are embedded in the build configuration.

After the exact preview URL is known:

1. Confirm and add that single origin to the Google API's trusted browser origins.
   Do not permit wildcard Vercel origins or disable CSRF checks.
2. Arrange verification/reset callback bases to return to the matching preview
   while testing the fresh database. The old live frontend still reaches the old
   backend, so its verification links must not be used for new-Google-account tests.
3. A user enters their own new password and verifies their email. Existing Render
   passwords, sessions and admin grants have not been migrated.
4. Verify authentication, refresh/logout, upload/scan/authorised preview and role
   boundaries. A fresh platform-admin assignment needs a separate explicit grant.
5. Record backend revision and actual HTTP results. A rendered page or passing
   health endpoint alone does not establish workflow completion.

Do not switch production frontends until these checks and the remaining recovery
and security acceptance work are complete.

## Prepared preview — 24 October 2026

Protected preview: [Open patient signup](https://sabi-health-2hkde60mn-sanusi2002s-projects.vercel.app/telemedicine/signup/patient).
Deployment `dpl_9oFSV3ErjcfmBQRfTMQ1X4RLqgZj` is Ready. Its API proxy returned
Google backend revision `9a89181d22f877a7cba4d0c1433f2de45a1d4f27`.
Patient and doctor login HTML returned 200; unsigned platform API access returned
401. The user signed into Vercel and the actual landing/login/signup UI rendered.

The owner-approved single preview origin and matching temporary callback bases
are active on the Google API/worker. Patient verification links return below
`/telemedicine`; reset links return to the root identity page. Exact-origin
clinical-bucket preflights were also verified without making storage public.
No fresh Sabi account, successful verification email or signed-in upload/scan
workflow is claimed yet. The user must enter their own password and verify their
mailbox; old Render credentials and platform-admin grants were not migrated.
All production domains and the existing production `vercel.json` remain unchanged.
