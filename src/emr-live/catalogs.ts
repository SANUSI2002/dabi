import { useEffect } from "react";
import { create } from "zustand";
import { DIAGNOSES, PATIENT_CATEGORIES, type Diagnosis, type PatientCategory } from "@/data/catalog";
import { emrRequest } from "./client";
import { useIsLiveEmr } from "./session";

// The hospital's own diagnosis list and patient categories (managed in Settings) for the screens that
// pick from them: Consultation's diagnosis search, Registration's category, the patient banner and
// printouts. The demo keeps the built-in lists.

type ApiDiagnosis = { code: string; name: string; chapter: string; ncd: boolean; notifiable: boolean };
type ApiCategory = { code: string; name: string; exempt: boolean; reason: string | null; active: boolean };

type CatalogState = {
  diagnoses: Diagnosis[] | null;
  categories: PatientCategory[] | null;
  loadDiagnoses: () => Promise<void>;
  loadCategories: () => Promise<void>;
};

export const useLiveCatalogs = create<CatalogState>((set) => ({
  diagnoses: null,
  categories: null,
  loadDiagnoses: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiDiagnosis[] } }>("/catalogs/diagnoses");
      set({ diagnoses: result.data.items.map((d) => ({ code: d.code, name: d.name, chapter: d.chapter, ncd: d.ncd, notifiable: d.notifiable })) });
    } catch {
      set({ diagnoses: null }); // fall back to the built-in list rather than an empty search
    }
  },
  loadCategories: async () => {
    try {
      // Inactive categories still label patients registered under them, so they are kept here.
      const result = await emrRequest<{ data: { items: ApiCategory[] } }>("/catalogs/categories?includeInactive=true");
      set({ categories: result.data.items.map((c) => ({ code: c.code, name: c.name, exempt: c.exempt, reason: c.reason ?? "—", active: c.active })) });
    } catch {
      set({ categories: null });
    }
  },
}));

/** Live hospital → its diagnosis list (once loaded); otherwise the built-in ICD-11 list. */
export function useDiagnosisCatalog(): Diagnosis[] {
  const live = useIsLiveEmr();
  const diagnoses = useLiveCatalogs((s) => s.diagnoses);
  useEffect(() => { if (live) void useLiveCatalogs.getState().loadDiagnoses(); }, [live]);
  return live && diagnoses ? diagnoses : DIAGNOSES;
}

/** Live hospital → its patient categories (once loaded); otherwise the built-in categories. */
export function usePatientCategories(): PatientCategory[] {
  const live = useIsLiveEmr();
  const categories = useLiveCatalogs((s) => s.categories);
  useEffect(() => { if (live && !useLiveCatalogs.getState().categories) void useLiveCatalogs.getState().loadCategories(); }, [live]);
  return live && categories ? categories : PATIENT_CATEGORIES;
}
