# Sabi Product Roadmap architecture

## Source of truth

The Command Center Product Catalog remains the source for products and modules. Roadmap items store only `productId` and `moduleId` references. The roadmap does not introduce a second product catalog.

## Current runtime

The backend is still in development, so `useRoadmap` is a versioned, globally persisted local repository behind `roadmapService`. UI code uses the service for mutations and the public serializer for reads. Replace the repository implementation with authenticated HTTP calls when the platform API is ready; page components should not need to change.

## Security boundary

`RoadmapItem` is the internal model. `RoadmapPublicDTO` is the only object accepted by the public website. The public route imports only `usePublicRoadmap`, a safe persisted projection; it does not import the internal roadmap store or service. Command Center mutations regenerate that projection through `serializePublishedRoadmap`, which requires:

- `visibility === PUBLIC`
- `publicationStatus === PUBLISHED`
- a non-internal Product Catalog product
- complete public title, summary and timeframe

The DTO has no internal title, owner, assignees, exact engineering dates, priority, confidence, health, risks, dependencies, comments, internal notes, cost or attachments.

The local serializer demonstrates and tests this policy, but production security must enforce it on a public backend endpoint. The browser must not receive internal records in API mode.

Roadmap activity and roadmap audit history are stored separately. Each local roadmap mutation also writes into the existing Command Center platform audit feed; there are no edit or delete actions for either audit collection.

## Safe hierarchy rule

A private child never appears publicly. A public child of a private parent may appear independently under its public product/module; the private parent ID is omitted. This prevents an internal initiative name or hierarchy from leaking.

## Proposed API boundaries

Public, cacheable reads:

- `GET /public/roadmap/products`
- `GET /public/roadmap/items`
- `GET /public/roadmap/releases`

Authenticated platform operations:

- `GET /platform/roadmap/items`
- `POST /platform/roadmap/items`
- `PATCH /platform/roadmap/items/{id}`
- `POST /platform/roadmap/items/{id}/submit`
- `POST /platform/roadmap/items/{id}/approve`
- `POST /platform/roadmap/items/{id}/publish`
- `POST /platform/roadmap/items/{id}/unpublish`
- `GET /platform/roadmap/releases`
- `POST /platform/roadmap/releases`
- `PATCH /platform/roadmap/releases/{id}`
- `POST /platform/roadmap/releases/{id}/scope`
- `POST /platform/roadmap/releases/{id}/ship`

The backend must revalidate Product/Module relationships, hierarchy, permissions and publication content. Publish/unpublish must create immutable audit records and invalidate the public cache.

## Implemented phases

- Phase 1: domain, validation, repository/service seam, RBAC, public DTO and scenario verification.
- Phase 2: Command Center metrics, filters and Gantt/List/Kanban views, create/edit and detail workflows.
- Phase 3: public-content preparation, preview, review/approval/publish/unpublish transitions and audit history.
- Phase 4: integrated `/roadmap` public page with product/module/status filters and Timeline/List/Kanban views.
- Phase 5: versioned releases, audited scope assignment, immutable target history, controlled shipment and automatic public Upcoming/Released views.

Comments, dependencies, notifications, richer reporting and exports have domain seams but remain later incremental phases.
