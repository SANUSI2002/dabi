import { create } from "zustand";
import * as seed from "@/data/approvals";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { ACCOUNTS } from "@/data/accounts";
import type { ApprovalType, ApprovalWorkflow, ApprovalRequest, ApprovalStepDef, ApproverType } from "@/data/approvals";

const rid = () => Math.random().toString(36).slice(2, 9);
const HR_ADMIN_ID = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator")?.id ?? "s1";
const who = (id?: string) => (id ? useHr.getState().byId(id)?.name ?? id : "—");

function resolveApprover(approverType: ApproverType, explicitId: string | undefined, requestedFor: string): string {
  if (approverType === "Specific Person") return explicitId ?? HR_ADMIN_ID;
  if (approverType === "HR Administrator") return HR_ADMIN_ID;
  // Line Manager
  const mgr = useEmployees.getState().profileFor(requestedFor)?.reportingManagerId;
  return mgr ?? HR_ADMIN_ID;
}

type ApprovalsState = {
  types: ApprovalType[];
  workflows: ApprovalWorkflow[];
  requests: ApprovalRequest[];

  addWorkflow: (name: string, steps: Omit<ApprovalStepDef, "id" | "order">[]) => string;
  addApprovalType: (t: { name: string; module: string; description: string; workflowId: string }) => void;

  submitRequest: (approvalTypeId: string, input: { subjectLabel: string; requestedBy: string; requestedFor?: string; reference?: string }) => string;
  decideStep: (requestId: string, decision: "Approved" | "Rejected", comment?: string) => void;

  requestFor: (reference: string) => ApprovalRequest | undefined;
  isApproved: (reference: string) => boolean;
  currentApprover: (r: ApprovalRequest) => string | undefined;
  pendingFor: (approverId: string) => ApprovalRequest[];
};

export const useApprovals = create<ApprovalsState>((set, get) => ({
  types: seed.approvalTypes,
  workflows: seed.workflows,
  requests: seed.requests,

  addWorkflow: (name, steps) => {
    const id = rid();
    audit("created approval workflow", `hr/approvals/workflow/${name}`);
    set((s) => ({
      workflows: [{ id, name, steps: steps.map((st, i) => ({ ...st, id: rid(), order: i + 1 })) }, ...s.workflows],
    }));
    return id;
  },

  addApprovalType: (t) => {
    audit("created approval type", `hr/approvals/type/${t.name}`);
    set((s) => ({ types: [{ ...t, id: rid() }, ...s.types] }));
  },

  submitRequest: (approvalTypeId, input) => {
    const type = get().types.find((t) => t.id === approvalTypeId);
    const workflow = get().workflows.find((w) => w.id === type?.workflowId);
    if (!type || !workflow) return "";
    const requestedFor = input.requestedFor ?? input.requestedBy;
    const id = rid();
    audit(`submitted for approval — ${type.name}`, `hr/approvals/request/${input.subjectLabel}`, { user: who(input.requestedBy) });
    set((s) => ({
      requests: [
        {
          id,
          approvalTypeId,
          workflowId: workflow.id,
          subjectLabel: input.subjectLabel,
          requestedBy: input.requestedBy,
          requestedFor,
          reference: input.reference,
          createdAt: new Date().toISOString(),
          currentStepIndex: 0,
          status: "Pending",
          steps: [...workflow.steps]
            .sort((a, b) => a.order - b.order)
            .map((st) => ({
              stepId: st.id,
              name: st.name,
              approverType: st.approverType,
              approverId: resolveApprover(st.approverType, st.approverId, requestedFor),
              decision: "Pending" as const,
            })),
        },
        ...s.requests,
      ],
    }));
    return id;
  },

  decideStep: (requestId, decision, comment) => {
    const req = get().requests.find((r) => r.id === requestId);
    if (!req || req.status !== "Pending") return;
    const step = req.steps[req.currentStepIndex];
    if (!step) return;
    const type = get().types.find((t) => t.id === req.approvalTypeId);
    audit(`${decision.toLowerCase()} approval step — ${type?.name ?? ""}`, `hr/approvals/request/${req.subjectLabel}`, { user: who(step.approverId) });
    set((s) => ({
      requests: s.requests.map((r) => {
        if (r.id !== requestId) return r;
        const steps = r.steps.map((st, i) => (i === r.currentStepIndex ? { ...st, decision, decidedAt: new Date().toISOString(), comment } : st));
        if (decision === "Rejected") {
          return { ...r, steps, status: "Rejected" as const, decidedAt: new Date().toISOString() };
        }
        const nextIndex = r.currentStepIndex + 1;
        const isFinal = nextIndex >= steps.length;
        return {
          ...r,
          steps,
          currentStepIndex: isFinal ? r.currentStepIndex : nextIndex,
          status: isFinal ? ("Approved" as const) : r.status,
          decidedAt: isFinal ? new Date().toISOString() : r.decidedAt,
        };
      }),
    }));
  },

  requestFor: (reference) => get().requests.find((r) => r.reference === reference),
  isApproved: (reference) => get().requests.find((r) => r.reference === reference)?.status === "Approved",
  currentApprover: (r) => (r.status === "Pending" ? r.steps[r.currentStepIndex]?.approverId : undefined),
  pendingFor: (approverId) => get().requests.filter((r) => r.status === "Pending" && r.steps[r.currentStepIndex]?.approverId === approverId),
}));
