import type { RoadmapPublicDTO } from "./domain";

// Safe-by-construction local projection used while the public backend is unavailable.
// This file intentionally contains no internal roadmap model or engineering metadata.
export const seedPublicRoadmap: RoadmapPublicDTO[] = [
  {
    id: "roadmap-encounter-billing", product: { id: "emr", name: "Sabi EMR" }, module: { id: "emr.billing", name: "Patient Billing" },
    type: "INITIATIVE", title: "Encounter-Based Billing", summary: "A redesigned revenue workflow connecting clinical services, patient accounts, invoices and payments.",
    status: "In Progress", timeframe: "Q4 2026", progress: 70, release: { id: "release-2026-q4", name: "Sabi EMR Q4 Update" },
  },
  {
    id: "roadmap-payment-history", parentPublicId: "roadmap-encounter-billing", product: { id: "emr", name: "Sabi EMR" }, module: { id: "emr.billing", name: "Patient Billing" },
    type: "IMPROVEMENT", title: "Clear Payment History", summary: "A more reliable financial history for hospital billing teams and patient accounts.",
    status: "Beta", timeframe: "Q4 2026", release: { id: "release-2026-q4", name: "Sabi EMR Q4 Update" },
  },
  {
    id: "roadmap-workforce-scheduling", product: { id: "workforce", name: "Sabi Workforce" }, module: { id: "workforce.time", name: "Time & Attendance" },
    type: "FEATURE", title: "Shift Coverage Planning", summary: "Improved roster planning and staffing coverage visibility for healthcare teams.",
    status: "Released", timeframe: "August 2026", releaseNotes: "Coverage indicators and clearer shift planning are now available.", release: { id: "release-workforce-2026-08", name: "Sabi Workforce August Update" },
  },
];
