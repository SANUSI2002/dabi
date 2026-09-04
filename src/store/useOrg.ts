import { create } from "zustand";
import * as seed from "@/data/orgStructure";
import { audit } from "@/store/useAudit";
import type { Company, Department, JobPosition, JobRole, EmployeeType, OrgTag } from "@/data/orgStructure";

const rid = () => Math.random().toString(36).slice(2, 9);

type OrgState = {
  companies: Company[];
  departments: Department[];
  jobPositions: JobPosition[];
  jobRoles: JobRole[];
  employeeTypes: EmployeeType[];
  tags: OrgTag[];

  addDepartment: (d: Omit<Department, "id">) => void;
  addJobPosition: (p: Omit<JobPosition, "id">) => void;
  addJobRole: (r: Omit<JobRole, "id">) => void;
  addEmployeeType: (t: Omit<EmployeeType, "id">) => void;
  addTag: (t: Omit<OrgTag, "id">) => void;

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
  jobPositions: seed.jobPositions,
  jobRoles: seed.jobRoles,
  employeeTypes: seed.employeeTypes,
  tags: seed.orgTags,

  addDepartment: (d) => {
    audit("added department", `hr/org/department/${d.name}`);
    set((s) => ({ departments: [{ ...d, id: rid() }, ...s.departments] }));
  },
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

  departmentName: (id) => get().departments.find((d) => d.id === id)?.name ?? "—",
  jobPositionName: (id) => get().jobPositions.find((p) => p.id === id)?.name ?? "—",
  jobRoleName: (id) => get().jobRoles.find((r) => r.id === id)?.name ?? "—",
  employeeTypeName: (id) => get().employeeTypes.find((t) => t.id === id)?.name ?? "—",
  positionsFor: (departmentId) => get().jobPositions.filter((p) => p.departmentId === departmentId),
  rolesFor: (jobPositionId) => get().jobRoles.filter((r) => r.jobPositionId === jobPositionId),
}));
