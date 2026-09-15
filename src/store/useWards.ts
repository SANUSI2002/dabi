import { create } from "zustand";
import * as seed from "@/data/wards";
import { audit } from "@/store/useAudit";
import type { Ward, Bed } from "@/data/wards";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);

type WardsState = {
  wards: Ward[];
  beds: Bed[];

  addWard: (name: string, type: string) => void;
  updateWard: (id: string, patch: Partial<Omit<Ward, "id">>) => void;
  bedsFor: (wardId: string) => Bed[];
  addBed: (wardId: string, label: string) => void;
  setBedVip: (bedId: string, isVip: boolean) => void;
  setBedActive: (bedId: string, active: boolean) => void;
};

export const useWards = create<WardsState>(persisted<WardsState>("wards", (set, get) => ({
  wards: seed.wards,
  beds: seed.beds,

  addWard: (name, type) => {
    audit("added ward", `wards/${name}`);
    set((s) => ({ wards: [...s.wards, { id: rid(), name, type }] }));
  },

  updateWard: (id, patch) => {
    const w = get().wards.find((x) => x.id === id);
    audit("updated ward", `wards/${w?.name ?? id}`);
    set((s) => ({ wards: s.wards.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },

  bedsFor: (wardId) => get().beds.filter((b) => b.wardId === wardId),

  addBed: (wardId, label) => {
    const w = get().wards.find((x) => x.id === wardId);
    audit("added bed", `wards/${w?.name ?? wardId}/${label}`);
    set((s) => ({ beds: [...s.beds, { id: rid(), wardId, label, isVip: false, active: true }] }));
  },

  setBedVip: (bedId, isVip) => {
    audit(isVip ? "marked bed VIP" : "unmarked bed VIP", `wards/bed/${bedId}`);
    set((s) => ({ beds: s.beds.map((b) => (b.id === bedId ? { ...b, isVip } : b)) }));
  },

  setBedActive: (bedId, active) => {
    audit(active ? "reactivated bed" : "retired bed", `wards/bed/${bedId}`);
    set((s) => ({ beds: s.beds.map((b) => (b.id === bedId ? { ...b, active } : b)) }));
  },
})));
