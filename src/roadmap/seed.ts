import type { RoadmapActivity, RoadmapAuditRecord, RoadmapItem, RoadmapRelease } from "./domain";

const createdAt = "2026-09-01T09:00:00.000Z";
const base = { organizationId: "org-sabi", confidence: "MEDIUM" as const, createdAt, updatedAt: createdAt, createdBy: "pu_ada", updatedBy: "pu_ada" };

export const seedRoadmapItems: RoadmapItem[] = [
  {
    ...base, id: "roadmap-encounter-billing", productId: "emr", moduleId: "emr.billing", type: "INITIATIVE",
    title: "Encounter-Based Billing", internalDescription: "Connect clinical service events to patient accounts, invoices, allocations and accounting events.",
    status: "IN_PROGRESS", progress: 70, priority: "P1", ownerId: "pu_ada", ownerName: "Adaeze Okonjo",
    startDate: "2026-07-15", targetDate: "2026-11-30", releaseId: "release-2026-q4", visibility: "PUBLIC", publicationStatus: "PUBLISHED", health: "ON_TRACK",
    internalNotes: "Backend revenue-cycle service remains behind the local adapter until authenticated APIs are ready.",
    publicContent: { title: "Encounter-Based Billing", summary: "A redesigned revenue workflow connecting clinical services, patient accounts, invoices and payments.", timeframeMode: "QUARTER", timeframeLabel: "Q4 2026", showProgress: true },
  },
  {
    ...base, id: "roadmap-payment-history", parentId: "roadmap-encounter-billing", productId: "emr", moduleId: "emr.billing", type: "IMPROVEMENT",
    title: "Immutable Payment History", internalDescription: "Append-only patient payment and allocation history with auditable corrections.",
    status: "BETA", progress: 86, priority: "P1", ownerId: "pu_ada", ownerName: "Adaeze Okonjo",
    startDate: "2026-08-01", targetDate: "2026-10-15", releaseId: "release-2026-q4", visibility: "PUBLIC", publicationStatus: "PUBLISHED", health: "ON_TRACK",
    publicContent: { title: "Clear Payment History", summary: "A more reliable financial history for hospital billing teams and patient accounts.", timeframeMode: "QUARTER", timeframeLabel: "Q4 2026", showProgress: false },
  },
  {
    ...base, id: "roadmap-clinical-copilot", productId: "emr", moduleId: "emr.clinical", type: "INITIATIVE",
    title: "AI Clinical Copilot", internalDescription: "Governed assistance for consultation summaries and clinical documentation.",
    status: "RESEARCH", progress: 18, priority: "P2", ownerId: "pu_lara", ownerName: "Lara Bello",
    startDate: "2026-09-01", targetDate: "2027-03-31", visibility: "INTERNAL", publicationStatus: "DRAFT", health: "AT_RISK",
    riskReason: "Clinical safety evaluation and model governance are not complete.", mitigation: "Keep all outputs clinician-reviewed and complete the safety evidence pack.",
  },
  {
    ...base, id: "roadmap-lab-turnaround", productId: "emr", moduleId: "emr.laboratory", type: "IMPROVEMENT",
    title: "Laboratory Turnaround Intelligence", internalDescription: "Operational signals for collection, processing and approval turnaround.",
    status: "PLANNED", progress: 10, priority: "P2", ownerId: "pu_lara", ownerName: "Lara Bello",
    startDate: "2026-10-01", targetDate: "2027-01-31", visibility: "PUBLIC", publicationStatus: "READY_FOR_REVIEW", health: "ON_TRACK",
    publicContent: { title: "Laboratory Turnaround Insights", summary: "Better visibility into specimen progress and result turnaround for care teams.", timeframeMode: "QUARTER", timeframeLabel: "Q1 2027", showProgress: false },
  },
  {
    ...base, id: "roadmap-accounting-events", productId: "accounting", moduleId: "accounting.integrations", type: "INTEGRATION",
    title: "Clinical Accounting Event Engine", internalDescription: "Idempotent revenue and payment events from Sabi EMR into Sabi Accounting.",
    status: "IN_PROGRESS", progress: 52, priority: "P1", ownerId: "pu_olamide", ownerName: "Olamide Yusuf",
    startDate: "2026-08-10", targetDate: "2026-12-20", visibility: "INTERNAL", publicationStatus: "DRAFT", health: "BLOCKED",
    riskReason: "Authenticated backend event transport is still under development.", mitigation: "Continue contract-first implementation against the local runtime adapter.",
  },
  {
    ...base, id: "roadmap-workforce-scheduling", productId: "workforce", moduleId: "workforce.time", type: "FEATURE",
    title: "Shift Coverage Planning", internalDescription: "Coverage indicators and approval-aware roster planning.",
    status: "RELEASED", progress: 100, priority: "P2", ownerId: "pu_lara", ownerName: "Lara Bello",
    startDate: "2026-05-01", targetDate: "2026-08-30", actualReleaseDate: "2026-08-28", releaseId: "release-workforce-2026-08", visibility: "PUBLIC", publicationStatus: "PUBLISHED", health: "ON_TRACK",
    publicContent: { title: "Shift Coverage Planning", summary: "Improved roster planning and staffing coverage visibility for healthcare teams.", timeframeMode: "MONTH", timeframeLabel: "August 2026", showProgress: false, releaseNotes: "Coverage indicators and clearer shift planning are now available." },
  },
];

export const seedRoadmapReleases: RoadmapRelease[] = [
  { id: "release-2026-q4", organizationId: "org-sabi", productId: "emr", version: "2026.Q4", name: "Sabi EMR Q4 2026", description: "Revenue-cycle and operational workflow improvements.", targetDate: "2026-12-15", status: "IN_PROGRESS", publicName: "Sabi EMR Q4 Update", publicSummary: "Billing and operational improvements for connected hospital workflows.", createdAt, updatedAt: createdAt, createdBy: "pu_ada", updatedBy: "pu_ada" },
  { id: "release-workforce-2026-08", organizationId: "org-sabi", productId: "workforce", version: "2026.8", name: "Sabi Workforce August 2026", description: "Workforce scheduling and coverage improvements.", targetDate: "2026-08-30", actualReleaseDate: "2026-08-28", status: "SHIPPED", releaseNotes: "Shift coverage planning released.", publicName: "Sabi Workforce August Update", publicSummary: "Improved roster and staffing visibility.", publicReleaseNotes: "Coverage indicators and clearer shift planning are now available.", createdAt, updatedAt: "2026-08-28T12:00:00.000Z", createdBy: "pu_lara", updatedBy: "pu_lara" },
];

export const seedRoadmapActivities: RoadmapActivity[] = seedRoadmapItems.map((item) => ({
  id: `activity-${item.id}`, organizationId: item.organizationId, itemId: item.id, actorId: item.createdBy,
  actorName: item.ownerName ?? "Sabi Product Team", action: "CREATED", detail: `${item.title} added to the roadmap`, createdAt,
}));

export const seedRoadmapAudit: RoadmapAuditRecord[] = [];
