import { create } from "zustand";
import * as seed from "@/data/queries";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { ACCOUNTS } from "@/data/accounts";
import type { Query } from "@/data/queries";

const rid = () => Math.random().toString(36).slice(2, 9);
const HR_ADMIN = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator")?.id ?? "s1";

type QueriesState = {
  queries: Query[];

  raiseQuery: (input: { employeeId: string; raisedBy: string; subject: string; body: string; responseDeadlineDays: number }) => string;
  markSent: (id: string) => void;
  queriesFor: (employeeId: string) => Query[];
};

/** context bag the "query" workflow expects */
function queryContext(employeeId: string, raisedBy: string) {
  const profile = useEmployees.getState().profileFor(employeeId);
  const dept = useOrg.getState().deptById(profile?.departmentId);
  return {
    initiatorId: raisedBy,
    departmentId: profile?.departmentId,
    lineManagerId: profile?.reportingManagerId,
    hodId: dept?.hodId,
    deputyHodId: dept?.deputyHodId,
    "roleHolder:HR Administrator": HR_ADMIN,
  };
}

export const useQueries = create<QueriesState>((set, get) => ({
  queries: seed.queries,

  raiseQuery: (input) => {
    const emp = useHr.getState().byId(input.employeeId);
    const id = rid();
    audit("raised disciplinary query", `hr/query/${emp?.name ?? input.employeeId}`, { user: useHr.getState().byId(input.raisedBy)?.name });
    set((s) => ({
      queries: [
        { id, employeeId: input.employeeId, raisedBy: input.raisedBy, subject: input.subject, body: input.body, status: "Drafted", raisedAt: new Date().toISOString(), responseDeadlineDays: input.responseDeadlineDays },
        ...s.queries,
      ],
    }));
    useWorkflow.getState().start({
      triggerType: "query",
      subject: `Query — ${input.subject} (${emp?.name ?? "employee"})`,
      reference: id,
      context: queryContext(input.employeeId, input.raisedBy),
    });
    return id;
  },

  markSent: (id) => {
    const q = get().queries.find((x) => x.id === id);
    if (!useWorkflow.getState().isApproved(id)) return;
    audit("sent disciplinary query", `hr/query/${q?.employeeId ?? id}`);
    set((s) => ({ queries: s.queries.map((x) => (x.id === id ? { ...x, status: "Sent", sentAt: new Date().toISOString() } : x)) }));
  },

  queriesFor: (employeeId) => get().queries.filter((q) => q.employeeId === employeeId),
}));
