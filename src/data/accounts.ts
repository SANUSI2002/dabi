// Sign-in accounts. Each links a staff member to a system role and a
// WBiz V3 workforce role, so the workforce module reflects whoever is signed in.

export type WfRole =
  | "Tenant HR Administrator"
  | "Line Manager"
  | "Employee"
  | "Scheduler"
  | "Auditor";

// Accounting-module access level. Kept on the shared Account so the Accounting
// product can gate actions without importing anything HR-specific (segregation
// of duties: an Accountant prepares, a Controller / Approver signs off, an
// Auditor is read-only).
export type FinanceRole =
  | "Finance Controller"
  | "Accountant"
  | "Approver"
  | "Auditor"
  | "None";

export type Account = {
  id: string; // = staff id
  username: string;
  name: string;
  role: string; // short display role
  systemRole: string; // access level in the EMR
  wfRole: WfRole;
  financeRole: FinanceRole;
  reports?: string[]; // staff ids a Line Manager oversees
};

export const ACCOUNTS: Account[] = [
  {
    id: "s1", username: "adaeze.okonjo", name: "Dr. Adaeze Okonjo",
    role: "Medical Officer", systemRole: "System Administrator",
    wfRole: "Tenant HR Administrator", financeRole: "Finance Controller",
  },
  {
    id: "s2", username: "grace.nwangbo", name: "Nurse Grace Nwangbo",
    role: "Senior Nurse", systemRole: "Nurse Manager",
    wfRole: "Line Manager", reports: ["s2", "s3", "s5", "s8"], financeRole: "Approver",
  },
  {
    id: "s3", username: "mary.williams", name: "Mary Williams",
    role: "Nurse", systemRole: "Clinician",
    wfRole: "Employee", financeRole: "None",
  },
  {
    id: "s7", username: "samuel.etim", name: "Samuel Etim",
    role: "Lab Technician", systemRole: "Clinician",
    wfRole: "Employee", financeRole: "None",
  },
  {
    id: "s6", username: "folashade.adeniyi", name: "Folashade Adeniyi",
    role: "M&E / HMIS Officer", systemRole: "Scheduler",
    wfRole: "Scheduler", financeRole: "Accountant",
  },
  {
    id: "s4", username: "ogundele.olajumoke", name: "Ogundele Olajumoke",
    role: "Health Records Officer", systemRole: "Auditor (read-only)",
    wfRole: "Auditor", financeRole: "Auditor",
  },
];

export const DEFAULT_ACCOUNT = "s1";

export const accountById = (id: string) =>
  ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS.find((a) => a.id === DEFAULT_ACCOUNT)!;
