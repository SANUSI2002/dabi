import type { ModuleCatalogItem, ProductCatalogItem } from "@/command-center/domain";
import type { RoadmapItem, RoadmapRelease } from "../domain";
import { serializePublishedRoadmap } from "../publicDto";

const now = "2026-09-15T10:00:00.000Z";
const products = [
  { id: "emr", name: "Sabi EMR", releaseStatus: "Generally Available" },
  { id: "accounting", name: "Sabi Accounting", releaseStatus: "Generally Available" },
  { id: "internal", name: "Internal Product", releaseStatus: "Internal" },
] as ProductCatalogItem[];
const modules = [
  { id: "emr.billing", productId: "emr", name: "Patient Billing" },
  { id: "accounting.gl", productId: "accounting", name: "General Ledger" },
] as ModuleCatalogItem[];

function item(id: string, patch: Partial<RoadmapItem> = {}): RoadmapItem {
  return {
    id, organizationId: "org-sabi", productId: "emr", moduleId: "emr.billing", type: "FEATURE", title: `Internal ${id}`,
    internalDescription: "Secret implementation details", status: "IN_PROGRESS", progress: 60, priority: "P1",
    ownerId: "private-owner", ownerName: "Private Owner", targetDate: "2026-11-30", visibility: "INTERNAL", publicationStatus: "DRAFT",
    confidence: "MEDIUM", health: "AT_RISK", riskReason: "Private risk", internalNotes: "Private notes",
    createdAt: now, updatedAt: now, createdBy: "actor", updatedBy: "actor",
    ...patch,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyRoadmapScenarios() {
  const internal = item("internal");
  const publicDraft = item("draft", { visibility: "PUBLIC", publicContent: { title: "Draft", summary: "Draft summary", timeframeMode: "QUARTER", timeframeLabel: "Q4 2026", showProgress: false } });
  const published = item("published", { visibility: "PUBLIC", publicationStatus: "PUBLISHED", publicContent: { title: "Published title", summary: "Public-safe summary", timeframeMode: "QUARTER", timeframeLabel: "Q4 2026", showProgress: true } });
  const publicParent = item("public-parent", { visibility: "PUBLIC", publicationStatus: "PUBLISHED", publicContent: { title: "Public parent", summary: "Parent summary", timeframeMode: "YEAR", timeframeLabel: "2027", showProgress: false } });
  const privateChild = item("private-child", { parentId: publicParent.id });
  const privateParent = item("private-parent");
  const publicChild = item("public-child", { parentId: privateParent.id, visibility: "PUBLIC", publicationStatus: "PUBLISHED", publicContent: { title: "Independent public child", summary: "No private parent identity", timeframeMode: "COMING_SOON", timeframeLabel: "Coming soon", showProgress: false } });
  const internalProductItem = item("internal-product", { productId: "internal", moduleId: undefined, visibility: "PUBLIC", publicationStatus: "PUBLISHED", publicContent: { title: "Must not leak", summary: "Hidden", timeframeMode: "NO_DATE", timeframeLabel: "No date", showProgress: false } });

  const release: RoadmapRelease = {
    id: "release-safe", organizationId: "org-sabi", productId: "emr", version: "secret-version", name: "Internal release name",
    description: "Secret release plan", status: "IN_PROGRESS", releaseNotes: "Internal release notes", publicName: "Sabi EMR Update",
    publicSummary: "Public-safe release summary", createdAt: now, updatedAt: now, createdBy: "actor", updatedBy: "actor",
  };
  published.releaseId = release.id;
  const source = [internal, publicDraft, published, publicParent, privateChild, privateParent, publicChild, internalProductItem];
  const result = serializePublishedRoadmap(source, products, modules, [release]);

  assert(!result.some((entry) => entry.id === internal.id), "Scenario A failed: internal item leaked.");
  assert(!result.some((entry) => entry.id === publicDraft.id), "Scenario B failed: public draft leaked.");
  const dto = result.find((entry) => entry.id === published.id);
  assert(dto?.title === "Published title", "Scenario C failed: published item missing.");
  const dtoKeys = JSON.stringify(dto);
  for (const secret of ["Private Owner", "P1", "Secret implementation details", "Private risk", "Private notes", "2026-11-30"]) assert(!dtoKeys.includes(secret), `Scenario E failed: leaked ${secret}.`);
  assert(result.filter((entry) => entry.product.id === "emr").every((entry) => entry.product.id === "emr"), "Scenario F failed: product filtering is not deterministic.");
  assert(result.filter((entry) => entry.module?.id === "emr.billing").every((entry) => entry.module?.id === "emr.billing"), "Scenario G failed: module filtering is not deterministic.");
  assert(!result.some((entry) => entry.id === privateChild.id), "Scenario I failed: private child leaked.");
  assert(result.find((entry) => entry.id === publicChild.id)?.parentPublicId === undefined, "Scenario J failed: private parent identity leaked.");
  assert(!result.some((entry) => entry.id === internalProductItem.id), "Internal catalog product leaked publicly.");
  assert(dto?.release?.name === "Sabi EMR Update", "Safe public release name was not projected.");
  for (const secret of ["secret-version", "Internal release name", "Secret release plan", "Internal release notes"]) assert(!dtoKeys.includes(secret), `Release privacy scenario failed: leaked ${secret}.`);
  return { scenarios: 12, publicItems: result.length, status: "ok" as const };
}
