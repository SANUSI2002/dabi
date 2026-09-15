import type { ModuleCatalogItem, ProductCatalogItem } from "@/command-center/domain";
import type { RoadmapItem, RoadmapItemDraft } from "./domain";

export function validateRoadmapItem(
  item: RoadmapItemDraft,
  existing: RoadmapItem[],
  products: ProductCatalogItem[],
  modules: ModuleCatalogItem[],
  editingId?: string,
) {
  const errors: string[] = [];
  if (!item.title.trim()) errors.push("Internal title is required.");
  const product = products.find((entry) => entry.id === item.productId);
  if (!product) errors.push("Select a valid product from Product Catalog.");
  if (item.moduleId && !modules.some((entry) => entry.id === item.moduleId && entry.productId === item.productId)) errors.push("The selected module does not belong to this product.");
  if (item.startDate && item.targetDate && item.startDate > item.targetDate) errors.push("Start date must be before the target date.");
  if (item.progress < 0 || item.progress > 100) errors.push("Progress must be between 0 and 100.");
  if (item.parentId) {
    const parent = existing.find((entry) => entry.id === item.parentId);
    if (!parent || parent.productId !== item.productId || parent.moduleId !== item.moduleId) errors.push("Parent item must use the same product and module.");
    let cursor = parent;
    const visited = new Set([editingId]);
    while (cursor) {
      if (visited.has(cursor.id)) { errors.push("Roadmap hierarchy cannot contain a circular parent relationship."); break; }
      visited.add(cursor.id);
      cursor = cursor.parentId ? existing.find((entry) => entry.id === cursor!.parentId) : undefined;
    }
  }
  if (["READY_FOR_REVIEW", "APPROVED", "PUBLISHED"].includes(item.publicationStatus)) {
    if (item.visibility !== "PUBLIC") errors.push("Only public items can enter the publication workflow.");
    if (!item.publicContent?.title.trim() || !item.publicContent.summary.trim() || !item.publicContent.timeframeLabel.trim()) errors.push("Public title, summary and timeframe are required before review or publication.");
  }
  if (item.visibility === "PUBLIC" && product?.releaseStatus === "Internal") errors.push("An internal catalog product cannot be published.");
  return errors;
}
