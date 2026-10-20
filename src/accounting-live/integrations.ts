import { create } from "zustand";
import { useIntegrations, type SyncResult } from "@/store/useIntegrations";
import { accountingRequest } from "@/emr-live/client";
import { useLiveEmr } from "@/emr-live/session";
import { liveChange } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";
import { loadReceivables } from "./receivables";

// Integrations in live mode (GET /integrations, POST /integrations/sync): the server reads the
// organization's own EMR invoices and payments, payslips, pharmacy dispenses and store movements and posts each one to the
// books exactly once, so the screen shows what is still waiting and a sync can be run any number of times.
// Auto-sync (the screen's checkbox) runs that sync when the books load.

type Pending = { emrBilling: number; payrollAccrual: number; payrollSettlement: number; pharmacy: number; stores: number };
type ApiStatus = { pending: Pending; lastSyncAt: string | null };
type Module = "EMR Billing" | "Payroll" | "Pharmacy" | "Stores";

const ALL: Module[] = ["EMR Billing", "Payroll", "Pharmacy", "Stores"];
const NONE: Pending = { emrBilling: 0, payrollAccrual: 0, payrollSettlement: 0, pharmacy: 0, stores: 0 };
export const useLiveIntegrationsMeta = create<{ loaded: boolean; pending: Pending }>(() => ({ loaded: false, pending: NONE }));

const adopt = (data: ApiStatus) => {
  useLiveIntegrationsMeta.setState({ loaded: true, pending: data.pending ?? NONE });
  useIntegrations.setState({ lastSyncAt: data.lastSyncAt ?? undefined });
};
// Auto-sync: while it is on, loading the books runs a sync for someone who may post — at most every few
// minutes, so a record the server keeps refusing never loops.
const AUTO_EVERY_MS = 5 * 60_000;
let autoRanAt = 0;
const mayPost = () => (useLiveEmr.getState().access?.permissions ?? []).some((p) => p === "acct.post" || p === "acct.control");

export async function loadIntegrations() {
  const { data } = await accountingRequest<{ data: ApiStatus }>("/integrations");
  adopt(data);
  const waiting = Object.values(data.pending ?? NONE).some((n) => n > 0);
  if (waiting && useIntegrations.getState().autoSync && mayPost() && Date.now() - autoRanAt > AUTO_EVERY_MS) {
    autoRanAt = Date.now();
    run(ALL);
  }
}

const reload = async () => { await Promise.all([loadIntegrations(), loadLedger(), loadReceivables()]); };
function run(modules: Module[]): SyncResult[] {
  void liveChange(async () => {
    const { data } = await accountingRequest<{ data: ApiStatus & { results: SyncResult[] } }>("/integrations/sync", { method: "POST", body: { modules } });
    adopt(data);
    const results = data.results ?? [];
    useIntegrations.setState((s) => ({ results: [...results, ...s.results.filter((x) => !results.some((r) => r.module === x.module))] }));
  }, reload);
  // the server's counts arrive with the response
  return modules.map((module) => ({ module, created: 0, skipped: 0, errors: [] }));
}

export function goLiveIntegrations() {
  useIntegrations.setState({
    pendingCounts: () => useLiveIntegrationsMeta.getState().pending,
    syncEmrBilling: () => run(["EMR Billing"])[0],
    syncPayroll: () => run(["Payroll"])[0],
    syncPharmacy: () => run(["Pharmacy"])[0],
    syncStores: () => run(["Stores"])[0],
    syncAll: () => run(ALL),
  });
}

export function clearIntegrations() {
  useLiveIntegrationsMeta.setState({ loaded: false, pending: NONE });
  useIntegrations.setState({ results: [], lastSyncAt: undefined });
}
