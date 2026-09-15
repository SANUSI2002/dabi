import type { ModuleCatalogItem, ProductCatalogItem } from "@/command-center/domain";
import type { RoadmapItem, RoadmapPublicDTO, RoadmapRelease, RoadmapStatus } from "./domain";

const PUBLIC_STATUS: Record<RoadmapStatus, RoadmapPublicDTO["status"] | undefined> = {
  IDEA: "Exploring",
  RESEARCH: "Exploring",
  PLANNED: "Planned",
  DESIGN: "Planned",
  IN_PROGRESS: "In Progress",
  BETA: "Beta",
  RELEASE_CANDIDATE: "Beta",
  RELEASED: "Released",
  DELAYED: "Delayed",
  POSTPONED: "Postponed",
  CANCELLED: undefined,
};

export function toRoadmapPublicDTO(
  item: RoadmapItem,
  products: ProductCatalogItem[],
  modules: ModuleCatalogItem[],
  publishedIds: ReadonlySet<string>,
  releases: RoadmapRelease[] = [],
): RoadmapPublicDTO | undefined {
  if (item.visibility !== "PUBLIC" || item.publicationStatus !== "PUBLISHED" || !item.publicContent) return undefined;
  const product = products.find((entry) => entry.id === item.productId);
  const module = modules.find((entry) => entry.id === item.moduleId && entry.productId === item.productId);
  const status = PUBLIC_STATUS[item.status];
  if (!product || product.releaseStatus === "Internal" || !status) return undefined;
  const publicContent = item.publicContent;
  const release = releases.find((entry) => entry.id === item.releaseId);
  if (!publicContent.title.trim() || !publicContent.summary.trim() || !publicContent.timeframeLabel.trim()) return undefined;

  return {
    id: item.id,
    product: { id: product.id, name: product.name },
    ...(module ? { module: { id: module.id, name: module.name } } : {}),
    ...(item.parentId && publishedIds.has(item.parentId) ? { parentPublicId: item.parentId } : {}),
    type: item.type,
    title: publicContent.title,
    summary: publicContent.summary,
    status: publicContent.statusLabel?.trim() as RoadmapPublicDTO["status"] || status,
    timeframe: publicContent.timeframeLabel,
    ...(publicContent.showProgress ? { progress: item.progress } : {}),
    ...(item.status === "RELEASED" && publicContent.releaseNotes ? { releaseNotes: publicContent.releaseNotes } : {}),
    ...(release?.publicName ? { release: { id: release.id, name: release.publicName } } : {}),
  };
}

export function serializePublishedRoadmap(items: RoadmapItem[], products: ProductCatalogItem[], modules: ModuleCatalogItem[], releases: RoadmapRelease[] = []) {
  const publishedIds = new Set(items.filter((item) => item.visibility === "PUBLIC" && item.publicationStatus === "PUBLISHED").map((item) => item.id));
  return items.map((item) => toRoadmapPublicDTO(item, products, modules, publishedIds, releases)).filter((item): item is RoadmapPublicDTO => !!item);
}

export function previewRoadmapPublicDTO(item: RoadmapItem, products: ProductCatalogItem[], modules: ModuleCatalogItem[], releases: RoadmapRelease[] = []) {
  return toRoadmapPublicDTO({ ...item, visibility: "PUBLIC", publicationStatus: "PUBLISHED" }, products, modules, new Set(item.parentId ? [item.parentId] : []), releases);
}
