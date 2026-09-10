import { create } from "zustand";
import { persisted } from "@/platform/persist";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useOrg } from "@/store/useOrg";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { ACCOUNTS } from "@/data/accounts";
import { seedVacancies, type VacancyRequest, type VacancyStatus } from "@/data/vacancies";

const rid = () => Math.random().toString(36).slice(2, 9);
const HR_ADMIN = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator")?.id ?? "s1";

type VacancyState = {
  vacancies: VacancyRequest[];

  vacancyById: (id?: string) => VacancyRequest | undefined;
  vacanciesForDepartment: (departmentId: string) => VacancyRequest[];
  createVacancy: (input: Omit<VacancyRequest, "id" | "status" | "createdAt" | "raisedBy" | "workflowRef">) => string;
  updateVacancy: (id: string, patch: Partial<Omit<VacancyRequest, "id" | "status" | "workflowRef">>) => void;
  submitVacancy: (id: string) => { ok: boolean; error?: string };
  cancelVacancy: (id: string) => void;
  /** re-reads the workflow outcome and syncs status (approved / rejected + reason) */
  syncFromWorkflow: (id: string) => void;
  markFilled: (id: string) => void;
  liveStatus: (v: VacancyRequest) => VacancyStatus;
};

export const useVacancies = create<VacancyState>(
  persisted<VacancyState>("vacancies", (set, get) => ({
    vacancies: seedVacancies,

    vacancyById: (id) => get().vacancies.find((v) => v.id === id),
    vacanciesForDepartment: (departmentId) => get().vacancies.filter((v) => v.departmentId === departmentId),

    createVacancy: (input) => {
      const id = `vac-${rid()}`;
      const v: VacancyRequest = {
        ...input,
        id,
        raisedBy: useIdentity.getState().user.id,
        status: "Draft",
        workflowRef: id,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ vacancies: [v, ...s.vacancies] }));
      audit(`drafted vacancy request — ${input.roleTitle}`, `hr/vacancies/${id}`);
      return id;
    },

    updateVacancy: (id, patch) =>
      set((s) => ({ vacancies: s.vacancies.map((v) => (v.id === id && (v.status === "Draft" || v.status === "Rejected") ? { ...v, ...patch } : v)) })),

    submitVacancy: (id) => {
      const v = get().vacancyById(id);
      if (!v) return { ok: false, error: "Not found." };
      const dept = useOrg.getState().deptById(v.departmentId);
      const wf = useWorkflow.getState();
      if (wf.defsForTrigger("vacancy").length === 0) return { ok: false, error: "No active vacancy approval workflow — configure one in the Workflow Builder." };
      const res = wf.start({
        triggerType: "vacancy",
        subject: `Vacancy: ${v.headcount}× ${v.roleTitle} (${dept?.name ?? "dept"})`,
        reference: v.id,
        context: {
          initiatorId: v.raisedBy,
          departmentId: v.departmentId,
          hodId: dept?.hodId,
          deputyHodId: dept?.deputyHodId,
          headcount: v.headcount,
          salaryMax: v.salaryMax ?? 0,
          "roleHolder:HR Administrator": HR_ADMIN,
          "roleHolder:Finance Controller": ACCOUNTS.find((a) => a.systemRole === "System Administrator")?.id ?? "s1",
        },
      });
      if (!res.ok) return { ok: false, error: res.error };
      set((s) => ({ vacancies: s.vacancies.map((x) => (x.id === id ? { ...x, status: res.autoApproved ? "Approved" : "Submitted", submittedAt: new Date().toISOString(), rejectionReason: undefined } : x)) }));
      audit(`submitted vacancy request — ${v.roleTitle}`, `hr/vacancies/${id}`);
      return { ok: true };
    },

    cancelVacancy: (id) => {
      useWorkflow.getState().cancel(useWorkflow.getState().instanceFor(id)?.id ?? "", "vacancy withdrawn");
      set((s) => ({ vacancies: s.vacancies.map((v) => (v.id === id ? { ...v, status: "Cancelled" } : v)) }));
    },

    syncFromWorkflow: (id) => {
      const v = get().vacancyById(id);
      if (!v || v.status !== "Submitted") return;
      const inst = useWorkflow.getState().instanceFor(id);
      if (!inst) return;
      if (inst.status === "Approved") {
        set((s) => ({ vacancies: s.vacancies.map((x) => (x.id === id ? { ...x, status: "Approved", decidedAt: new Date().toISOString() } : x)) }));
        audit(`vacancy request approved — ${v.roleTitle}`, `hr/vacancies/${id}`);
      } else if (inst.status === "Rejected") {
        const reason = [...inst.history].reverse().find((h) => h.action === "rejected")?.comment;
        set((s) => ({ vacancies: s.vacancies.map((x) => (x.id === id ? { ...x, status: "Rejected", rejectionReason: reason || "Rejected — no reason given", decidedAt: new Date().toISOString() } : x)) }));
        audit(`vacancy request rejected — ${v.roleTitle}`, `hr/vacancies/${id}`);
      }
    },

    markFilled: (id) => set((s) => ({ vacancies: s.vacancies.map((v) => (v.id === id ? { ...v, status: "Filled" } : v)) })),

    liveStatus: (v) => {
      if (v.status !== "Submitted") return v.status;
      const inst = useWorkflow.getState().instanceFor(v.id);
      if (inst?.status === "Approved") return "Approved";
      if (inst?.status === "Rejected") return "Rejected";
      return "Submitted";
    },
  })),
);
