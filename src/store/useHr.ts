import { create } from "zustand";
import { staff as seed } from "@/data/mock";
import { audit } from "@/store/useAudit";
import type { StaffMember } from "@/data/types";

const rid = () => Math.random().toString(36).slice(2, 9);
const username = (name: string) =>
  name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).slice(-2).join(".");

const CLINICAL = ["Medical Officer", "Nurse", "Community Health Worker", "Lab Technician", "Pharmacy Technician"];

type HrState = {
  staff: (StaffMember & { username: string })[];
  addStaff: (s: Omit<StaffMember, "id" | "status">) => void;
  setStatus: (id: string, status: StaffMember["status"]) => void;
  updateStaff: (id: string, patch: Partial<Pick<StaffMember, "role" | "cadre">>) => void;
  byId: (id?: string | null) => (StaffMember & { username: string }) | undefined;
  clinicians: () => (StaffMember & { username: string })[];
  labTechs: () => (StaffMember & { username: string })[];
};

export const useHr = create<HrState>((set, get) => ({
  staff: seed.map((s) => ({ ...s, username: username(s.name) })),

  addStaff: (s) => {
    audit("added staff", `hris/${username(s.name)}`);
    set((st) => ({
      staff: [{ ...s, id: rid(), status: "Active", username: username(s.name) }, ...st.staff],
    }));
  },

  setStatus: (id, status) => {
    audit("updated staff status", `hris/${id}`);
    set((st) => ({ staff: st.staff.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },

  updateStaff: (id, patch) => {
    audit("updated staff record", `hris/${id}`);
    set((st) => ({ staff: st.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },

  byId: (id) => (id ? get().staff.find((s) => s.id === id) : undefined),
  clinicians: () => get().staff.filter((s) => s.status === "Active" && CLINICAL.includes(s.role)),
  labTechs: () => get().staff.filter((s) => s.status === "Active" && s.role === "Lab Technician"),
}));

export const providerNames = () => useHr.getState().clinicians().map((s) => s.name);
