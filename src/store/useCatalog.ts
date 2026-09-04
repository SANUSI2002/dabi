import { create } from "zustand";
import {
  SERVICE_TYPES, PATIENT_CATEGORIES, LAB_TESTS, DIAGNOSES, VACCINES, NOTIFIABLE,
  type ServiceType, type PatientCategory, type LabTest, type Diagnosis, type Vaccine, type NotifiableDisease,
} from "@/data/catalog";
import { drugs as seedDrugs } from "@/data/mock";
import type { DrugStock, StaffMember } from "@/data/types";
import { staff as seedStaff } from "@/data/mock";
import { audit } from "@/store/useAudit";

const rid = () => Math.random().toString(36).slice(2, 9);

/** every catalog row carries an `active` flag for the Deactivate action */
type Active = { active?: boolean };

export type CatalogKey =
  | "drugs" | "labTests" | "diagnoses" | "vaccines" | "notifiable"
  | "services" | "categories" | "users";

type CatalogState = {
  drugs: (DrugStock & Active)[];
  labTests: (LabTest & { id: string } & Active)[];
  diagnoses: (Diagnosis & Active)[];
  vaccines: (Vaccine & Active)[];
  notifiable: (NotifiableDisease & Active)[];
  services: (ServiceType & Active)[];
  categories: (PatientCategory & Active)[];
  users: (StaffMember & { username: string })[];
  add: (k: CatalogKey, row: Record<string, unknown>) => void;
  update: (k: CatalogKey, id: string, patch: Record<string, unknown>) => void;
  toggle: (k: CatalogKey, id: string) => void;
  adjustStock: (drugName: string, delta: number) => void;
};

const withActive = <T extends object>(rows: T[]) => rows.map((r) => ({ active: true, ...r }));
const withId = <T extends object>(rows: T[]) => rows.map((r) => ({ id: rid(), ...r }));

export const useCatalog = create<CatalogState>((set) => ({
  drugs: withActive(seedDrugs),
  labTests: withActive(withId(LAB_TESTS)),
  diagnoses: withActive(DIAGNOSES),
  vaccines: withActive(VACCINES),
  notifiable: withActive(NOTIFIABLE),
  services: withActive(SERVICE_TYPES),
  categories: withActive(PATIENT_CATEGORIES),
  users: seedStaff.map((s) => ({
    ...s,
    username: s.name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).slice(-2).join("."),
  })),

  add: (k, row) => {
    audit("added catalog record", `settings/${k}`);
    set((s) => {
      const list = s[k] as Record<string, unknown>[];
      const id = (row.id as string) || (row.code as string) || rid();
      return { [k]: [{ active: true, ...row, id }, ...list] } as Partial<CatalogState>;
    });
  },

  update: (k, id, patch) => {
    audit("edited catalog record", `settings/${k}/${id}`);
    set((s) => {
      const list = s[k] as (Record<string, unknown> & { id?: string; code?: string })[];
      return {
        [k]: list.map((r) => ((r.id ?? r.code) === id ? { ...r, ...patch } : r)),
      } as Partial<CatalogState>;
    });
  },

  toggle: (k, id) => {
    audit("toggled catalog record", `settings/${k}/${id}`);
    set((s) => {
      const list = s[k] as (Record<string, unknown> & { id?: string; code?: string; active?: boolean })[];
      return {
        [k]: list.map((r) => ((r.id ?? r.code) === id ? { ...r, active: !r.active } : r)),
      } as Partial<CatalogState>;
    });
  },

  adjustStock: (drugName, delta) =>
    set((s) => {
      const q = drugName.toLowerCase();
      const match = s.drugs.find((d) => q.includes(d.name.toLowerCase()));
      if (!match) return {};
      return {
        drugs: s.drugs.map((d) => (d.id === match.id ? { ...d, stock: Math.max(0, d.stock + delta) } : d)),
      };
    }),
}));
