// Module entitlement model — the spine that makes Sabi OS a modular platform.
//
//   Organization → Product → Module → Submodule → (routes)
//
// An organization licenses one or more PRODUCTS (EMR, Workforce, Accounting).
// Each product exposes MODULES; some modules have SUBMODULES. Every app route
// belongs to exactly one module (or is always-on platform infrastructure).
// `useEntitlements` decides, for the current org, whether a route may render —
// this is the client-side stand-in for an API gateway checking entitlements.

export type ProductKey = "emr" | "workforce" | "accounting";

export const PRODUCTS: Record<ProductKey, { label: string; tagline: string }> = {
  emr: { label: "Sabi EMR", tagline: "Clinical records, diagnostics, wards, hospital operations" },
  workforce: { label: "Sabi Workforce", tagline: "Employees, org structure, recruitment, HR workflows" },
  accounting: { label: "Sabi Accounting", tagline: "General ledger, AR/AP, banking, financial reporting" },
};

export type SubmoduleDef = { key: string; label: string; routes: string[] };

export type ModuleDef = {
  key: string; // "emr.laboratory"
  product: ProductKey;
  label: string;
  description: string;
  /** route prefixes this module owns; a path matches if it === prefix or startsWith(prefix + "/") */
  routes: string[];
  core?: boolean; // cannot be disabled while its product is on (dashboards, directory…)
  submodules?: SubmoduleDef[];
};

export const MODULES: ModuleDef[] = [
  // ---------- EMR ----------
  { key: "emr.clinical", product: "emr", label: "Clinical", core: true, description: "Registration, queue, consultation, appointments, medical history",
    routes: ["/", "/queue", "/registration", "/appointments", "/consultation", "/history", "/patients", "/transfers"] },
  { key: "emr.wards", product: "emr", label: "In-patient & Wards", description: "Admissions, ward and bed management",
    routes: ["/inpatient"] },
  { key: "emr.procedures", product: "emr", label: "Procedures", description: "Minor/outpatient procedure lifecycle, safety checklist, signed notes",
    routes: ["/procedures"] },
  { key: "emr.laboratory", product: "emr", label: "Laboratory", description: "Test orders, sample workflow, results, approvals",
    routes: ["/laboratory"] },
  { key: "emr.pharmacy", product: "emr", label: "Pharmacy", description: "Dispensing and drug stock",
    routes: ["/pharmacy"] },
  { key: "emr.radiology", product: "emr", label: "Radiology", description: "Imaging requests, studies and reports",
    routes: ["/radiology"] },
  { key: "emr.mch", product: "emr", label: "Maternal & Child Health", description: "ANC, labour, PNC, family planning, child health, nutrition, immunization",
    routes: ["/anc", "/labour", "/pnc", "/family-planning", "/child-health", "/nutrition", "/immunization"] },
  { key: "emr.programs", product: "emr", label: "Public-health Programs", description: "NCDs, malaria, referrals, surveillance, outreach",
    routes: ["/ncd", "/malaria", "/referrals", "/surveillance", "/outreach"] },
  { key: "emr.billing", product: "emr", label: "Patient Billing", description: "Patient invoices and payments at the point of care",
    routes: ["/billing"] },
  { key: "emr.operations", product: "emr", label: "Facility Operations", description: "Equipment & maintenance, inventory, MSF/NHMIS reporting",
    routes: ["/equipment", "/inventory", "/msf-report", "/nhmis-sync", "/reports"] },

  // ---------- Workforce ----------
  { key: "workforce.core", product: "workforce", label: "People & Organisation", core: true, description: "Employee directory, org structure, org chart, departments",
    routes: ["/hr/dashboard", "/hr/employees", "/hr/org-chart", "/hr/org-setup", "/hr/departments", "/hris"] },
  { key: "workforce.time", product: "workforce", label: "Time & Attendance", description: "Scheduling, attendance, timesheets, leave",
    routes: ["/workforce"],
    submodules: [
      { key: "workforce.time.scheduling", label: "Scheduling", routes: ["/workforce/schedules"] },
      { key: "workforce.time.attendance", label: "Attendance", routes: ["/workforce/attendance"] },
      { key: "workforce.time.timesheets", label: "Timesheets", routes: ["/workforce/timesheets", "/workforce/approvals"] },
      { key: "workforce.time.leave", label: "Holiday & Leave", routes: ["/workforce/leave"] },
    ] },
  { key: "workforce.recruitment", product: "workforce", label: "Recruitment & Talent", description: "Vacancies, ATS pipeline, talent pool",
    routes: ["/hr/recruitment", "/hr/talent-pool", "/hr/vacancies"] },
  { key: "workforce.onboarding", product: "workforce", label: "Onboarding & Offboarding", description: "Joiner checklists, document collection, exits",
    routes: ["/hr/onboarding", "/hr/offboarding"] },
  { key: "workforce.performance", product: "workforce", label: "Performance", description: "Objectives, reviews, 1-on-1s",
    routes: ["/hr/performance"] },
  { key: "workforce.movements", product: "workforce", label: "Promotions & Transfers", description: "Promotions, branch transfers, handovers",
    routes: ["/hr/promotions", "/hr/branch-transfers"] },
  { key: "workforce.payroll", product: "workforce", label: "Payroll & Loans", description: "Salary structures, payslips, loans, reimbursements",
    routes: ["/hr/payroll"] },
  { key: "workforce.relations", product: "workforce", label: "Employee Relations", description: "Policies, disciplinary queries, helpdesk",
    routes: ["/hr/policies-discipline", "/hr/helpdesk"] },
  { key: "workforce.assets", product: "workforce", label: "Company Assets", description: "Asset register, allocations",
    routes: ["/hr/assets"] },
  { key: "workforce.reports", product: "workforce", label: "Workforce Reports", core: true, description: "HR analytics and time reports",
    routes: ["/hr/reports", "/workforce/reports"] },

  // ---------- Accounting ----------
  { key: "accounting.gl", product: "accounting", label: "General Ledger", core: true, description: "Chart of accounts, journals, trial balance, period control",
    routes: ["/accounting", "/accounting/chart-of-accounts", "/accounting/journals", "/accounting/general-ledger", "/accounting/trial-balance", "/accounting/period-end", "/accounting/setup", "/accounting/settings", "/accounting/audit-trail", "/accounting/notifications"] },
  { key: "accounting.ar", product: "accounting", label: "Accounts Receivable", description: "Customers, quotes, orders, invoices, receipts, credit notes",
    routes: ["/accounting/customers", "/accounting/quotations", "/accounting/sales-orders", "/accounting/invoices", "/accounting/sales-receipts", "/accounting/delayed-charges", "/accounting/receipts", "/accounting/credit-notes"] },
  { key: "accounting.ap", product: "accounting", label: "Accounts Payable", description: "Vendors, requisitions, POs, goods receipts, bills, payments",
    routes: ["/accounting/vendors", "/accounting/requisitions", "/accounting/purchase-orders", "/accounting/goods-receipts", "/accounting/bills", "/accounting/vendor-payments", "/accounting/vendor-credits"] },
  { key: "accounting.banking", product: "accounting", label: "Banking", description: "Bank accounts, transactions, feeds, reconciliation",
    routes: ["/accounting/bank-accounts", "/accounting/bank-transactions", "/accounting/bank-feeds", "/accounting/reconciliation"] },
  { key: "accounting.expenses", product: "accounting", label: "Expenses", description: "Expense claims, approvals, reimbursements",
    routes: ["/accounting/expenses"] },
  { key: "accounting.assets", product: "accounting", label: "Fixed Assets", description: "Asset register, depreciation, revaluation, disposal",
    routes: ["/accounting/fixed-assets"] },
  { key: "accounting.inventory", product: "accounting", label: "Inventory Accounting", description: "Valuation, COGS, stock counts, transfers, landed cost",
    routes: ["/accounting/inventory"] },
  { key: "accounting.budgets", product: "accounting", label: "Budgets & Forecasts", description: "Budgets, forecasts, projects/job costing",
    routes: ["/accounting/budgets", "/accounting/projects"] },
  { key: "accounting.tax", product: "accounting", label: "Tax", description: "Tax rates, VAT/WHT/PAYE returns, e-filing",
    routes: ["/accounting/tax"] },
  { key: "accounting.reports", product: "accounting", label: "Financial Reporting", core: true, description: "P&L, balance sheet, cash flow, consolidation",
    routes: ["/accounting/reports", "/accounting/consolidation"] },
  { key: "accounting.integrations", product: "accounting", label: "Integrations", description: "EMR billing, payroll and pharmacy → ledger bridges",
    routes: ["/accounting/integrations"] },
];

/** platform routes that render regardless of entitlements */
export const ALWAYS_ON_ROUTES = ["/audit-log", "/settings", "/platform", "/workflows"];

const matches = (path: string, prefix: string) =>
  prefix === "/" ? path === "/" : path === prefix || path.startsWith(prefix + "/");

export function moduleForRoute(path: string): ModuleDef | undefined {
  // longest prefix wins, so "/hr/org-setup" beats a hypothetical "/hr"
  let best: { m: ModuleDef; len: number } | undefined;
  for (const m of MODULES) {
    for (const r of m.routes) {
      if (matches(path, r) && (!best || r.length > best.len)) best = { m, len: r.length };
    }
  }
  return best?.m;
}

export function submoduleForRoute(path: string): { module: ModuleDef; sub: SubmoduleDef } | undefined {
  for (const m of MODULES) {
    for (const s of m.submodules ?? []) {
      for (const r of s.routes) if (matches(path, r)) return { module: m, sub: s };
    }
  }
  return undefined;
}

export const modulesByProduct = (p: ProductKey) => MODULES.filter((m) => m.product === p);
