import type { HrSnapshot } from "./types";
import { differenceInYears, differenceInCalendarDays } from "date-fns";

type Tone = "brand" | "action" | "mist" | "amber";
type Stat = { label: string; value: string | number; tone?: Tone };

export type HrReportTab =
  | { name: string; kind: "table"; columns: string[]; rows: (s: HrSnapshot) => (string | number)[][] }
  | { name: string; kind: "bars"; data: (s: HrSnapshot) => { label: string; value: number }[] }
  | { name: string; kind: "kv"; rows: (s: HrSnapshot) => { k: string; v: string | number; target?: string }[] }
  | { name: string; kind: "empty"; hint: string };

export type HrReportFamily = {
  name: string;
  category: "Workforce" | "Payroll" | "Talent" | "Compliance";
  stats: (s: HrSnapshot) => Stat[];
  tabs: HrReportTab[];
};

const nm = (s: HrSnapshot, id: string) => s.staff.find((x) => x.id === id)?.name ?? id;
const profileOf = (s: HrSnapshot, id: string) => s.profiles.find((p) => p.id === id);

export const HR_REPORTS: HrReportFamily[] = [
  {
    name: "Workforce Composition",
    category: "Workforce",
    stats: (s) => [
      { label: "Employees", value: s.staff.length, tone: "brand" },
      { label: "Active", value: s.staff.filter((x) => x.status === "Active").length, tone: "brand" },
      { label: "Departments", value: s.departments.length },
      { label: "Inactive", value: s.staff.filter((x) => x.status === "Inactive").length, tone: "action" },
    ],
    tabs: [
      {
        name: "By Department", kind: "table", columns: ["Department", "Active", "Inactive", "Total"],
        rows: (s) => s.departments.map((d) => {
          const inDept = s.staff.filter((x) => profileOf(s, x.id)?.departmentId === d.id);
          return [d.name, inDept.filter((x) => x.status === "Active").length, inDept.filter((x) => x.status === "Inactive").length, inDept.length];
        }),
      },
      { name: "Headcount Chart", kind: "bars", data: (s) => s.departments.map((d) => ({ label: d.name, value: s.staff.filter((x) => profileOf(s, x.id)?.departmentId === d.id).length })) },
      {
        name: "By Employee Type", kind: "table", columns: ["Type", "Count"],
        rows: (s) => { const types = [...new Set(s.profiles.map((p) => p.employeeTypeId).filter(Boolean))]; return types.map((t) => [s.employeeTypeName(t), s.profiles.filter((p) => p.employeeTypeId === t).length]); },
      },
    ],
  },
  {
    name: "Diversity Snapshot",
    category: "Workforce",
    stats: (s) => {
      const withGender = s.profiles.filter((p) => p.gender);
      return [
        { label: "Recorded", value: withGender.length, tone: "brand" },
        { label: "Female", value: withGender.filter((p) => p.gender === "Female").length },
        { label: "Male", value: withGender.filter((p) => p.gender === "Male").length },
        { label: "Not recorded", value: s.staff.length - withGender.length, tone: "amber" },
      ];
    },
    tabs: [
      { name: "Gender Breakdown", kind: "kv", rows: (s) => { const withGender = s.profiles.filter((p) => p.gender); const groups = [...new Set(withGender.map((p) => p.gender))]; return groups.map((g) => ({ k: g!, v: withGender.filter((p) => p.gender === g).length })); } },
      {
        name: "Age Bands", kind: "kv",
        rows: (s) => {
          const ages = s.profiles.filter((p) => p.dob).map((p) => differenceInYears(new Date(), new Date(p.dob!)));
          const band = (lo: number, hi: number) => ages.filter((a) => a >= lo && a < hi).length;
          return [{ k: "20-29", v: band(20, 30) }, { k: "30-39", v: band(30, 40) }, { k: "40-49", v: band(40, 50) }, { k: "50+", v: band(50, 200) }];
        },
      },
    ],
  },
  {
    name: "Tenure & Longevity",
    category: "Workforce",
    stats: (s) => {
      const years = s.staff.map((x) => differenceInYears(new Date(), new Date(x.hireDate)));
      const avg = years.length ? years.reduce((a, b) => a + b, 0) / years.length : 0;
      return [
        { label: "Avg tenure (yrs)", value: avg.toFixed(1), tone: "brand" },
        { label: "Longest serving", value: years.length ? `${Math.max(...years)} yrs` : "—" },
        { label: "< 1 year", value: years.filter((y) => y < 1).length, tone: "amber" },
        { label: "5+ years", value: years.filter((y) => y >= 5).length },
      ];
    },
    tabs: [
      {
        name: "By Employee", kind: "table", columns: ["Employee", "Department", "Tenure (yrs)"],
        rows: (s) => s.staff.map((x) => [x.name, s.departmentName(profileOf(s, x.id)?.departmentId), differenceInYears(new Date(), new Date(x.hireDate))])
          .sort((a, b) => (b[2] as number) - (a[2] as number)),
      },
    ],
  },
  {
    name: "Span of Control",
    category: "Workforce",
    stats: (s) => {
      const managers = [...new Set(s.profiles.map((p) => p.reportingManagerId).filter(Boolean))];
      return [
        { label: "Managers", value: managers.length, tone: "brand" },
        { label: "Employees", value: s.staff.length },
        { label: "Avg span", value: managers.length ? (s.profiles.filter((p) => p.reportingManagerId).length / managers.length).toFixed(1) : "—" },
        { label: "Unmanaged", value: s.staff.length - s.profiles.filter((p) => p.reportingManagerId).length, tone: "amber" },
      ];
    },
    tabs: [
      {
        name: "By Manager", kind: "table", columns: ["Manager", "Direct reports"],
        rows: (s) => [...new Set(s.profiles.map((p) => p.reportingManagerId).filter(Boolean))]
          .map((m) => [nm(s, m!), s.profiles.filter((p) => p.reportingManagerId === m).length])
          .sort((a, b) => (b[1] as number) - (a[1] as number)),
      },
    ],
  },
  {
    name: "Payroll Summary",
    category: "Payroll",
    stats: (s) => {
      const batches = [...new Set(s.payslips.map((p) => p.batch))];
      const latest = batches[0];
      const inBatch = s.payslips.filter((p) => p.batch === latest);
      return [
        { label: "Batches run", value: batches.length, tone: "brand" },
        { label: "Latest gross", value: `₦${inBatch.reduce((n, p) => n + p.grossPay, 0).toLocaleString()}` },
        { label: "Latest net", value: `₦${inBatch.reduce((n, p) => n + p.netPay, 0).toLocaleString()}`, tone: "brand" },
        { label: "Unpaid payslips", value: s.payslips.filter((p) => p.status !== "Paid").length, tone: s.payslips.some((p) => p.status !== "Paid") ? "amber" : "brand" },
      ];
    },
    tabs: [
      {
        name: "By Batch", kind: "table", columns: ["Batch", "Payslips", "Gross", "Deductions", "Net"],
        rows: (s) => [...new Set(s.payslips.map((p) => p.batch))].map((b) => {
          const list = s.payslips.filter((p) => p.batch === b);
          return [b, list.length, `₦${list.reduce((n, p) => n + p.grossPay, 0).toLocaleString()}`, `₦${list.reduce((n, p) => n + p.totalDeductions, 0).toLocaleString()}`, `₦${list.reduce((n, p) => n + p.netPay, 0).toLocaleString()}`];
        }),
      },
    ],
  },
  {
    name: "Salary Distribution",
    category: "Payroll",
    stats: (s) => {
      const latest = s.payslips[0]?.batch;
      const list = s.payslips.filter((p) => p.batch === latest);
      const avg = list.length ? list.reduce((n, p) => n + p.grossPay, 0) / list.length : 0;
      return [
        { label: "Avg gross pay", value: `₦${Math.round(avg).toLocaleString()}`, tone: "brand" },
        { label: "Highest gross", value: list.length ? `₦${Math.max(...list.map((p) => p.grossPay)).toLocaleString()}` : "—" },
        { label: "Lowest gross", value: list.length ? `₦${Math.min(...list.map((p) => p.grossPay)).toLocaleString()}` : "—" },
        { label: "Employees", value: list.length },
      ];
    },
    tabs: [
      {
        name: "By Department", kind: "bars",
        data: (s) => {
          const latest = s.payslips[0]?.batch;
          return s.departments.map((d) => {
            const ids = s.staff.filter((x) => profileOf(s, x.id)?.departmentId === d.id).map((x) => x.id);
            const list = s.payslips.filter((p) => p.batch === latest && ids.includes(p.employeeId));
            return { label: d.name, value: list.reduce((n, p) => n + p.grossPay, 0) };
          }).filter((d) => d.value > 0);
        },
      },
    ],
  },
  {
    name: "Loans & Advances",
    category: "Payroll",
    stats: (s) => [
      { label: "Active loans", value: s.loans.filter((l) => l.status === "Repaying").length, tone: "amber" },
      { label: "Settled", value: s.loans.filter((l) => l.status === "Settled").length, tone: "brand" },
      { label: "Outstanding (₦)", value: `₦${s.loans.filter((l) => l.status === "Repaying").reduce((n, l) => n + (l.installments - l.installmentsPaid) * l.installmentAmount, 0).toLocaleString()}` },
      { label: "Requested", value: s.loans.filter((l) => l.status === "Requested").length, tone: s.loans.some((l) => l.status === "Requested") ? "amber" : "mist" },
    ],
    tabs: [
      {
        name: "Register", kind: "table", columns: ["Employee", "Type", "Amount", "Remaining", "Status"],
        rows: (s) => s.loans.map((l) => [nm(s, l.employeeId), l.type, `₦${l.amount.toLocaleString()}`, `₦${((l.installments - l.installmentsPaid) * l.installmentAmount).toLocaleString()}`, l.status]),
      },
    ],
  },
  {
    name: "Recruitment Funnel",
    category: "Talent",
    stats: (s) => {
      const active = s.candidates.filter((c) => !c.canceled);
      return [
        { label: "Open requisitions", value: s.requisitions.filter((r) => !r.closed).length, tone: "brand" },
        { label: "Active candidates", value: active.length },
        { label: "Hired", value: s.candidates.filter((c) => c.hired).length, tone: "brand" },
        { label: "Rejected", value: s.candidates.filter((c) => c.canceled).length, tone: "action" },
      ];
    },
    tabs: [
      {
        name: "Conversion", kind: "kv",
        rows: (s) => {
          const total = s.candidates.length;
          const hired = s.candidates.filter((c) => c.hired).length;
          return [
            { k: "Total candidates", v: total },
            { k: "Hired", v: hired, target: total ? `${Math.round((hired / total) * 100)}% conversion` : undefined },
            { k: "Rejected", v: s.candidates.filter((c) => c.canceled).length },
            { k: "Still in pipeline", v: s.candidates.filter((c) => !c.canceled && !c.hired).length },
          ];
        },
      },
      {
        name: "By Source", kind: "table", columns: ["Source", "Candidates", "Hired"],
        rows: (s) => [...new Set(s.candidates.map((c) => c.source))].map((src) => [src, s.candidates.filter((c) => c.source === src).length, s.candidates.filter((c) => c.source === src && c.hired).length]),
      },
    ],
  },
  {
    name: "Onboarding Progress",
    category: "Talent",
    stats: (s) => {
      const converted = s.onboardingProgress.filter((p) => p.employeeId);
      return [
        { label: "In progress", value: s.onboardingProgress.filter((p) => !p.employeeId).length, tone: "amber" },
        { label: "Converted", value: converted.length, tone: "brand" },
        { label: "Total started", value: s.onboardingProgress.length },
        { label: "Conversion rate", value: s.onboardingProgress.length ? `${Math.round((converted.length / s.onboardingProgress.length) * 100)}%` : "—" },
      ];
    },
    tabs: [
      { name: "Register", kind: "table", columns: ["Candidate", "Started", "Status"], rows: (s) => s.onboardingProgress.map((p) => [p.candidateName, new Date(p.startedAt).toLocaleDateString("en-NG"), p.employeeId ? "Converted" : "In progress"]) },
    ],
  },
  {
    name: "Exit Analysis",
    category: "Talent",
    stats: (s) => [
      { label: "Ongoing exits", value: s.offboardingCases.filter((c) => c.status === "Ongoing").length, tone: "amber" },
      { label: "Completed", value: s.offboardingCases.filter((c) => c.status === "Completed").length },
      { label: "Total cases", value: s.offboardingCases.length },
      { label: "FNF settled", value: s.offboardingCases.filter((c) => c.fnfSettled).length, tone: "brand" },
    ],
    tabs: [
      { name: "By Reason", kind: "table", columns: ["Reason", "Count"], rows: (s) => [...new Set(s.offboardingCases.map((c) => c.reason))].map((r) => [r, s.offboardingCases.filter((c) => c.reason === r).length]) },
      { name: "Register", kind: "table", columns: ["Employee", "Reason", "Status", "Last working date"], rows: (s) => s.offboardingCases.map((c) => [nm(s, c.employeeId), c.reason, c.status, new Date(c.lastWorkingDate).toLocaleDateString("en-NG")]) },
    ],
  },
  {
    name: "Objective Completion",
    category: "Talent",
    stats: (s) => {
      const closed = s.employeeObjectives.filter((o) => o.status === "Closed").length;
      return [
        { label: "Objectives", value: s.employeeObjectives.length, tone: "brand" },
        { label: "Closed", value: closed, tone: "brand" },
        { label: "At risk / behind", value: s.employeeObjectives.filter((o) => o.status === "At Risk" || o.status === "Behind").length, tone: "action" },
        { label: "Completion rate", value: s.employeeObjectives.length ? `${Math.round((closed / s.employeeObjectives.length) * 100)}%` : "—" },
      ];
    },
    tabs: [
      { name: "By Status", kind: "kv", rows: (s) => (["Not Started", "On Track", "Behind", "At Risk", "Closed"] as const).map((st) => ({ k: st, v: s.employeeObjectives.filter((o) => o.status === st).length })) },
    ],
  },
  {
    name: "Credential Expiry",
    category: "Compliance",
    stats: (s) => {
      const withExpiry = s.documents.filter((d) => d.expiryDate);
      const expired = withExpiry.filter((d) => differenceInCalendarDays(new Date(d.expiryDate!), new Date()) < 0);
      return [
        { label: "Tracked documents", value: s.documents.length, tone: "brand" },
        { label: "With expiry date", value: withExpiry.length },
        { label: "Expired", value: expired.length, tone: expired.length ? "action" : "brand" },
        { label: "Expiring ≤ 45d", value: withExpiry.filter((d) => { const days = differenceInCalendarDays(new Date(d.expiryDate!), new Date()); return days >= 0 && days <= 45; }).length, tone: "amber" },
      ];
    },
    tabs: [
      {
        name: "Register", kind: "table", columns: ["Employee", "Document", "Category", "Expiry", "Status"],
        rows: (s) => s.documents.filter((d) => d.expiryDate).map((d) => {
          const days = differenceInCalendarDays(new Date(d.expiryDate!), new Date());
          return [nm(s, d.employeeId), d.title, d.category, new Date(d.expiryDate!).toLocaleDateString("en-NG"), days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`];
        }),
      },
    ],
  },
  {
    name: "Disciplinary Log",
    category: "Compliance",
    stats: (s) => [
      { label: "Actions recorded", value: s.disciplinaryActions.length, tone: s.disciplinaryActions.length ? "action" : "brand" },
      { label: "Employees affected", value: new Set(s.disciplinaryActions.flatMap((a) => a.employeeIds)).size },
    ],
    tabs: [
      { name: "Register", kind: "table", columns: ["Employee(s)", "Description", "Date"], rows: (s) => s.disciplinaryActions.map((a) => [a.employeeIds.map((id) => nm(s, id)).join(", "), a.description, new Date(a.startDate).toLocaleDateString("en-NG")]) },
    ],
  },
  {
    name: "HR Audit Activity",
    category: "Compliance",
    stats: (s) => {
      const hrEvents = s.auditEvents.filter((e) => e.resource.startsWith("hr/"));
      return [
        { label: "HR audit events", value: hrEvents.length, tone: "brand" },
        { label: "Distinct users", value: new Set(hrEvents.map((e) => e.user)).size },
      ];
    },
    tabs: [
      { name: "Recent Activity", kind: "table", columns: ["Timestamp", "User", "Action", "Resource"], rows: (s) => s.auditEvents.filter((e) => e.resource.startsWith("hr/")).slice(0, 20).map((e) => [new Date(e.ts).toLocaleString("en-NG"), e.user, e.action, e.resource]) },
    ],
  },
];

export const HR_REPORT_CATEGORIES = ["Workforce", "Payroll", "Talent", "Compliance"] as const;
