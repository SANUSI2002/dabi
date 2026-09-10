import { create } from "zustand";
import * as seed from "@/data/orgStructure";
import { audit, auditChange, diffFields } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { Company, Department, JobPosition, JobRole, EmployeeType, OrgTag, HodChange } from "@/data/orgStructure";

const rid = () => Math.random().toString(36).slice(2, 9);

type OrgState = {
  companies: Company[];
  departments: Department[];
  hodChanges: HodChange[];
  jobPositions: JobPosition[];
  jobRoles: JobRole[];
  employeeTypes: EmployeeType[];
  tags: OrgTag[];

  addCompany: (c: Omit<Company, "id" | "isHeadquarters">) => void;
  addDepartment: (d: { name: string; code: string; description?: string; companyIds: string[]; hodId?: string; deputyHodId?: string; parentDepartmentId?: string }) => string;
  updateDepartment: (id: string, patch: Partial<Pick<Department, "name" | "code" | "description" | "status" | "companyIds" | "parentDepartmentId">>) => void;
  deptById: (id?: string) => Department | undefined;
  // Phase 3-4 — leadership & membership
  changeHod: (departmentId: string, role: "hod" | "deputy-hod", newStaffId: string | undefined, opts: { effectiveDate: string; reason?: string }) => void;
  assignStaff: (departmentId: string, staffId: string) => void;
  removeStaff: (departmentId: string, staffId: string) => void;
  departmentHistory: (departmentId: string) => HodChange[];
  subDepartments: (departmentId: string) => Department[];

  addJobPosition: (p: Omit<JobPosition, "id">) => void;
  addJobRole: (r: Omit<JobRole, "id">) => void;
  addEmployeeType: (t: Omit<EmployeeType, "id">) => void;
  addTag: (t: Omit<OrgTag, "id">) => void;

  companyName: (id?: string) => string;
  departmentName: (id?: string) => string;
  jobPositionName: (id?: string) => string;
  jobRoleName: (id?: string) => string;
  employeeTypeName: (id?: string) => string;
  positionsFor: (departmentId: string) => JobPosition[];
  rolesFor: (jobPositionId: string) => JobRole[];
};

export const useOrg = create<OrgState>((set, get) => ({
  companies: seed.companies,
  departments: seed.departments,
  hodChanges: seed.hodChanges,
  jobPositions: seed.jobPositions,
  jobRoles: seed.jobRoles,
  employeeTypes: seed.employeeTypes,
  tags: seed.orgTags,

  addCompany: (c) => {
    audit("added company / branch", `hr/org/company/${c.name}`);
    set((s) => ({ companies: [...s.companies, { ...c, id: rid(), isHeadquarters: false }] }));
  },
  addDepartment: (d) => {
    const id = rid();
    audit(`created department ${d.name} (${d.code})`, `hr/org/department/${d.name}`);
    set((s) => ({
      departments: [
        { id, name: d.name, code: d.code, description: d.description, companyIds: d.companyIds, status: "Active", hodId: d.hodId, deputyHodId: d.deputyHodId, parentDepartmentId: d.parentDepartmentId, staffIds: [d.hodId, d.deputyHodId].filter((x): x is string => !!x), createdAt: new Date().toISOString() },
        ...s.departments,
      ],
    }));
    return id;
  },
  updateDepartment: (id, patch) => {
    const before = get().deptById(id);
    set((s) => ({ departments: s.departments.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    auditChange(
      `updated department ${get().departmentName(id)}`,
      `hr/org/department/${id}`,
      diffFields(before, patch, ["name", "code", "description", "status", "companyIds", "parentDepartmentId"]),
    );
  },
  deptById: (id) => get().departments.find((d) => d.id === id),

  changeHod: (departmentId, role, newStaffId, opts) => {
    const dept = get().deptById(departmentId);
    if (!dept) return;
    const key = role === "hod" ? "hodId" : "deputyHodId";
    const previousStaffId = dept[key];
    if (previousStaffId === newStaffId) return;
    const change: HodChange = {
      id: `hc-${rid()}`,
      departmentId,
      role,
      previousStaffId,
      newStaffId,
      effectiveDate: opts.effectiveDate,
      reason: opts.reason,
      changedBy: useIdentity.getState().user.id,
      at: new Date().toISOString(),
    };
    set((s) => ({
      departments: s.departments.map((d) =>
        d.id === departmentId
          ? { ...d, [key]: newStaffId, staffIds: newStaffId && !d.staffIds.includes(newStaffId) ? [...d.staffIds, newStaffId] : d.staffIds }
          : d,
      ),
      hodChanges: [change, ...s.hodChanges],
    }));
    audit(`changed ${role === "hod" ? "HOD" : "Deputy HOD"} of ${dept.name}`, `hr/org/department/${dept.name}`);
  },
  assignStaff: (departmentId, staffId) => {
    set((s) => ({ departments: s.departments.map((d) => (d.id === departmentId && !d.staffIds.includes(staffId) ? { ...d, staffIds: [...d.staffIds, staffId] } : d)) }));
    audit(`assigned staff to ${get().departmentName(departmentId)}`, `hr/org/department/${departmentId}`);
  },
  removeStaff: (departmentId, staffId) => {
    set((s) => ({
      departments: s.departments.map((d) =>
        d.id === departmentId
          ? { ...d, staffIds: d.staffIds.filter((x) => x !== staffId), hodId: d.hodId === staffId ? undefined : d.hodId, deputyHodId: d.deputyHodId === staffId ? undefined : d.deputyHodId }
          : d,
      ),
    }));
    audit(`removed staff from ${get().departmentName(departmentId)}`, `hr/org/department/${departmentId}`);
  },
  departmentHistory: (departmentId) => get().hodChanges.filter((h) => h.departmentId === departmentId).sort((a, b) => b.at.localeCompare(a.at)),
  subDepartments: (departmentId) => get().departments.filter((d) => d.parentDepartmentId === departmentId),
  addJobPosition: (p) => {
    audit("added job position", `hr/org/job-position/${p.name}`);
    set((s) => ({ jobPositions: [{ ...p, id: rid() }, ...s.jobPositions] }));
  },
  addJobRole: (r) => {
    audit("added job role", `hr/org/job-role/${r.name}`);
    set((s) => ({ jobRoles: [{ ...r, id: rid() }, ...s.jobRoles] }));
  },
  addEmployeeType: (t) => {
    audit("added employee type", `hr/org/employee-type/${t.name}`);
    set((s) => ({ employeeTypes: [{ ...t, id: rid() }, ...s.employeeTypes] }));
  },
  addTag: (t) => {
    audit("added HR tag", `hr/org/tag/${t.name}`);
    set((s) => ({ tags: [{ ...t, id: rid() }, ...s.tags] }));
  },

  companyName: (id) => get().companies.find((c) => c.id === id)?.name ?? "—",
  departmentName: (id) => get().departments.find((d) => d.id === id)?.name ?? "—",
  jobPositionName: (id) => get().jobPositions.find((p) => p.id === id)?.name ?? "—",
  jobRoleName: (id) => get().jobRoles.find((r) => r.id === id)?.name ?? "—",
  employeeTypeName: (id) => get().employeeTypes.find((t) => t.id === id)?.name ?? "—",
  positionsFor: (departmentId) => get().jobPositions.filter((p) => p.departmentId === departmentId),
  rolesFor: (jobPositionId) => get().jobRoles.filter((r) => r.jobPositionId === jobPositionId),
}));
