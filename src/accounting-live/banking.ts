import { create } from "zustand";
import { useBanking } from "@/store/accounting/useBanking";
import { claimTotal, useExpenses } from "@/store/accounting/useExpenses";
import { useLedger } from "@/store/accounting/useLedger";
import { accountingRequest } from "@/emr-live/client";
import type { BankAccountMeta, BankReconciliation, BankStatementLine, ReconciliationRule } from "@/data/accounting/banking";
import type { ExpenseClaim } from "@/data/accounting/expenses";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";

// Banking and expense claims in live mode (GET /banking, GET /expenses). Bank accounts are the ledger's bank
// and cash accounts; transfers, bank transactions, booked statement lines and claims post through the
// server's ledger, and reconciliations are kept and checked there. Live bank feeds need an open-banking
// provider, which is not configured: connecting one says so rather than linking a simulated feed.

type Versioned = { version?: number };
type ApiBanking = {
  accounts: (BankAccountMeta & Versioned)[]; statementLines: BankStatementLine[]; reconciliations: (BankReconciliation & Versioned)[];
  reconciliationRules: (ReconciliationRule & Versioned)[]; feedProvider: string | null;
};

export const useLiveBankingMeta = create<{ loaded: boolean; expensesLoaded: boolean; feedProvider: string | null }>(() => ({ loaded: false, expensesLoaded: false, feedProvider: null }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as T;
const FEED_UNAVAILABLE = "Live bank feeds need an open-banking provider, and none is configured for this deployment. Import a statement instead.";

export async function loadBanking() {
  const { data } = await accountingRequest<{ data: ApiBanking }>("/banking");
  useLiveBankingMeta.setState({ loaded: true, feedProvider: data.feedProvider });
  useBanking.setState({
    accounts: data.accounts.map((a) => noNull(a)), statementLines: data.statementLines.map((l) => noNull(l)), reconciliations: data.reconciliations.map((r) => noNull(r)),
    reconciliationRules: data.reconciliationRules.map((r) => noNull(r)), connections: [],
  });
  adoptLiveIdentity(null);
}
export async function loadExpenses() {
  const { data } = await accountingRequest<{ data: { claims: (ExpenseClaim & Versioned)[] } }>("/expenses");
  useLiveBankingMeta.setState({ expensesLoaded: true });
  useExpenses.setState({ claims: data.claims.map((c) => noNull(c)) });
  adoptLiveIdentity(null);
}

const reloadBank = async () => { await Promise.all([loadBanking(), loadLedger()]); };
const reloadClaims = async () => { await Promise.all([loadExpenses(), loadLedger()]); };
const B = () => useBanking.getState();
const post = (path: string, body: unknown = {}) => accountingRequest(path, { method: "POST", body });
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const isBank = (n: number) => { const a = useLedger.getState().accounts.find((x) => x.number === n); return !!a && (a.subtype === "bank" || a.subtype === "cash"); };
const ruleCovers = (r: ReconciliationRule, l: BankStatementLine) =>
  (!r.descriptionContains || l.description.toUpperCase().includes(r.descriptionContains.toUpperCase())) && (r.direction !== "in" || l.amount > 0) && (r.direction !== "out" || l.amount < 0);

export function goLiveBanking() {
  useBanking.setState({
    connectBank: () => ({ ok: false, error: FEED_UNAVAILABLE }),
    disconnectBank: () => {},
    syncFeed: () => ({ imported: 0, autoMatched: 0 }),

    addRule: (r) => { void liveChange(() => post("/banking/rules", defined({ id: uuid(), ...r })), reloadBank); },
    updateRule: (id, change) => {
      const version = (B().reconciliationRules.find((x) => x.id === id) as (ReconciliationRule & Versioned) | undefined)?.version ?? 1;
      const body = defined({ name: change.name, descriptionContains: change.descriptionContains, direction: change.direction, contraAccount: change.contraAccount, memo: change.memo, active: change.active });
      void liveChange(() => accountingRequest(`/banking/rules/${id}`, { method: "PATCH", body, version }), reloadBank, () => useBanking.setState((s) => ({ reconciliationRules: s.reconciliationRules.map((x) => (x.id === id ? { ...x, ...change } : x)) })));
    },
    // A rule stays on record; removing it switches it off.
    removeRule: (id) => B().updateRule(id, { active: false }),
    applyRulesTo: (accountNumber) => {
      const rules = B().reconciliationRules.filter((r) => r.active && r.accountNumber === accountNumber);
      const matched = B().unclearedStatementLines(accountNumber).filter((l) => rules.some((r) => ruleCovers(r, l))).length;
      if (matched) void liveChange(() => post(`/banking/accounts/${accountNumber}/apply-rules`), reloadBank);
      return { matched };
    },

    addBankAccount: (input) => {
      const existing = useLedger.getState().accounts.find((a) => a.number === input.number);
      if (existing && !isBank(input.number)) return { ok: false, error: `Account ${input.number} already exists and is not a bank or cash account.` };
      if (B().metaFor(input.number) && B().accounts.find((a) => a.accountNumber === input.number && !a.id.startsWith("gl-"))) return { ok: false, error: `Account ${input.number} already has bank details.` };
      void liveChange(() => post("/banking/accounts", defined({ ...input, openingBalance: input.openingBalance || undefined })), reloadBank);
      return { ok: true };
    },

    recordTransfer: (input) => {
      if (input.fromAccount === input.toAccount) return { ok: false, error: "Pick two different accounts." };
      if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
      void liveChange(() => post("/banking/transfers", defined({ id: uuid(), ...input })), reloadBank);
      return { ok: true };
    },
    recordBankLine: (input) => {
      if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
      void liveChange(() => post("/banking/transactions", defined({ ...input })), reloadBank);
      return { ok: true };
    },

    importStatementLines: (accountNumber, lines) => { void liveChange(() => post("/banking/statement-lines/import", { accountNumber, lines: lines.map((l) => defined({ ...l })) }), reloadBank); },
    clearStatementLine: (lineId, matchedJournalEntryId) => {
      void liveChange(() => post(`/banking/statement-lines/${lineId}/match`, defined({ matchedJournalEntryId })), reloadBank,
        () => useBanking.setState((s) => ({ statementLines: s.statementLines.map((l) => (l.id === lineId ? { ...l, reconciled: true, matchedJournalEntryId } : l)) })));
    },
    addStatementLineToBooks: (lineId, contraAccount) => {
      const line = B().statementLines.find((l) => l.id === lineId);
      if (!line) return { ok: false, error: "Line not found." };
      if (line.reconciled) return { ok: false, error: "This statement line has already been cleared." };
      void liveChange(() => post(`/banking/statement-lines/${lineId}/book`, { contraAccount }), reloadBank);
      return { ok: true };
    },

    startReconciliation: (accountNumber, statementDate, closingBalance) => {
      const id = uuid();
      void liveChange(() => post("/banking/reconciliations", { id, accountNumber, statementDate, closingBalance }), reloadBank);
      return id;
    },
    toggleCleared: (reconId, movementKey) => {
      void liveChange(() => post(`/banking/reconciliations/${reconId}/toggle`, { movementKey }), reloadBank, () => useBanking.setState((s) => ({
        reconciliations: s.reconciliations.map((r) => (r.id !== reconId ? r : { ...r, reconciledLineIds: r.reconciledLineIds.includes(movementKey) ? r.reconciledLineIds.filter((k) => k !== movementKey) : [...r.reconciledLineIds, movementKey] })),
      })));
    },
    completeReconciliation: (reconId) => {
      const p = B().reconciliationProgress(reconId);
      if (Math.abs(p.difference) > 0.01) return { ok: false, error: `Still ${Math.abs(p.difference).toLocaleString()} out — clear or add the missing items.` };
      void liveChange(() => post(`/banking/reconciliations/${reconId}/complete`), reloadBank);
      return { ok: true };
    },
  });

  const C = () => useExpenses.getState();
  const claimBody = (c: Partial<ExpenseClaim>) => defined({
    date: c.date, title: c.title, costCenter: c.costCenter, payMode: c.payMode, paidFromAccount: c.payMode === "Bank — direct" ? c.paidFromAccount : undefined, receiptRef: c.receiptRef,
    lines: c.lines?.map((l) => defined({ id: l.id, accountNumber: l.accountNumber, description: l.description, amount: l.amount, taxRateId: l.taxRateId })),
  });
  useExpenses.setState({
    createClaim: (input) => {
      const id = uuid(); // changes run in order, so a submit right after this lands on the saved claim
      void liveChange(() => post("/expenses", { id, ...(input.claimantId ? { claimantId: input.claimantId } : {}), ...claimBody(input) }), reloadClaims);
      return id;
    },
    updateClaim: (id, change) => {
      const version = (C().claims.find((x) => x.id === id) as (ExpenseClaim & Versioned) | undefined)?.version ?? 1;
      void liveChange(() => accountingRequest(`/expenses/${id}`, { method: "PATCH", body: claimBody(change), version }), reloadClaims);
    },
    submitClaim: (id) => { void liveChange(() => post(`/expenses/${id}/submit`), reloadClaims); },
    decideClaim: (id, decision, comment) => { void liveChange(() => post(`/expenses/${id}/decide`, defined({ decision, comment })), reloadClaims); },
    payClaim: (id, fromAccount) => {
      const c = C().claimById(id);
      if (!c || c.status !== "Approved" || c.payMode !== "Reimburse to staff") return { ok: false, error: "Nothing to reimburse." };
      if (claimTotal(c.lines) <= 0) return { ok: false, error: "Nothing to reimburse." };
      void liveChange(() => post(`/expenses/${id}/pay`, { fromAccount }), reloadClaims);
      return { ok: true };
    },
    deleteDraft: (id) => {
      void liveChange(() => post(`/expenses/${id}/discard`), reloadClaims, () => useExpenses.setState((s) => ({ claims: s.claims.filter((c) => !(c.id === id && c.status === "Draft")) })));
    },
  });
}

export function clearBanking() {
  useLiveBankingMeta.setState({ loaded: false, feedProvider: null });
  useBanking.setState({ accounts: [], statementLines: [], reconciliations: [], connections: [], reconciliationRules: [] });
}
export function clearExpenses() {
  useLiveBankingMeta.setState({ expensesLoaded: false });
  useExpenses.setState({ claims: [] });
}
