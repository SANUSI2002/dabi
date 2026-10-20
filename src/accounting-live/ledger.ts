import { create } from "zustand";
import { useLedger, type DraftLine } from "@/store/accounting/useLedger";
import { coaTemplates } from "@/data/accounting/coaTemplates";
import { accountingRequest } from "@/emr-live/client";
import type { Account, AccountSubtype, AccountType } from "@/data/accounting/coa";
import type { JournalEntry } from "@/data/accounting/journal";
import type { AccountingPeriod, FiscalYear } from "@/data/accounting/fiscal";
import type { Branch, ConsolidationGroup } from "@/data/accounting/branches";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import type { ApprovalRule } from "@/data/accounting/control";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";

// The general ledger in live mode (GET /ledger): the organization's chart, branches, fiscal calendar and
// journal entries. Actions answer at once from the same checks the screens always ran (balance, locks),
// then the server checks again and has the final word — a refusal shows in the banner and the books
// reload. Balances stay derived from the posted entries, as before.

type Versioned = { version?: number };
type ApiLedger = {
  accounts: (Account & Versioned)[]; branches: Branch[]; consolidationGroups: ConsolidationGroup[]; fiscalYears: FiscalYear[]; periods: AccountingPeriod[];
  booksLockedBefore: string | null; fxRates: ReturnType<typeof useLedger.getState>["fxRates"]; settingsVersion: number; entries: (JournalEntry & Versioned)[];
  recurringJournals: (ReturnType<typeof useLedger.getState>["recurringJournals"][number] & Versioned)[]; yearEndClosings: ReturnType<typeof useLedger.getState>["yearEndClosings"];
  approvalRules: (ApprovalRule & Versioned)[];
};

export const useLiveLedgerMeta = create<{ loaded: boolean; settingsVersion: number }>(() => ({ loaded: false, settingsVersion: 1 }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as T;

export async function loadLedger() {
  const { data } = await accountingRequest<{ data: ApiLedger }>("/ledger");
  useLiveLedgerMeta.setState({ loaded: true, settingsVersion: data.settingsVersion });
  const active = useLedger.getState().activeBranchId;
  useLedger.setState({
    accounts: data.accounts.map((a) => noNull(a)), branches: data.branches, consolidationGroups: data.consolidationGroups, fiscalYears: data.fiscalYears, periods: data.periods,
    booksLockedBefore: data.booksLockedBefore, fxRates: data.fxRates, entries: data.entries.map((e) => ({ ...noNull(e), lines: e.lines.map((l) => noNull(l)) })),
    recurringJournals: data.recurringJournals.map((r) => noNull(r)), yearEndClosings: data.yearEndClosings,
    activeBranchId: data.branches.some((b) => b.id === active) ? active : data.branches.find((b) => b.isHeadOffice)?.id ?? data.branches[0]?.id ?? active,
  });
  useAcctControl.setState({ rules: data.approvalRules }); // the approval rules are kept with the books
  adoptLiveIdentity(null); // the finance role the Accounting screens check comes from the live permissions
}

const reload = () => loadLedger();
const L = () => useLedger.getState();
const send = (path: string, method: "POST" | "PATCH" | "PUT", body: unknown, version?: number) => accountingRequest(`/ledger${path}`, { method, body, ...(version !== undefined ? { version } : {}) });
const versionOf = (list: ({ id: string } & Versioned)[], id: string) => list.find((x) => x.id === id)?.version ?? 1;
const lineBody = (lines: DraftLine[]) => lines.filter((l) => (l.debit || 0) !== 0 || (l.credit || 0) !== 0).map((l) => Object.fromEntries(Object.entries({
  accountNumber: l.accountNumber, debit: l.debit || 0, credit: l.credit || 0, description: l.description || undefined, costCenter: l.costCenter || undefined,
  customerId: l.customerId, vendorId: l.vendorId, projectId: l.projectId,
}).filter(([, v]) => v !== undefined)));
const accountBody = (a: { number: number; name: string; type: AccountType; subtype: AccountSubtype; parentNumber?: number; description?: string; openingBalance?: number; allowManualEntry?: boolean }) =>
  Object.fromEntries(Object.entries({ number: a.number, name: a.name, type: a.type, subtype: a.subtype, parentNumber: a.parentNumber, description: a.description || undefined, openingBalance: a.openingBalance || undefined, allowManualEntry: a.allowManualEntry }).filter(([, v]) => v !== undefined));

export function goLiveLedger() {
  useLedger.setState({
    postJournal: (input) => {
      const check = L().validateLines(input.lines);
      if (!check.ok) return { ok: false, error: check.error };
      const status = input.status === "Draft" ? "Draft" : "Posted";
      if (status === "Posted") { const lock = L().isDateLocked(input.date); if (lock.locked) return { ok: false, error: lock.reason }; }
      const id = uuid();
      const entry: JournalEntry = {
        id, number: "Saving…", date: input.date, branchId: input.branchId ?? L().activeBranchId, source: input.source, reference: input.reference, memo: input.memo, status,
        lines: input.lines.map((l, i) => ({ id: `${id}-${i}`, accountNumber: l.accountNumber, debit: l.debit || 0, credit: l.credit || 0, description: l.description })), createdBy: "", createdAt: new Date().toISOString(),
      };
      void liveChange(() => send("/entries", "POST", Object.fromEntries(Object.entries({ id, date: input.date, memo: input.memo, reference: input.reference || undefined, lines: lineBody(input.lines), status, branchId: input.branchId ?? L().activeBranchId }).filter(([, v]) => v !== undefined))), reload,
        () => useLedger.setState((s) => ({ entries: [entry, ...s.entries] })));
      return { ok: true, entry };
    },
    updateDraft: (id, patch) => {
      void liveChange(() => send(`/entries/${id}`, "PATCH", Object.fromEntries(Object.entries({ date: patch.date, memo: patch.memo, reference: patch.reference, lines: patch.lines ? lineBody(patch.lines) : undefined }).filter(([, v]) => v !== undefined)), versionOf(L().entries, id)), reload);
    },
    postDraft: (id) => {
      const e = L().entries.find((x) => x.id === id);
      if (!e || e.status !== "Draft") return { ok: false, error: "Not a draft." };
      const check = L().validateLines(e.lines);
      if (!check.ok) return { ok: false, error: check.error };
      const lock = L().isDateLocked(e.date);
      if (lock.locked) return { ok: false, error: lock.reason };
      void liveChange(() => send(`/entries/${id}/post`, "POST", {}, versionOf(L().entries, id)), reload);
      return { ok: true };
    },
    voidDraft: (id) => { void liveChange(() => send(`/entries/${id}/void`, "POST", {}, versionOf(L().entries, id)), reload); },
    reverseEntry: (id, opts) => {
      const orig = L().entries.find((x) => x.id === id);
      if (!orig) return { ok: false, error: "Entry not found." };
      if (orig.status !== "Posted") return { ok: false, error: orig.reversedByEntryId ? "This entry has already been reversed." : "Only a posted entry can be reversed." };
      const lock = L().isDateLocked(opts?.date ?? new Date().toISOString());
      if (lock.locked) return { ok: false, error: lock.reason };
      void liveChange(() => send(`/entries/${id}/reverse`, "POST", Object.fromEntries(Object.entries({ date: opts?.date, memo: opts?.memo }).filter(([, v]) => v !== undefined))), reload);
      return { ok: true };
    },

    addAccount: (a) => {
      if (L().accountByNumber(a.number)) return { ok: false, error: `Account ${a.number} already exists.` };
      if (a.number < 1000 || a.number > 5999) return { ok: false, error: "Use a number between 1000 and 5999." };
      void liveChange(() => send("/accounts", "POST", accountBody(a)), reload);
      return { ok: true };
    },
    applyCoaTemplate: (templateId) => {
      const tmpl = coaTemplates.find((t) => t.id === templateId);
      if (!tmpl) return { added: 0, skipped: 0 };
      const added = tmpl.accounts.filter((t) => !L().accountByNumber(t.number)).length;
      void liveChange(() => send("/accounts/template", "POST", { templateId }), reload);
      return { added, skipped: tmpl.accounts.length - added };
    },
    importAccounts: (rows) => {
      const validTypes = ["asset", "liability", "equity", "revenue", "expense", "cogs"];
      const errors: string[] = [];
      const good: Record<string, unknown>[] = [];
      for (const [i, r] of rows.entries()) {
        const number = Number(r.number ?? r["account number"] ?? r["account_number"]);
        const name = r.name ?? r["account name"] ?? "";
        const type = (r.type ?? "").toLowerCase() as AccountType;
        if (!number || !name) { errors.push(`Row ${i + 2}: missing number or name`); continue; }
        if (!validTypes.includes(type)) { errors.push(`Row ${i + 2}: bad type "${r.type}"`); continue; }
        good.push(accountBody({ number, name, type, subtype: (r.subtype ?? "operating_expense").toLowerCase() as AccountSubtype, openingBalance: Number(r.opening_balance ?? r["opening balance"] ?? 0) || 0 }));
      }
      if (good.length) void liveChange(() => send("/accounts/import", "POST", { rows: good }), reload);
      return { added: good.length, errors };
    },
    updateAccount: (id, patch) => {
      const a = L().accountById(id);
      if (!a) return;
      void liveChange(() => send(`/accounts/${a.number}`, "PATCH", Object.fromEntries(Object.entries({ ...patch, description: patch.description }).filter(([, v]) => v !== undefined)), versionOf(L().accounts, id)), reload,
        () => useLedger.setState((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })));
    },
    archiveAccount: (id) => {
      const a = L().accountById(id);
      if (a) void liveChange(() => send(`/accounts/${a.number}`, "PATCH", { isActive: false }, versionOf(L().accounts, id)), reload);
    },

    addBranch: (b) => { void liveChange(() => send("/branches", "POST", { id: uuid(), code: b.code, name: b.name }), reload); },
    addConsolidationGroup: (name, branchIds) => { void liveChange(() => send("/consolidation-groups", "POST", { id: uuid(), name, branchIds }), reload); },

    setPeriodStatus: (id, status) => { void liveChange(() => send(`/periods/${id}/status`, "POST", { status }), reload, () => useLedger.setState((s) => ({ periods: s.periods.map((p) => (p.id === id ? { ...p, status } : p)) }))); },
    setBooksLockedBefore: (date) => { void liveChange(() => send("/lock", "PUT", { booksLockedBefore: date }, useLiveLedgerMeta.getState().settingsVersion), reload); },
    openFiscalYear: (year) => { if (!L().fiscalYears.some((f) => f.year === year)) void liveChange(() => send("/fiscal-years", "POST", { year }), reload); },
    closeFiscalYear: (year) => {
      const preview = L().previewYearEndClose(year);
      if (!preview.canClose) return { ok: false, error: preview.reason ?? "Cannot close this year." };
      void liveChange(() => send(`/year-end/${year}/close`, "POST", {}), reload);
      return { ok: true };
    },

    addRecurringJournal: (input) => {
      const check = L().validateLines(input.lines);
      if (!check.ok) return { ok: false, error: check.error };
      if (input.everyMonths < 1) return { ok: false, error: "Cadence must be at least 1 month." };
      void liveChange(() => send("/recurring", "POST", Object.fromEntries(Object.entries({ id: uuid(), memo: input.memo, lines: lineBody(input.lines), everyMonths: input.everyMonths, startDate: input.startDate, endDate: input.endDate }).filter(([, v]) => v !== undefined))), reload);
      return { ok: true };
    },
    updateRecurringJournal: (id, patch) => { void liveChange(() => send(`/recurring/${id}`, "PATCH", patch, versionOf(L().recurringJournals, id)), reload); },
    // A recurring journal that has posted stays on record; removing it switches it off.
    removeRecurringJournal: (id) => { void liveChange(() => send(`/recurring/${id}`, "PATCH", { active: false }, versionOf(L().recurringJournals, id)), reload); },
    runRecurringJournals: (asOf) => {
      const posted = L().dueRecurringJournals(asOf).length;
      void liveChange(() => send("/recurring/run", "POST", { asOf }), reload);
      return { posted };
    },
  });
}

export function clearLedger() {
  useLiveLedgerMeta.setState({ loaded: false, settingsVersion: 1 });
  useLedger.setState({ entries: [], recurringJournals: [], yearEndClosings: [], consolidationGroups: [] });
  useAcctControl.setState({ rules: [] });
}
