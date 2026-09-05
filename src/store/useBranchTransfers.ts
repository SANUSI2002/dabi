import { create } from "zustand";
import * as seed from "@/data/branchTransfers";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useApprovals } from "@/store/useApprovals";
import { useOrg } from "@/store/useOrg";
import type { BranchTransfer } from "@/data/branchTransfers";

const rid = () => Math.random().toString(36).slice(2, 9);
const TRANSFER_APPROVAL_TYPE = "at6";

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
    useApprovals.getState().submitRequest(TRANSFER_APPROVAL_TYPE, {
      subjectLabel: subjectLabel(input.employeeId, input.toCompanyId),
      requestedBy: input.requestedBy,
      requestedFor: input.employeeId,
      reference: id,
    });
    return id;
  },

  resubmit: (id, requestedBy) => {
    const t = get().transfers.find((x) => x.id === id);
    if (!t || t.status !== "Proposed") return;
    audit("resubmitted branch transfer for approval", `hr/transfer/${t.employeeId}`);
    useApprovals.getState().submitRequest(TRANSFER_APPROVAL_TYPE, {
      subjectLabel: subjectLabel(t.employeeId, t.toCompanyId),
      requestedBy,
      requestedFor: t.employeeId,
      reference: id,
    });
  },

  applyTransfer: (id) => {
    const t = get().transfers.find((x) => x.id === id);
    if (!t || t.status !== "Proposed") return;
    if (!useApprovals.getState().isApproved(id)) return;
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
