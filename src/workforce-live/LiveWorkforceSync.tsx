import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLiveEmr } from "@/emr-live/session";
import { clearPeople, goLivePeople, loadPeople } from "./people";
import { clearTime, goLiveTime, loadDirectory, loadTime } from "./time";
import { clearWorkflows, goLiveWorkflows, loadWorkflows } from "./workflows";
import { clearHiring, goLiveHiring, loadHiring } from "./hiring";
import { clearCareers, goLiveCareers, loadCareers } from "./careers";
import { clearPayroll, goLivePayroll, loadPayroll } from "./payroll";
import { clearServices, goLiveServices, loadServices } from "./services";
import { clearAudit, goLiveAudit, loadHrAudit } from "./audit";
import { clearOrgConfig, goLiveOrgConfig, loadOrgConfig } from "./orgConfig";
import { clearLedger, goLiveLedger, loadLedger } from "@/accounting-live/ledger";
import { clearAcctSettings, goLiveAcctSettings, loadAcctSettings } from "@/accounting-live/settings";
import { clearReceivables, goLiveReceivables, loadReceivables } from "@/accounting-live/receivables";
import { clearPayables, goLivePayables, loadPayables } from "@/accounting-live/payables";
import { clearBanking, clearExpenses, goLiveBanking, loadBanking, loadExpenses } from "@/accounting-live/banking";
import { clearAssets, clearPlanning, goLiveAssets, loadAssets, loadPlanning } from "@/accounting-live/assets";
import { clearAcctAudit, goLiveAcctAudit, loadAcctAudit } from "@/accounting-live/audit";
import { clearProjects, goLiveProjects, loadProjects } from "@/accounting-live/projects";
import { clearIntegrations, goLiveIntegrations, loadIntegrations } from "@/accounting-live/integrations";
import { useWorkforceSync } from "./sync";

// Mounted once in the live shell. Each Workforce domain fills its stores from the organization's
// records when the signed-in role may read them, and is emptied otherwise — demo people never show
// in a live hospital. Failed changes appear in the banner.

type Domain = { permissions: string[]; goLive: () => void; load: () => Promise<void>; clear: () => void; fallback?: { permissions: string[]; load: () => Promise<void> } };
const DOMAINS: Domain[] = [
  // HR sees full people records; everyone else gets the names-only directory (rosters, approvals).
  { permissions: ["hr.read"], goLive: goLivePeople, load: loadPeople, clear: clearPeople, fallback: { permissions: ["workforce.directory"], load: loadDirectory } },
  { permissions: ["workforce.self", "workforce.approve", "workforce.manage"], goLive: goLiveTime, load: loadTime, clear: clearTime },
  // Approval workflows: the Builder (workflow.manage) and everyone's Approvals inbox.
  { permissions: ["workforce.self", "workflow.manage"], goLive: goLiveWorkflows, load: loadWorkflows, clear: clearWorkflows },
  // Hiring and exits for HR; vacancy requests for department heads.
  { permissions: ["hr.read", "workforce.self"], goLive: goLiveHiring, load: loadHiring, clear: clearHiring },
  // Performance for everyone (their own objectives and reviews); promotions and transfers for HR.
  { permissions: ["hr.read", "workforce.self"], goLive: goLiveCareers, load: loadCareers, clear: clearCareers },
  // Salary data: payroll staff only.
  { permissions: ["payroll.read"], goLive: goLivePayroll, load: loadPayroll, clear: clearPayroll },
  // Assets, helpdesk and queries: everyone's own requests and tickets; HR sees all.
  { permissions: ["hr.read", "workforce.self"], goLive: goLiveServices, load: loadServices, clear: clearServices },
  // The HR audit trail for HR; the browser's own audit log is off for everyone (the server keeps it).
  { permissions: ["hr.read"], goLive: goLiveAudit, load: loadHrAudit, clear: clearAudit },
  // Master data, terminology and letter templates: every member reads them (the server checks changes).
  { permissions: ["*"], goLive: goLiveOrgConfig, load: loadOrgConfig, clear: clearOrgConfig },
  // Accounting: the general ledger for finance staff.
  { permissions: ["acct.view", "acct.control"], goLive: goLiveLedger, load: loadLedger, clear: clearLedger },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveAcctSettings, load: loadAcctSettings, clear: clearAcctSettings },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveReceivables, load: loadReceivables, clear: clearReceivables },
  { permissions: ["acct.view", "acct.control"], goLive: goLivePayables, load: loadPayables, clear: clearPayables },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveBanking, load: loadBanking, clear: clearBanking },
  { permissions: ["acct.view", "acct.control"], goLive: () => {}, load: loadExpenses, clear: clearExpenses },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveAssets, load: loadAssets, clear: clearAssets },
  { permissions: ["acct.view", "acct.control"], goLive: () => {}, load: loadPlanning, clear: clearPlanning },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveAcctAudit, load: loadAcctAudit, clear: clearAcctAudit },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveProjects, load: loadProjects, clear: clearProjects },
  { permissions: ["acct.view", "acct.control"], goLive: goLiveIntegrations, load: loadIntegrations, clear: clearIntegrations },
];
const holds = (permissions: readonly string[], wanted: string[]) => wanted.some((p) => p === "*" || permissions.includes(p));

export function LiveWorkforceSync() {
  const permissions = useLiveEmr((s) => s.access?.permissions);
  const error = useWorkforceSync((s) => s.error);

  useEffect(() => {
    if (!permissions) return;
    for (const domain of DOMAINS) {
      domain.clear(); // never show demo records in a live organization, even while loading
      const load = holds(permissions, domain.permissions) ? domain.load : domain.fallback && holds(permissions, domain.fallback.permissions) ? domain.fallback.load : null;
      domain.goLive();
      if (!load) continue;
      load().catch((cause) => {
        domain.clear();
        useWorkforceSync.getState().report(cause instanceof Error ? cause.message : "Workforce records could not be loaded.");
      });
    }
  }, [permissions]);

  if (!error) return null;
  return (
    <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl bg-action-50 px-4 py-3 text-sm text-action-800 shadow-lg ring-1 ring-action-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1">{error}</p>
      <button aria-label="Dismiss" onClick={() => useWorkforceSync.getState().dismiss()} className="text-action-600 hover:text-action-800"><X size={15} /></button>
    </div>
  );
}
