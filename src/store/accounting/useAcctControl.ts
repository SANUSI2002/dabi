import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { ROLE_PERMISSIONS, seedApprovalRules, type ApprovalRule, type ApprovableDoc, type DocApproval, type DocApprovalStep, type FinancePermission } from "@/data/accounting/control";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type ControlState = {
  rules: ApprovalRule[];

  can: (p: FinancePermission) => boolean;
  myRole: () => string;

  rulesFor: (docType: ApprovableDoc, amount: number) => ApprovalRule[];
  buildApproval: (docType: ApprovableDoc, amount: number, submittedBy: string) => DocApproval;
  /** apply a decision to a doc's approval object; returns the next state */
  decide: (approval: DocApproval, decision: "Approved" | "Rejected", comment?: string) => DocApproval;
  canDecide: (approval: DocApproval) => boolean;

  addRule: (r: Omit<ApprovalRule, "id" | "active">) => void;
  updateRule: (id: string, patch: Partial<ApprovalRule>) => void;
  removeRule: (id: string) => void;
};

export const useAcctControl = create<ControlState>((set, get) => ({
  rules: seedApprovalRules,

  can: (p) => {
    const role = useIdentity.getState().user.financeRole ?? "None";
    return ROLE_PERMISSIONS[role].includes(p);
  },
  myRole: () => useIdentity.getState().user.financeRole ?? "None",

  rulesFor: (docType, amount) =>
    get()
      .rules.filter((r) => r.active && r.docType === docType && amount >= r.minAmount && (r.maxAmount === null || amount < r.maxAmount))
      .sort((a, b) => a.level - b.level),

  buildApproval: (docType, amount, submittedBy) => {
    const rules = get().rulesFor(docType, round2(amount));
    if (!rules.length) return { status: "Not Required", currentLevel: 0, steps: [] };
    return {
      status: "Pending",
      currentLevel: rules[0].level,
      submittedBy,
      submittedAt: new Date().toISOString(),
      steps: rules.map((r) => ({ level: r.level, approverRole: r.approverRole, decision: "Pending" as const })),
    };
  },

  canDecide: (approval) => {
    if (approval.status !== "Pending") return false;
    const step = approval.steps.find((s) => s.level === approval.currentLevel);
    if (!step) return false;
    const me = useIdentity.getState().user;
    // A Finance Controller can clear any step; otherwise the role must match and
    // the approver cannot be the person who submitted it (segregation of duties).
    if (me.id === approval.submittedBy) return false;
    return me.financeRole === step.approverRole || me.financeRole === "Finance Controller";
  },

  decide: (approval, decision, comment) => {
    const me = useIdentity.getState().user;
    const steps: DocApprovalStep[] = approval.steps.map((s) =>
      s.level === approval.currentLevel ? { ...s, decision, decidedBy: me.id, decidedAt: new Date().toISOString(), comment } : s,
    );
    if (decision === "Rejected") {
      audit("rejected an approval step", "accounting/approvals");
      return { ...approval, steps, status: "Rejected" };
    }
    const remaining = steps.filter((s) => s.decision === "Pending").sort((a, b) => a.level - b.level);
    audit("approved an approval step", "accounting/approvals");
    if (!remaining.length) return { ...approval, steps, status: "Approved" };
    return { ...approval, steps, currentLevel: remaining[0].level };
  },

  addRule: (r) => {
    set((s) => ({ rules: [...s.rules, { ...r, id: `ar-${Math.random().toString(36).slice(2, 8)}`, active: true }] }));
    audit(`added approval rule for ${r.docType}`, "accounting/settings/approval-rules");
  },
  updateRule: (id, patch) => set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
}));
