import { create } from "zustand";
import * as seed from "@/data/branchTransfers";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { ACCOUNTS } from "@/data/accounts";
import type { BranchTransfer } from "@/data/branchTransfers";

const rid = () => Math.random().toString(36).slice(2, 9);
const HR_ADMIN = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator")?.id ?? "s1";

type BranchTransfersState = {
  transfers: BranchTransfer[];

  propose: (input: { employeeId: string; toCompanyId: string; effectiveDate: string; reason: string; requestedBy: string }) => string;
  applyTransfer: (id: string) => void;
  resubmit: (id: string, requestedBy: string) => void;
  setSuccessor: (id: string, successorId: string | undefined, notes: string) => void;
  completeHandover: (id: string) => void;

  transfersFor: (employeeId: string) => BranchTransfer[];
};

function subjectLabel(employeeId: string, toCompanyId: string) {
  const emp = useHr.getState().byId(employeeId);
  const company = useOrg.getState().companies.find((c) => c.id === toCompanyId);
  return `Transfer ${emp?.name ?? "employee"} to ${company?.name ?? "another branch"}`;
}

/** context bag the "transfer" workflow expects */
function transferContext(employeeId: string, requestedBy: string) {
  const profile = useEmployees.getState().profileFor(employeeId);
  const dept = useOrg.getState().deptById(profile?.departmentId);
  return {
    initiatorId: requestedBy,
    departmentId: profile?.departmentId,
    lineManagerId: profile?.reportingManagerId,
    hodId: dept?.hodId,
    deputyHodId: dept?.deputyHodId,
    "roleHolder:HR Administrator": HR_ADMIN,
  };
}

export const useBranchTransfers = create<BranchTransfersState>((set, get) => ({
  transfers: seed.branchTransfers,

  propose: (input) => {
    const profile = useEmployees.getState().profileFor(input.employeeId);
    const id = rid();
    audit("proposed branch transfer", `hr/transfer/${input.employeeId}`);
    set((s) => ({
      transfers: [
        {
          id,
          employeeId: input.employeeId,
          fromCompanyId: profile?.companyId,
          toCompanyId: input.toCompanyId,
          effectiveDate: input.effectiveDate,
          reason: input.reason,
          status: "Proposed",
          createdAt: new Date().toISOString(),
          handoverStatus: "Not started",
        },
        ...s.transfers,
      ],
    }));
    useWorkflow.getState().start({
      triggerType: "transfer",
      subject: subjectLabel(input.employeeId, input.toCompanyId),
      reference: id,
      context: transferContext(input.employeeId, input.requestedBy),
    });
    return id;
  },

  resubmit: (id, requestedBy) => {
    const t = get().transfers.find((x) => x.id === id);
    if (!t || t.status !== "Proposed") return;
    audit("resubmitted branch transfer for approval", `hr/transfer/${t.employeeId}`);
    useWorkflow.getState().start({
      triggerType: "transfer",
      subject: subjectLabel(t.employeeId, t.toCompanyId),
      reference: id,
      context: transferContext(t.employeeId, requestedBy),
    });
  },

  applyTransfer: (id) => {
    const t = get().transfers.find((x) => x.id === id);
    if (!t || t.status !== "Proposed") return;
    if (!useWorkflow.getState().isApproved(id)) return;
    audit("applied branch transfer", `hr/transfer/${t.employeeId}`);
    useEmployees.getState().upsertProfile(t.employeeId, { companyId: t.toCompanyId });
    set((s) => ({
      transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: "Effective", appliedAt: new Date().toISOString() } : x)),
    }));
  },

  setSuccessor: (id, successorId, notes) => {
    audit("recorded handover plan", `hr/transfer/${id}`);
    set((s) => ({
      transfers: s.transfers.map((x) => (x.id === id ? { ...x, successorId, handoverNotes: notes, handoverStatus: "In progress" } : x)),
    }));
  },

  completeHandover: (id) => {
    audit("completed handover", `hr/transfer/${id}`);
    set((s) => ({
      transfers: s.transfers.map((x) => (x.id === id ? { ...x, handoverStatus: "Complete", handoverCompletedAt: new Date().toISOString() } : x)),
    }));
  },

  transfersFor: (employeeId) => get().transfers.filter((t) => t.employeeId === employeeId),
}));
