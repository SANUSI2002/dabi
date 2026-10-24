import { useMasterData, type MasterItem } from "@/platform/useMasterData";

// Drug categories (Antibiotics, Antihypertensives…) and drug classes (Penicillin, NSAID…) are the hospital's
// own lists, kept by the pharmacy under Settings → Master Data. A drug stores the item's code; older records
// may still hold a name, so lookups accept either.

const EMPTY: MasterItem[] = [];
export const DRUG_LISTS_LINK = { categories: "/settings/master-data?list=drug-categories", classes: "/settings/master-data?list=drug-classes" };

/** The active drug categories, as select options (value = code). */
export function useDrugCategories() {
  const items = useMasterData((s) => s.data["drug-categories"] ?? EMPTY);
  return items.filter((i) => i.active && i.code).map((i) => ({ value: i.code as string, label: i.label }));
}
/** The active drug classes (value = code). */
export function useDrugClasses() {
  const items = useMasterData((s) => s.data["drug-classes"] ?? EMPTY);
  return items.filter((i) => i.active && i.code).map((i) => ({ value: i.code as string, label: i.label }));
}

const find = (value: string) => (useMasterData.getState().data["drug-categories"] ?? EMPTY)
  .find((i) => i.code === value || i.label.toLowerCase() === value.toLowerCase());

/** A category's name, from its code (or the name itself on older records). */
export function drugCategoryLabel(value?: string | null) {
  if (!value) return "—";
  return find(value)?.label ?? value;
}

/** Whether a drug's category (a code, a name, or an older singular name such as "Antibiotic") is the chosen category. */
export function inDrugCategory(drugCategory: string | null | undefined, chosen: string) {
  if (!chosen) return true;
  if (!drugCategory) return false;
  if (drugCategory === chosen) return true;
  const item = find(chosen);
  if (!item) return false;
  const value = drugCategory.toLowerCase();
  const label = item.label.toLowerCase();
  return value === label || label.startsWith(value) || find(drugCategory)?.code === item.code;
}
