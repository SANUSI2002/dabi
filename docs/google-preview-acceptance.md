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
