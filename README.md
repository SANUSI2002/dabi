# Sabi OS / Sabi Health

Sabi OS is a multi-tenant healthcare operating system prototype covering EMR, diagnostics, billing, workforce, HR, accounting, organization onboarding, tenant provisioning, and the Sabi Command Center.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts the main Sabi platform on port 5173 and the existing
patient/telemedicine portal on port 5174. To run them separately, use
`npm run dev:main` and `npm run dev:telemedicine`.

The Vite application is available at `http://127.0.0.1:5173` by default.

For separate landing, EMR, Pharmacy, Command Center, and Telemedicine Vercel deployments, see [the deployment guide](docs/VERCEL_DEPLOYMENT.md).

## Quality commands

```bash
npm run lint
npm test
npm run build
npm run check
```

`npm run check` is the complete local quality gate: lint, the Vitest regression suite, TypeScript compilation, and the production Vite build.

The automated suite currently protects:

- organization-qualified browser persistence;
- cross-tenant and cross-branch billing fixture isolation;
- invoice payment-status and allocation reconciliation;
- public roadmap privacy and internal-field redaction;
- atomic release shipment and immutable shipped releases;
- accessible, route-aware Sabi OS loading screens.

## Backend boundary

The current application defaults to local browser adapters while backend services are under development. Revenue-cycle API contracts, service rules, and the PostgreSQL migration are documented in [`docs/revenue-cycle-backend.md`](docs/revenue-cycle-backend.md). Never treat browser identity or tenant values as authoritative in production; backend services must derive organization, branch, actor, and permissions from verified sessions.
