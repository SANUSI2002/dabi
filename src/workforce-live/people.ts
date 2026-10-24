import { useHr } from "@/store/useHr";
import { useOrg } from "@/store/useOrg";
import { useEmployees } from "@/store/useEmployees";
import { workforceRequest } from "@/emr-live/client";
import type { StaffMember } from "@/data/types";
import type { Company, Department, HodChange, JobPosition, JobRole, EmployeeType, OrgTag } from "@/data/orgStructure";
import type { EmployeeProfile, EmployeeDocument, DisciplinaryAction, EmployeeNote, BonusPoints, Qualification, Policy, ActionType } from "@/data/hrProfile";
import { clean, isoDay, liveChange, uuid } from "./sync";

// People & organization in live mode (GET /people): fills useHr (staff), useOrg (structure) and
// useEmployees (profiles, documents, records) from the Workforce API and makes their actions write to it.

type Versioned = { version?: number };
type ApiEmployee = Omit<StaffMember, "status"> & Partial<EmployeeProfile> & { status: "ACTIVE" | "INACTIVE"; userId: string | null; version: number };
type ApiPeople = {
  companies: (Company & Versioned)[]; departments: (Department & Versioned)[]; hodChanges: HodChange[]; jobPositions: JobPosition[]; jobRoles: JobRole[];
  employeeTypes: EmployeeType[]; tags: OrgTag[]; employees: ApiEmployee[]; documents: (EmployeeDocument & Versioned)[]; actionTypes: ActionType[];
  disciplinaryActions: DisciplinaryAction[]; notes: EmployeeNote[]; bonusPoints: BonusPoints[]; qualifications: Qualification[]; policies: (Policy & Versioned)[];
};

const PROFILE_KEYS = [
  "dob", "gender", "maritalStatus", "address", "lga", "state", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "qualification",
  "companyId", "departmentId", "jobPositionId", "jobRoleId", "employeeTypeId", "reportingManagerId", "dateJoining", "contractEndDate", "workEmail", "workPhone",
  "tagIds", "bankName", "accountNumber", "bankBranch",
] as const;
const DATES = new Set(["dob", "dateJoining", "contractEndDate", "hireDate"]);
const username = (e: { name: string; email?: string | null }) => (e.email ? e.email.split("@")[0] : e.name.toLowerCase().replace(/[^a-z ]/g, "").trim().split(/\s+/).slice(-2).join("."));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;

let loaded = false;
export const peopleLoaded = () => loaded;

export async function loadPeople() {
  const { data } = await workforceRequest<{ data: ApiPeople }>("/people");
  loaded = true;
  useHr.setState({
    staff: data.employees.map((e) => ({
      id: e.id, name: e.name, role: e.role, cadre: e.cadre, phone: e.phone ?? undefined, email: e.email ?? undefined, hireDate: e.hireDate, license: e.license ?? undefined,
      status: e.status === "ACTIVE" ? "Active" : "Inactive", username: username(e),
    })),
  });
  useOrg.setState({
    companies: data.companies, departments: data.departments.map((d) => noNull(d)), hodChanges: data.hodChanges.map((h) => noNull(h)),
    jobPositions: data.jobPositions, jobRoles: data.jobRoles, employeeTypes: data.employeeTypes, tags: data.tags,
  });
  useEmployees.setState({
    profiles: data.employees.map((e) => {
      const profile: Record<string, unknown> = { id: e.id, tagIds: e.tagIds ?? [], companyId: e.companyId ?? "", version: e.version };
      for (const key of PROFILE_KEYS) if (e[key] !== null && e[key] !== undefined) profile[key] = e[key];
      return profile as unknown as EmployeeProfile;
    }),
    documents: data.documents.map((d) => noNull(d)), actionTypes: data.actionTypes, disciplinaryActions: data.disciplinaryActions.map((a) => noNull(a)),
    notes: data.notes, bonusPoints: data.bonusPoints, qualifications: data.qualifications.map((q) => noNull(q)), policies: data.policies,
  });
}

const reload = () => loadPeople();
const post = (path: string, body: unknown) => workforceRequest(path, { method: "POST", body });
const versionOf = (list: Versioned[] | undefined, id: string, find: (x: Versioned & { id?: string }) => boolean = (x) => x.id === id) => (list?.find(find) as Versioned | undefined)?.version;
const employeeVersion = (id: string) => (useEmployees.getState().profiles.find((p) => p.id === id) as (EmployeeProfile & Versioned) | undefined)?.version;
const patchEmployee = (id: string, body: Record<string, unknown>) => {
  const version = employeeVersion(id);
  if (version === undefined) throw new Error("This employee is not loaded yet; refresh and try again.");
  return workforceRequest(`/people/employees/${id}`, { method: "PATCH", version, body });
};
const toApiDates = (patch: Record<string, unknown>) => Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, DATES.has(k) && typeof v === "string" ? isoDay(v) : v]));

/** Replaces the people & organization actions with live ones (call once the live session is ready). */
export function goLivePeople() {
  useHr.setState({
    addStaff: (s) => {
      const id = uuid();
      void liveChange(
        () => post("/people/employees", clean({ id, name: s.name, role: s.role, cadre: s.cadre ?? "", phone: s.phone, email: s.email, hireDate: isoDay(s.hireDate) ?? new Date().toISOString().slice(0, 10), license: s.license })),
        reload,
        () => useHr.setState((st) => ({ staff: [{ ...s, id, status: "Active", username: username(s) }, ...st.staff] })),
      );
    },
    setStatus: (id, status) => {
      void liveChange(() => patchEmployee(id, { status: status === "Active" ? "ACTIVE" : "INACTIVE" }), reload,
        () => useHr.setState((st) => ({ staff: st.staff.map((x) => (x.id === id ? { ...x, status } : x)) })));
    },
    updateStaff: (id, patch) => {
      void liveChange(() => patchEmployee(id, clean(patch)), reload, () => useHr.setState((st) => ({ staff: st.staff.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));
    },
  });

  useOrg.setState({
    addCompany: (c) => {
      const id = uuid();
      void liveChange(() => post("/people/companies", clean({ id, name: c.name, code: c.code, address: c.address, lga: c.lga, state: c.state, country: c.country || "Nigeria" })), reload,
        () => useOrg.setState((s) => ({ companies: [...s.companies, { ...c, id, isHeadquarters: false }] })));
    },
    addDepartment: (d) => {
      const id = uuid();
      void liveChange(() => post("/people/departments", clean({ id, name: d.name, code: d.code, description: d.description, companyIds: d.companyIds, hodId: d.hodId, deputyHodId: d.deputyHodId, parentDepartmentId: d.parentDepartmentId })), reload,
        () => useOrg.setState((s) => ({ departments: [{ id, name: d.name, code: d.code, description: d.description, companyIds: d.companyIds, status: "Active", hodId: d.hodId, deputyHodId: d.deputyHodId, parentDepartmentId: d.parentDepartmentId, staffIds: [d.hodId, d.deputyHodId].filter((x): x is string => !!x), createdAt: new Date().toISOString() }, ...s.departments] })));
      return id;
    },
    updateDepartment: (id, patch) => {
      void liveChange(async () => {
        const version = versionOf(useOrg.getState().departments as Versioned[], id);
        await workforceRequest(`/people/departments/${id}`, { method: "PATCH", version, body: clean(patch as Record<string, unknown>) });
      }, reload, () => useOrg.setState((s) => ({ departments: s.departments.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));
    },
    changeHod: (departmentId, role, newStaffId, opts) => {
      void liveChange(async () => {
        const version = versionOf(useOrg.getState().departments as Versioned[], departmentId);
        await workforceRequest(`/people/departments/${departmentId}/leader`, { method: "POST", version, body: clean({ role, employeeId: newStaffId ?? null, effectiveDate: isoDay(opts.effectiveDate), reason: opts.reason }) });
      }, reload, () => useOrg.setState((s) => ({ departments: s.departments.map((d) => (d.id === departmentId ? { ...d, [role === "hod" ? "hodId" : "deputyHodId"]: newStaffId } : d)) })));
    },
    assignStaff: (departmentId, staffId) => {
      void liveChange(() => post(`/people/departments/${departmentId}/members`, { employeeId: staffId }), reload,
        () => useOrg.setState((s) => ({ departments: s.departments.map((d) => (d.id === departmentId && !d.staffIds.includes(staffId) ? { ...d, staffIds: [...d.staffIds, staffId] } : d)) })));
    },
    removeStaff: (departmentId, staffId) => {
      void liveChange(() => post(`/people/departments/${departmentId}/members/remove`, { employeeId: staffId }), reload,
        () => useOrg.setState((s) => ({ departments: s.departments.map((d) => (d.id === departmentId ? { ...d, staffIds: d.staffIds.filter((x) => x !== staffId) } : d)) })));
    },
    addJobPosition: (p) => { void liveChange(() => post("/people/job-positions", { id: uuid(), ...p }), reload); },
    addJobRole: (r) => { void liveChange(() => post("/people/job-roles", { id: uuid(), ...r }), reload); },
    addEmployeeType: (t) => { void liveChange(() => post("/people/employee-types", { id: uuid(), name: t.name }), reload); },
    addTag: (t) => { void liveChange(() => post("/people/tags", { id: uuid(), name: t.name, color: t.color }), reload); },
  });

  useEmployees.setState({
    addPolicy: (p) => { void liveChange(() => post("/people/policies", { id: uuid(), ...p }), reload); },
    addActionType: (name, blockOption) => { void liveChange(() => post("/people/action-types", { id: uuid(), name, blockOption }), reload); },
    upsertProfile: (staffId, patch) => {
      void liveChange(() => patchEmployee(staffId, clean(toApiDates(patch as Record<string, unknown>))), reload,
        () => useEmployees.setState((s) => ({ profiles: s.profiles.map((p) => (p.id === staffId ? { ...p, ...patch } : p)) })));
    },
    requestDocument: (employeeIds, title, category, notifyBeforeDays = 30) => {
      const ids = employeeIds.map(() => uuid());
      void liveChange(() => post("/people/documents", { ids, employeeIds, title, category, notifyBeforeDays }), reload,
        () => useEmployees.setState((s) => ({ documents: [...employeeIds.map((employeeId, i) => ({ id: ids[i], employeeId, title, category, status: "Requested" as const, notifyBeforeDays, version: 1 })), ...s.documents] })));
    },
    uploadDocument: (id, data) => {
      void liveChange(async () => {
        const version = versionOf(useEmployees.getState().documents as Versioned[], id) ?? 1;
        await workforceRequest(`/people/documents/${id}/upload`, { method: "POST", version, body: clean({ issueDate: isoDay(data.issueDate), expiryDate: isoDay(data.expiryDate) }) });
      }, reload, () => useEmployees.setState((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, ...data, status: "Uploaded" } : d)) })));
    },
    reviewDocument: (id, status, rejectReason) => {
      void liveChange(async () => {
        const version = versionOf(useEmployees.getState().documents as Versioned[], id) ?? 1;
        await workforceRequest(`/people/documents/${id}/review`, { method: "POST", version, body: clean({ status, rejectReason }) });
      }, reload, () => useEmployees.setState((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, status, rejectReason } : d)) })));
    },
    addDisciplinaryAction: (a) => {
      void liveChange(() => post("/people/disciplinary-actions", clean({ employeeIds: a.employeeIds, actionTypeId: a.actionTypeId, description: a.description, unit: a.unit, amount: a.amount, startDate: isoDay(a.startDate), attachment: a.attachment })), reload);
    },
    addNote: (employeeId, note) => { void liveChange(() => post(`/people/employees/${employeeId}/notes`, { note }), reload); },
    adjustBonus: (employeeId, delta, reason) => { void liveChange(() => post(`/people/employees/${employeeId}/bonus`, { delta, reason }), reload); },
    addQualification: (q) => {
      void liveChange(() => post(`/people/employees/${q.employeeId}/qualifications`, clean({ title: q.title, issuingBody: q.issuingBody, dateObtained: isoDay(q.dateObtained), certificateRef: q.certificateRef })), reload);
    },
  });
}

/** Empties the people stores (no demo staff) when the signed-in role cannot read HR records. */
export function clearPeople() {
  useHr.setState({ staff: [] });
  useOrg.setState({ companies: [], departments: [], hodChanges: [], jobPositions: [], jobRoles: [], employeeTypes: [], tags: [] });
  useEmployees.setState({ profiles: [], documents: [], disciplinaryActions: [], notes: [], bonusPoints: [], qualifications: [], policies: [] });
}

/** Adds an employee record for each organization member who has none; resolves to how many (null on failure). */
export async function importMembers(): Promise<number | null> {
  let added: number | null = null;
  await liveChange(async () => {
    const result = await workforceRequest<{ data: { imported: number } }>("/people/employees/import-members", { method: "POST", body: {} });
    added = result.data.imported;
  }, reload);
  return added;
}
