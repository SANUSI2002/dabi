import { useMasterData, type MasterItem } from "@/platform/useMasterData";

// Options for a dropdown that the hospital configures under Settings → Master Data. An item's value is
// its code, or its name when it has none. A record that already holds a value no longer on the list (or
// switched off) keeps showing it, marked, so editing it never silently changes it.

const EMPTY: MasterItem[] = [];
export const listLink = (category: string) => `/settings/master-data?list=${category}`;
const valueOf = (i: MasterItem) => i.code || i.label;

/** The active items of a list as select options, plus `current` if it is not among them. */
export function useListOptions(category: string, current?: string | null) {
  const items = useMasterData((s) => s.data[category] ?? EMPTY);
  const options = items.filter((i) => i.active).map((i) => ({ value: valueOf(i), label: i.label }));
  if (current && !options.some((o) => o.value === current)) options.push({ value: current, label: `${items.find((i) => valueOf(i) === current)?.label ?? current} (no longer listed)` });
  return options;
}

/** The active values of a list (its codes, or names where items have none), plus `current` if it is not among them. */
export function useListValues(category: string, current?: string | null) {
  return useListOptions(category, current).map((o) => o.value);
}

/** An item's name from its value (code or name), for display. */
export function listLabel(category: string, value?: string | null) {
  if (!value) return "";
  const item = (useMasterData.getState().data[category] ?? EMPTY).find((i) => valueOf(i) === value || i.label === value);
  return item?.label ?? value;
}

/** An item's code from its name (lists whose server values are codes, e.g. appointment types). */
export function listCode(category: string, label: string) {
  const item = (useMasterData.getState().data[category] ?? EMPTY).find((i) => i.label === label || i.code === label);
  return item ? valueOf(item) : label;
}
