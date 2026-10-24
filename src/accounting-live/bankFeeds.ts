import { accountingRequest, describeEmrError } from "@/emr-live/client";
import { useLiveEmr } from "@/emr-live/session";
import { loadBanking } from "./banking";
import { loadLedger } from "./ledger";

// Live bank feeds through Mono: the hospital consents in Mono's own Connect widget (its bank login never
// touches Sabi); the widget hands back a one-time code, which the server exchanges with its secret key and
// then pulls the account's transactions into the bank's statement lines. Sync and disconnect are the
// server's too; the books reload after each.

type MonoWidget = { setup: () => void; open: () => void };
type MonoConnectCtor = new (options: {
  key: string; scope?: string; data?: { customer: { name: string; email: string } };
  onSuccess: (r: { code: string }) => void; onClose?: () => void; onLoad?: () => void;
}) => MonoWidget;
declare global { interface Window { Connect?: MonoConnectCtor } }

const WIDGET = "https://connect.withmono.com/connect.js";
let loading: Promise<MonoConnectCtor> | null = null;
/** Loads Mono's Connect widget once. */
function monoConnect(): Promise<MonoConnectCtor> {
  if (window.Connect) return Promise.resolve(window.Connect);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = WIDGET; s.async = true;
    s.onload = () => (window.Connect ? resolve(window.Connect) : reject(new Error("Mono's widget did not load.")));
    s.onerror = () => { loading = null; reject(new Error("Mono's widget could not be reached. Check the connection and try again.")); };
    document.head.appendChild(s);
  });
  return loading;
}
const reload = async () => { await Promise.all([loadBanking().catch(() => undefined), loadLedger().catch(() => undefined)]); };

/** Opens Mono's consent screen for a bank account and links it; resolves with a sentence for the screen. */
export async function connectBankFeed(accountNumber: number, publicKey: string): Promise<string> {
  let Connect: MonoConnectCtor;
  try { Connect = await monoConnect(); } catch (cause) { return (cause as Error).message; }
  const session = useLiveEmr.getState();
  return new Promise((resolve) => {
    let done = false;
    const widget = new Connect({
      key: publicKey, scope: "auth",
      data: { customer: { name: session.access?.organizationName ?? "Hospital", email: session.user?.email ?? "" } },
      onSuccess: async ({ code }) => {
        done = true;
        try {
          const { data } = await accountingRequest<{ data: { imported: number; autoMatched: number } }>("/banking/connections", { method: "POST", body: { accountNumber, code } });
          resolve(`Bank connected. ${data.imported} transaction(s) pulled; ${data.autoMatched} posted by your rules. The rest are waiting in Reconciliation.`);
        } catch (cause) {
          resolve(describeEmrError(cause));
        } finally { await reload(); }
      },
      onClose: () => { if (!done) resolve("The bank was not connected (the consent screen was closed)."); },
    });
    widget.setup();
    widget.open();
  });
}
export async function syncBankFeed(id: string): Promise<string> {
  try {
    const { data } = await accountingRequest<{ data: { imported: number; autoMatched: number } }>(`/banking/connections/${id}/sync`, { method: "POST", body: {} });
    return data.imported ? `Pulled ${data.imported} new transaction(s); ${data.autoMatched} posted by your rules. The rest are in Reconciliation.` : "Up to date — no new transactions from the bank.";
  } catch (cause) {
    return describeEmrError(cause);
  } finally { await reload(); }
}
export async function disconnectBankFeed(id: string): Promise<string> {
  try {
    await accountingRequest(`/banking/connections/${id}/disconnect`, { method: "POST", body: {} });
    return "Bank feed disconnected. Transactions already pulled stay in the account.";
  } catch (cause) {
    return describeEmrError(cause);
  } finally { await reload(); }
}
