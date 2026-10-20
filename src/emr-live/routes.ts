// Which EMR screens read and write the live hospital backend. Every other screen shows a
// "not connected yet" notice in live mode, so demo records are never shown as a hospital's data.
// Each entry names the permission the backend requires to read that screen's data (any one of a list).
export const LIVE_CONNECTED_ROUTES: Record<string, string | readonly string[]> = {
  // The home dashboard summarises the other screens; each part checks its own permission.
  "/workspace": ["queue.read", "patient.read", "lab.order.read", "prescription.read", "emr.stock.view", "billing.read", "admission.read"],
  "/registration": "patient.read",
  "/queue": "queue.read",
  // The consultation room is for clinicians who diagnose (doctors), not every queue user.
  "/consultation": "diagnosis.record",
  "/laboratory": "lab.order.read",
  // The pharmacy queue is for pharmacy staff (the backend allows reviewers and dispensers).
  "/pharmacy": "prescription.dispense",
  "/inpatient": "admission.read",
  // The billing desk (cashiers and finance); its invoice pages live under /billing/invoices/:id.
  "/billing": "billing.read",
  // The patient chart (/patients/:id) and Medical History are clinical records (doctors, nurses).
  "/patients": "clinical.read",
  "/history": "clinical.read",
  "/appointments": "appointment.read",
  "/radiology": "imaging.read",
  "/procedures": "procedure.read",
  // Antenatal care (Maternal & Child Health): doctors and nurses; admins may look.
  "/anc": "anc.read",
  // Labour & delivery and the birth register.
  "/labour": "delivery.read",
  "/pnc": "pnc.read",
  "/immunization": "immunization.read",
  "/surveillance": "surveillance.read",
  "/family-planning": "fp.read",
  "/child-health": "nutrition.read",
  "/nutrition": "nutrition.read",
  "/ncd": "programme.read",
  "/malaria": "programme.read",
  "/referrals": "referral.read",
  "/transfers": "transfer.read",
  "/outreach": "outreach.read",
  "/equipment": "equipment.read",
  "/inventory": "stores.read",
  "/settings": ["catalog.manage", "emr.formulary.manage", "lab.catalog.manage", "billing.price.manage", "membership.read"],
  "/reports": "report.view",
  "/nhmis-sync": "report.view",
  "/msf-report": "report.view",
  "/audit-log": "audit.view",
  // Workforce (people & organization)
  "/hr/employees": "hr.read",
  "/hr/org-setup": "hr.read",
  "/hr/departments": "hr.read",
  "/hr/org-chart": "hr.read",
  "/hris": "hr.read",
  // Hiring and exits; department heads raise vacancy requests
  "/hr/recruitment": "hr.read",
  "/hr/talent-pool": "hr.read",
  "/hr/onboarding": "hr.read",
  "/hr/offboarding": "hr.read",
  "/hr/vacancies": ["workforce.self", "hr.read"],
  // Careers: everyone's own objectives, reviews and 1-on-1s; promotions and transfers are HR's
  "/hr/performance": ["workforce.self", "hr.read"],
  "/hr/promotions": "hr.read",
  "/hr/branch-transfers": "hr.read",
  // Salary data is its own permission
  "/hr/payroll": "payroll.read",
  // HR services: the asset register and discipline are HR's; everyone uses the helpdesk
  "/hr/assets": "hr.read",
  "/hr/policies-discipline": "hr.read",
  "/hr/helpdesk": ["workforce.self", "hr.read"],
  // HR dashboard and reports summarise the screens above
  "/hr/dashboard": "hr.read",
  "/hr/reports": "hr.read",
  // Workforce (time & attendance, leave, work)
  "/workforce": ["workforce.self", "workforce.approve", "workforce.manage"],
  // Approval workflows: everyone's inbox, and the Builder for workflow designers
  "/workflows": ["workforce.self", "workflow.manage"],
  "/settings/workflows": "workflow.manage",
  // Organization configuration shared by every product; each list is edited by its product's owner
  "/settings/master-data": ["hr.manage", "catalog.manage", "platform.config"],
  "/settings/terminology": ["platform.config", "hr.manage"],
  "/settings/letters": ["hr.manage", "platform.config"],
  // Accounting — general ledger
  "/accounting/chart-of-accounts": "acct.view",
  "/accounting/journals": "acct.view",
  "/accounting/general-ledger": "acct.view",
  "/accounting/trial-balance": "acct.view",
  "/accounting/consolidation": "acct.view",
  // Accounting — sales & receivables
  "/accounting/customers": "acct.view",
  "/accounting/quotations": "acct.view",
  "/accounting/sales-orders": "acct.view",
  "/accounting/invoices": "acct.view",
  "/accounting/receipts": "acct.view",
  "/accounting/credit-notes": "acct.view",
  "/accounting/sales-receipts": "acct.view",
  "/accounting/delayed-charges": "acct.view",
  "/accounting/vendors": "acct.view",
  "/accounting/requisitions": "acct.view",
  "/accounting/purchase-orders": "acct.view",
  "/accounting/goods-receipts": "acct.view",
  "/accounting/bills": "acct.view",
  "/accounting/vendor-payments": "acct.view",
  "/accounting/vendor-credits": "acct.view",
  "/accounting/settings": "acct.view",
  "/accounting/bank-accounts": "acct.view",
  "/accounting/bank-transactions": "acct.view",
  "/accounting/reconciliation": "acct.view",
  "/accounting/bank-feeds": "acct.view",
  "/accounting/expenses": "acct.view",
  "/accounting/approvals": "acct.view",
  "/accounting/fixed-assets": "acct.view",
  "/accounting/budgets": "acct.view",
  "/accounting/tax": "acct.view",
  "/accounting": "acct.view",
  "/accounting/reports": "acct.view",
  "/accounting/setup": "acct.view",
  "/accounting/period-end": "acct.view",
  "/accounting/audit-trail": "acct.view",
  "/accounting/projects": "acct.view",
  "/accounting/notifications": "acct.view",
};

export type LiveRouteState = "connected" | "no-permission" | "not-connected";

/** Sub-pages that are separate tools, not part of the connected screen above them (platform tools under /settings). */
const NOT_SUB_PAGES: string[] = [];

/** The connected screen a path belongs to: the screen itself or one of its sub-pages (/billing/invoices/…). */
const connectedScreen = (path: string) => {
  if (LIVE_CONNECTED_ROUTES[path]) return path;
  if (NOT_SUB_PAGES.some((tool) => path === tool || path.startsWith(`${tool}/`))) return undefined;
  return Object.keys(LIVE_CONNECTED_ROUTES).find((screen) => path.startsWith(`${screen}/`));
};

export function liveRouteState(path: string, permissions: readonly string[]): LiveRouteState {
  const screen = connectedScreen(path);
  const required = screen ? LIVE_CONNECTED_ROUTES[screen] : undefined;
  if (!required) return "not-connected";
  return [required].flat().some((permission) => permissions.includes(permission)) ? "connected" : "no-permission";
}
