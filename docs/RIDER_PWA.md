# Sabi Rider: mobile and installed app

The rider app remains at `https://pharmacy.sabihealth.org/rider/`. It has a separate manifest identity (`/rider/`), home-screen name **Sabi Rider**, start page `/rider/dashboard`, and shortcuts to deliveries and earnings. The shared Sabi icons are retained. No new domain or credentials are required.

`src/rider/riderAppState.ts` selects `/rider/manifest.webmanifest` before React mounts and `RiderPwaRoute` tracks subsequent client-side navigation. Leaving rider routes restores the deployment's original manifest and theme metadata. Installation events outside rider routes are not intercepted.

The existing root service worker handles the rider code shell as well as pharmacy pages. The manifest's application scope is not a separate service-worker or authentication boundary. Accounts, roles and server-side access checks are unchanged.

## Phone behaviour

- Chrome/Edge/Samsung Internet: the Install app control invokes the browser prompt when available. Otherwise it explains the browser-menu option without claiming the app was installed.
- iPhone/iPad: Safari Share → Add to Home Screen. Actual OS installation must be checked on a physical device; desktop viewport emulation cannot prove it.
- Standalone display and an accepted install hide the invitation. Browser-specific eligibility and existing installations may affect the availability of a second app on the same origin.
- Mobile bottom navigation remains limited to five destinations; earnings is available from dashboard/account. Safe-area spacing supports phone notches and home indicators, including landscape. Zoom remains enabled; form inputs remain 16px.
- Installation does not grant background location, push permissions or notification delivery. Rider GPS continues to work only in the foreground under the existing consent rules.

## Offline and updates

Only the existing static app shell/code/icons/images are cached. `/api` and external origins remain outside the cache rules. Recipient addresses, handover codes, earnings, uploaded documents and bank details are not added to caches or local storage by this feature.

The rider sees an offline notice and must reconnect for live offers, uploads, handover confirmation and payouts. There is no offline mutation queue, fabricated success or automatic replay on reconnect. The app needs a previous successful online visit to have its shell cached.

Updates still require the person's explicit Reload action. The update notice sits above rider bottom navigation rather than covering it. No forced refresh interrupts a delivery confirmation or application form.

## Verification

Tests cover manifest identity/icons, restoration when leaving rider routes, install prompt acceptance/dismissal/error, iPhone guidance, offline/reconnect status and not intercepting pharmacy installs. Existing rider registration, role checks, earnings and two-code delivery tests must continue passing. Verify production-generated manifest, worker and static assets separately from development-server checks.
