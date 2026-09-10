// B8-B10 — Projects / job costing. A project is a cost+revenue bucket that
// tags journal lines (projectId dimension). Time entries (B9) log billable
// hours against a project; billable time is pulled into an invoice like a
// delayed charge. Project P&L (B10) reads tagged ledger activity.

export type ProjectStatus = "Active" | "On Hold" | "Completed" | "Cancelled";

export type Project = {
  id: string;
  code: string;
  name: string;
  customerId?: string; // billable project tied to a customer
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  budgetAmount?: number; // planned cost budget
  billable: boolean;
  description?: string;
  createdBy: string;
  createdAt: string;
};

export type TimeEntry = {
  id: string;
  projectId: string;
  staffId: string;
  date: string;
  hours: number;
  description: string;
  billable: boolean;
  rate?: number; // charge-out rate per hour (billable only)
  revenueAccount: number; // where the billed time lands
  status: "Unbilled" | "Invoiced" | "Non-billable";
  invoiceId?: string;
  createdAt: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const seedProjects: Project[] = [
  {
    id: "prj-dangote-clinic", code: "PRJ-001", name: "Dangote on-site clinic setup", customerId: "cust-dangote",
    status: "Active", startDate: daysAgo(40), budgetAmount: 3_500_000, billable: true,
    description: "Stand up an occupational-health clinic at the Ibese plant — staffing, equipment, protocols.",
    createdBy: "s1", createdAt: daysAgo(40),
  },
  {
    id: "prj-emr-rollout", code: "PRJ-002", name: "EMR rollout — internal", status: "Active", startDate: daysAgo(90),
    budgetAmount: 1_200_000, billable: false, description: "Internal digitisation programme.", createdBy: "s1", createdAt: daysAgo(90),
  },
];

export const seedTimeEntries: TimeEntry[] = [
  { id: "te-1", projectId: "prj-dangote-clinic", staffId: "s1", date: daysAgo(12), hours: 8, description: "Site assessment & protocol design", billable: true, rate: 25_000, revenueAccount: 4000, status: "Unbilled", createdAt: daysAgo(12) },
  { id: "te-2", projectId: "prj-dangote-clinic", staffId: "s2", date: daysAgo(9), hours: 6, description: "Nursing workflow setup", billable: true, rate: 12_000, revenueAccount: 4000, status: "Unbilled", createdAt: daysAgo(9) },
  { id: "te-3", projectId: "prj-emr-rollout", staffId: "s6", date: daysAgo(5), hours: 10, description: "Data migration mapping", billable: false, revenueAccount: 4000, status: "Non-billable", createdAt: daysAgo(5) },
];
