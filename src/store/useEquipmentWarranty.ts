import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { WarrantyInfo, WarrantyClaim, WarrantyClaimStatus } from "@/data/equipmentWarranty";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);

type WarrantyInput = { provider: string; start: string; end: string; coverage: string; contactName?: string; contactPhone?: string; slaHours?: number };

type EquipmentWarrantyState = {
  warranties: WarrantyInfo[];
  claims: WarrantyClaim[];

  setWarranty: (equipmentId: string, input: WarrantyInput) => void;
  warrantyFor: (equipmentId: string) => WarrantyInfo | undefined;

  fileClaim: (equipmentId: string, issue: string, relatedWorkOrderId?: string) => WarrantyClaim;
  updateClaimStatus: (id: string, status: WarrantyClaimStatus, opts?: { repairedUnderWarranty?: boolean; costRecovered?: number; resolutionNote?: string }) => void;
  claimsFor: (equipmentId: string) => WarrantyClaim[];
};

export const useEquipmentWarranty = create<EquipmentWarrantyState>(persisted<EquipmentWarrantyState>("equipment-warranty", (set, get) => ({
  warranties: [],
  claims: [],

  setWarranty: (equipmentId, input) => {
    const who = useIdentity.getState().user.name;
    const info: WarrantyInfo = { equipmentId, ...input, updatedAt: new Date().toISOString(), updatedBy: who };
    audit("updated equipment warranty", `equipment-scada/warranty/${equipmentId}`, { user: who, meta: { provider: input.provider } });
    set((s) => ({ warranties: [info, ...s.warranties.filter((w) => w.equipmentId !== equipmentId)] }));
  },

  warrantyFor: (equipmentId) => get().warranties.find((w) => w.equipmentId === equipmentId),

  fileClaim: (equipmentId, issue, relatedWorkOrderId) => {
    const who = useIdentity.getState().user.name;
    const claim: WarrantyClaim = {
      id: rid(),
      equipmentId,
      issue,
      status: "Submitted",
      raisedAt: new Date().toISOString(),
      raisedBy: who,
      relatedWorkOrderId,
    };
    audit("filed equipment warranty claim", `equipment-scada/warranty-claim/${equipmentId}`, { user: who, meta: { issue } });
    set((s) => ({ claims: [claim, ...s.claims] }));
    return claim;
  },

  updateClaimStatus: (id, status, opts) => {
    const who = useIdentity.getState().user.name;
    audit("updated equipment warranty claim", `equipment-scada/warranty-claim/${id}`, { user: who, meta: { status, ...opts } });
    set((s) => ({
      claims: s.claims.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              repairedUnderWarranty: opts?.repairedUnderWarranty ?? c.repairedUnderWarranty,
              costRecovered: opts?.costRecovered ?? c.costRecovered,
              resolutionNote: opts?.resolutionNote ?? c.resolutionNote,
              resolvedAt: status === "Completed" || status === "Rejected" ? new Date().toISOString() : c.resolvedAt,
            }
          : c,
      ),
    }));
  },

  claimsFor: (equipmentId) => get().claims.filter((c) => c.equipmentId === equipmentId),
})));
