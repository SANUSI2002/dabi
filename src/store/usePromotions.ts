import { create } from "zustand";
import * as seed from "@/data/promotions";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { ACCOUNTS } from "@/data/accounts";
import type { Promotion } from "@/data/promotions";

const rid = () => Math.random().toString(36).slice(2, 9);
const HR_ADMIN = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator")?.id ?? "s1";
const FINANCE_CONTROLLER = ACCOUNTS.find((a) => a.systemRole === "System Administrator")?.id ?? "s1";

/** builds the context bag the "promotion" workflow expects */
function promotionContext(employeeId: string, requestedBy: string, newSalary: number) {
  const profile = useEmployees.getState().profileFor(employeeId);
  const dept = useOrg.getState().deptById(profile?.departmentId);
  return {
    initiatorId: requestedBy,
    departmentId: profile?.departmentId,
    hodId: dept?.hodId,
    deputyHodId: dept?.deputyHodId,
    lineManagerId: profile?.reportingManagerId,
    newSalary,
    "roleHolder:HR Administrator": HR_ADMIN,
    "roleHolder:Finance Controller": FINANCE_CONTROLLER,
  };
}

type PromotionsState = {
  promotions: Promotion[];

  propose: (input: {
    employeeId: string;
    toJobPositionId?: string;
    toJobRoleId?: string;
    toCadre?: string;
    newSalary?: number;
    effectiveDate: string;
    reason: string;
    requestedBy: string;
  }) => string;
  applyPromotion: (id: string) => void;
  resubmit: (id: string, requestedBy: string) => void;
  setSuccessor: (id: string, successorId: string | undefined, notes: string) => void;
  completeHandover: (id: string) => void;

  promotionsFor: (employeeId: string) => Promotion[];
};

export const usePromotions = create<PromotionsState>((set, get) => ({
  promotions: seed.promotions,

  propose: (input) => {
    const emp = useHr.getState().byId(input.employeeId);
    const profile = useEmployees.getState().profileFor(input.employeeId);
    const id = rid();
    audit("proposed promotion", `hr/promotion/${emp?.name ?? input.employeeId}`, { user: useHr.getState().byId(input.requestedBy)?.name });
    set((s) => ({
      promotions: [
        {
          id,
          employeeId: input.employeeId,
          fromJobPositionId: profile?.jobPositionId,
          fromJobRoleId: profile?.jobRoleId,
          fromCadre: emp?.cadre,
          toJobPositionId: input.toJobPositionId,
          toJobRoleId: input.toJobRoleId,
          toCadre: input.toCadre,
          effectiveDate: input.effectiveDate,
          reason: input.reason,
          status: "Proposed",
          createdAt: new Date().toISOString(),
          handoverStatus: "Not started",
        },
        ...s.promotions,
      ],
    }));
    const toTitle = input.toJobPositionId ? useOrg.getState().jobPositionName(input.toJobPositionId) : input.toCadre ?? "new role";
    useWorkflow.getState().start({
      triggerType: "promotion",
      subject: `Promote ${emp?.name ?? "employee"} to ${toTitle}`,
      reference: id,
      context: promotionContext(input.employeeId, input.requestedBy, input.newSalary ?? 0),
    });
    return id;
  },

  resubmit: (id, requestedBy) => {
    const p = get().promotions.find((x) => x.id === id);
    if (!p || p.status !== "Proposed") return;
    const emp = useHr.getState().byId(p.employeeId);
    const toTitle = p.toJobPositionId ? useOrg.getState().jobPositionName(p.toJobPositionId) : p.toCadre ?? "new role";
    audit("resubmitted promotion for approval", `hr/promotion/${emp?.name ?? p.employeeId}`);
    useWorkflow.getState().start({
      triggerType: "promotion",
      subject: `Promote ${emp?.name ?? "employee"} to ${toTitle}`,
      reference: id,
      context: promotionContext(p.employeeId, requestedBy, 0),
    });
  },

  applyPromotion: (id) => {
    const p = get().promotions.find((x) => x.id === id);
    if (!p || p.status !== "Proposed") return;
    if (!useWorkflow.getState().isApproved(id)) return;
    audit("applied promotion", `hr/promotion/${p.employeeId}`);
    if (p.toJobPositionId || p.toJobRoleId) {
      useEmployees.getState().upsertProfile(p.employeeId, {
        ...(p.toJobPositionId ? { jobPositionId: p.toJobPositionId } : {}),
        ...(p.toJobRoleId ? { jobRoleId: p.toJobRoleId } : {}),
      });
    }
    if (p.toCadre) useHr.getState().updateStaff(p.employeeId, { cadre: p.toCadre });
    set((s) => ({
      promotions: s.promotions.map((x) => (x.id === id ? { ...x, status: "Effective", appliedAt: new Date().toISOString() } : x)),
    }));
  },

  setSuccessor: (id, successorId, notes) => {
    audit("recorded handover plan", `hr/promotion/${id}`);
    set((s) => ({
      promotions: s.promotions.map((x) => (x.id === id ? { ...x, successorId, handoverNotes: notes, handoverStatus: "In progress" } : x)),
    }));
  },

  completeHandover: (id) => {
    audit("completed handover", `hr/promotion/${id}`);
    set((s) => ({
      promotions: s.promotions.map((x) => (x.id === id ? { ...x, handoverStatus: "Complete", handoverCompletedAt: new Date().toISOString() } : x)),
    }));
  },

  promotionsFor: (employeeId) => get().promotions.filter((p) => p.employeeId === employeeId),
}));
