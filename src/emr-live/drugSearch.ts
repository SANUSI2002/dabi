import { useEffect, useState } from "react";
import { describeEmrError, emrRequest } from "./client";
import type { FormularyProduct } from "./consultation";

// Drug search for a live hospital's prescribers (GET /pharmacy/drug-search): its own formulary, with
// stock, and/or the EMDEX national drug index — whichever the prescriber chose — by name and/or drug
// category, searched on the server (the EMDEX token never reaches the browser). Picking an EMDEX product
// asks the server for its formulary code — the hospital's own item if it has one, otherwise a new,
// not-stocked formulary item made from the EMDEX record — so every prescription still goes through
// pharmacy review.

export type ReferenceProduct = {
  kind: "brand" | "generic"; referenceId: string; genericName: string; brandName: string | null; form: string | null; strength: string | null;
  manufacturer: string | null; formularyCode: string | null;
  /** within a category: whether EMDEX gave a class to check the product against it */
  categoryChecked?: boolean;
};
export type ReferenceStatus = "ok" | "not_configured" | "unavailable" | "needs_name";
export type DrugSource = "formulary" | "emdex";
export type DrugSearch = { formulary: FormularyProduct[]; reference: ReferenceProduct[]; referenceStatus: ReferenceStatus };

const NONE: DrugSearch = { formulary: [], reference: [], referenceStatus: "ok" };

export function useLiveDrugSearch(query: string, enabled: boolean, { source = "formulary", category = "" }: { source?: DrugSource; category?: string } = {}): DrugSearch {
  const [result, setResult] = useState<DrugSearch>(NONE);
  useEffect(() => {
    if (!enabled) return;
    const q = query.trim().slice(0, 60);
    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ source, ...(q.length >= 2 ? { q } : {}), ...(category ? { category } : {}) });
      // a name (or a category) searches the chosen source; otherwise just list the formulary
      const request = q.length < 2 && !category
        ? source === "emdex"
          ? Promise.resolve({ ...NONE, referenceStatus: "needs_name" as const })
          : emrRequest<{ data: { items: FormularyProduct[] } }>(`/pharmacy/formulary${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => ({ ...NONE, formulary: r.data.items }))
        : emrRequest<{ data: DrugSearch }>(`/pharmacy/drug-search?${params}`).then((r) => r.data);
      request
        .then((data) => { if (active) setResult({ ...data, formulary: data.formulary.slice(0, category ? 12 : 6), reference: data.reference.filter((p) => !p.formularyCode).slice(0, 8) }); })
        .catch(() => { if (active) setResult({ ...NONE, referenceStatus: "unavailable" }); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, enabled, source, category]);
  return enabled ? result : NONE;
}

/** The formulary code a picked EMDEX product is prescribed under (added, not stocked, if new). */
export async function resolveReference(product: ReferenceProduct): Promise<{ code: string; doseUnit: string; created: boolean }> {
  try {
    const { data } = await emrRequest<{ data: { code: string; doseUnit: string; created: boolean } }>("/pharmacy/formulary/from-reference", { method: "POST", body: { kind: product.kind, id: product.referenceId } });
    return data;
  } catch (cause) {
    throw new Error(describeEmrError(cause));
  }
}

export const referenceLabel = (p: ReferenceProduct) => [p.brandName ?? p.genericName, p.strength, p.form].filter(Boolean).join(" ");
