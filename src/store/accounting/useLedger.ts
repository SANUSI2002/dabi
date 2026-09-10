import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import {
  seedAccounts,
  normalBalanceOf,
  isDebitNormal,
  type Account,
  type AccountType,
  type AccountSubtype,
} from "@/data/accounting/coa";
import {
  seedJournalEntries,
  seedFxRates,
  type JournalEntry,
  type JournalLine,
  type JournalSource,
  type JournalStatus,
} from "@/data/accounting/journal";
import {
  seedFiscalYears,
  seedPeriods,
  seedBooksLockedBefore,
  buildPeriods,
  type FiscalYear,
  type AccountingPeriod,
} from "@/data/accounting/fiscal";
import { seedBranches, seedConsolidationGroups, DEFAULT_BRANCH, type Branch, type ConsolidationGroup } from "@/data/accounting/branches";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const BRANCH_KEY = "sabi-acct-branch";

export type DraftLine = { accountNumber: number; debit: number; credit: number; description?: string; costCenter?: string; customerId?: string; vendorId?: string; projectId?: string };

export type PostInput = {
  date: string;
  source: JournalSource;
  memo: string;
  reference?: string;
  lines: DraftLine[];
  createdBy?: string;
  status?: Extract<JournalStatus, "Draft" | "Posted" | "Pending Approval">;
  approvalRef?: string;
  branchId?: string;
};

export type LockCheck = { locked: boolean; reason?: string };

// B13 — a standing journal that reposts on a monthly cadence (rent accrual,
// prepaid amortisation, etc.)
export type RecurringJournal = {
  id: string;
  memo: string;
  lines: DraftLine[];
  everyMonths: number;
  nextDate: string;
  endDate?: string;
  lastPostedDate?: string;
  postedCount: number;
  active: boolean;
  createdAt: string;
};

type LedgerState = {
  accounts: Account[];
  entries: JournalEntry[];
  fiscalYears: FiscalYear[];
  periods: AccountingPeriod[];
  booksLockedBefore: string | null;
  fxRates: { code: string; name: string; symbol: string; rateToNgn: number }[];
  branches: Branch[];
  consolidationGroups: ConsolidationGroup[];
  activeBranchId: string;
  recurringJournals: RecurringJournal[];

  // ---- lookups ----
  accountByNumber: (n: number) => Account | undefined;
  accountById: (id: string) => Account | undefined;
  branchById: (id: string) => Branch | undefined;
  periodFor: (date: string) => AccountingPeriod | undefined;
  isDateLocked: (date: string) => LockCheck;
  setActiveBranch: (id: string) => void;
  addBranch: (b: { code: string; name: string }) => void;
  addConsolidationGroup: (name: string, branchIds: string[]) => void;

  // ---- balances (all computed from POSTED lines — the GL is the source of truth) ----
  // `branch`: undefined = all branches (consolidated), a branch id = that entity only
  linesFor: (accountNumber: number, branch?: string) => { entry: JournalEntry; line: JournalLine }[];
  balanceOf: (accountNumber: number, asOf?: string, branch?: string) => number; // signed in the account's normal direction
  debitCreditOf: (accountNumber: number, opts?: { asOf?: string; from?: string; branch?: string }) => { debit: number; credit: number };
  activityOf: (accountNumber: number, from: string, to: string, branch?: string) => number;
  trialBalance: (asOf: string, branch?: string) => { account: Account; debit: number; credit: number }[];
  isInBalance: (asOf: string) => boolean;

  // ---- journal ----
  nextEntryNumber: (date: string) => string;
  validateLines: (lines: DraftLine[]) => { ok: boolean; error?: string };
  postJournal: (input: PostInput) => { ok: boolean; error?: string; entry?: JournalEntry };
  updateDraft: (id: string, patch: Partial<Pick<JournalEntry, "date" | "memo" | "reference">> & { lines?: DraftLine[] }) => void;
  postDraft: (id: string) => { ok: boolean; error?: string };
  voidDraft: (id: string) => void;
  reverseEntry: (id: string, opts?: { date?: string; memo?: string }) => { ok: boolean; error?: string; entry?: JournalEntry };

  // ---- chart of accounts ----
  addAccount: (a: { number: number; name: string; type: AccountType; subtype: AccountSubtype; parentNumber?: number; description?: string; openingBalance?: number; allowManualEntry?: boolean }) => { ok: boolean; error?: string };
  updateAccount: (id: string, patch: Partial<Pick<Account, "name" | "description" | "isActive" | "allowManualEntry" | "parentNumber" | "subtype">>) => void;
  archiveAccount: (id: string) => void;

  // ---- periods ----
  setPeriodStatus: (id: string, status: AccountingPeriod["status"]) => void;
  setBooksLockedBefore: (date: string | null) => void;
  openFiscalYear: (year: number) => void;

  // ---- B13 recurring journals ----
  addRecurringJournal: (input: { memo: string; lines: DraftLine[]; everyMonths: number; startDate: string; endDate?: string }) => { ok: boolean; error?: string };
  updateRecurringJournal: (id: string, patch: Partial<Pick<RecurringJournal, "active" | "everyMonths" | "endDate" | "memo">>) => void;
  removeRecurringJournal: (id: string) => void;
  dueRecurringJournals: (asOf: string) => RecurringJournal[];
  runRecurringJournals: (asOf: string) => { posted: number };
};

const toLines = (draft: DraftLine[]): JournalLine[] =>
  draft
    .filter((l) => round2(l.debit) !== 0 || round2(l.credit) !== 0)
    .map((l) => ({
      id: `jl-${rid()}`,
      accountNumber: l.accountNumber,
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
      description: l.description,
      costCenter: l.costCenter,
      customerId: l.customerId,
      vendorId: l.vendorId,
      projectId: l.projectId,
    }));

const loadBranch = () => { try { return localStorage.getItem(BRANCH_KEY) || DEFAULT_BRANCH; } catch { return DEFAULT_BRANCH; } };

export const useLedger = create<LedgerState>((set, get) => ({
  accounts: seedAccounts,
  entries: seedJournalEntries,
  fiscalYears: seedFiscalYears,
  periods: seedPeriods,
  booksLockedBefore: seedBooksLockedBefore,
  fxRates: seedFxRates,
  branches: seedBranches,
  consolidationGroups: seedConsolidationGroups,
  activeBranchId: loadBranch(),
  recurringJournals: [
    { id: "rj-rent", memo: "Monthly office rent accrual", lines: [{ accountNumber: 5200, debit: 400_000, credit: 0, description: "Rent for the month" }, { accountNumber: 2000, debit: 0, credit: 400_000, description: "Accrued rent payable" }], everyMonths: 1, nextDate: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 12)).toISOString(), postedCount: 0, active: true, createdAt: "2026-01-01T00:00:00.000Z" },
  ],

  accountByNumber: (n) => get().accounts.find((a) => a.number === n),
  accountById: (id) => get().accounts.find((a) => a.id === id),
  branchById: (id) => get().branches.find((b) => b.id === id),

  setActiveBranch: (id) => {
    try { localStorage.setItem(BRANCH_KEY, id); } catch { /* ignore */ }
    set({ activeBranchId: id });
    audit(`switched to ${get().branchById(id)?.name ?? id}`, "accounting/branches/switch");
  },
  addBranch: (b) => {
    set((s) => ({ branches: [...s.branches, { id: `br-${rid()}`, code: b.code, name: b.name, isHeadOffice: false, baseCurrency: "NGN", active: true }] }));
    audit(`created branch ${b.name}`, `accounting/branches/${b.code}`);
  },
  addConsolidationGroup: (name, branchIds) => {
    set((s) => ({ consolidationGroups: [...s.consolidationGroups, { id: `cg-${rid()}`, name, branchIds, eliminate: [{ receivable: 1150, payable: 2150 }] }] }));
    audit(`created consolidation group ${name}`, `accounting/consolidation/${name}`);
  },

  periodFor: (date) => {
    const t = new Date(date).getTime();
    return get().periods.find((p) => t >= new Date(p.startDate).getTime() && t <= new Date(p.endDate).getTime());
  },

  isDateLocked: (date) => {
    const lock = get().booksLockedBefore;
    if (lock && new Date(date).getTime() < new Date(lock).getTime()) {
      return { locked: true, reason: `The books are closed before ${new Date(lock).toLocaleDateString()}.` };
    }
    const period = get().periodFor(date);
    if (period?.status === "Locked") {
      return { locked: true, reason: `${period.label} is locked. Reopen it before posting to that date.` };
    }
    return { locked: false };
  },

  linesFor: (accountNumber, branch) =>
    get()
      .entries.filter((e) => e.status === "Posted" && (!branch || e.branchId === branch))
      .flatMap((entry) => entry.lines.filter((l) => l.accountNumber === accountNumber).map((line) => ({ entry, line }))),

  debitCreditOf: (accountNumber, opts) => {
    const asOf = opts?.asOf ? new Date(opts.asOf).getTime() : undefined;
    const from = opts?.from ? new Date(opts.from).getTime() : undefined;
    let debit = 0;
    let credit = 0;
    for (const { entry, line } of get().linesFor(accountNumber, opts?.branch)) {
      const t = new Date(entry.date).getTime();
      if (asOf !== undefined && t > asOf) continue;
      if (from !== undefined && t < from) continue;
      debit += line.debit;
      credit += line.credit;
    }
    return { debit: round2(debit), credit: round2(credit) };
  },

  balanceOf: (accountNumber, asOf, branch) => {
    const acct = get().accountByNumber(accountNumber);
    if (!acct) return 0;
    const { debit, credit } = get().debitCreditOf(accountNumber, { asOf, branch });
    return round2(isDebitNormal(acct) ? debit - credit : credit - debit);
  },

  activityOf: (accountNumber, from, to, branch) => {
    const acct = get().accountByNumber(accountNumber);
    if (!acct) return 0;
    const lo = new Date(from).getTime();
    const hi = new Date(to).getTime();
    let debit = 0;
    let credit = 0;
    for (const { entry, line } of get().linesFor(accountNumber, branch)) {
      const t = new Date(entry.date).getTime();
      if (t < lo || t > hi) continue;
      debit += line.debit;
      credit += line.credit;
    }
    return round2(isDebitNormal(acct) ? debit - credit : credit - debit);
  },

  trialBalance: (asOf, branch) =>
    get()
      .accounts.map((account) => {
        const bal = get().balanceOf(account.number, asOf, branch);
        const debitNormal = isDebitNormal(account);
        // A positive balance sits in its normal column; a negative (contra) balance flips.
        const debit = debitNormal ? Math.max(bal, 0) : Math.max(-bal, 0);
        const credit = debitNormal ? Math.max(-bal, 0) : Math.max(bal, 0);
        return { account, debit: round2(debit), credit: round2(credit) };
      })
      .filter((r) => r.debit > 0.005 || r.credit > 0.005),

  isInBalance: (asOf) => {
    const tb = get().trialBalance(asOf);
    const d = round2(tb.reduce((n, r) => n + r.debit, 0));
    const c = round2(tb.reduce((n, r) => n + r.credit, 0));
    return Math.abs(d - c) < 0.01;
  },

  nextEntryNumber: (date) => {
    const year = new Date(date).getUTCFullYear();
    const n = get().entries.filter((e) => e.number.startsWith(`JE-${year}-`)).length + 1;
    return `JE-${year}-${String(n).padStart(6, "0")}`;
  },

  validateLines: (lines) => {
    const clean = lines.filter((l) => round2(l.debit) !== 0 || round2(l.credit) !== 0);
    if (clean.length < 2) return { ok: false, error: "A journal entry needs at least two lines." };
    for (const l of clean) {
      const acct = get().accountByNumber(l.accountNumber);
      if (!acct) return { ok: false, error: `Account ${l.accountNumber} does not exist.` };
      if (!acct.isActive) return { ok: false, error: `Account ${acct.number} ${acct.name} is archived.` };
      if (round2(l.debit) > 0 && round2(l.credit) > 0) return { ok: false, error: "A line cannot be both a debit and a credit." };
      if (round2(l.debit) < 0 || round2(l.credit) < 0) return { ok: false, error: "Amounts cannot be negative." };
    }
    const debit = round2(clean.reduce((n, l) => n + (l.debit || 0), 0));
    const credit = round2(clean.reduce((n, l) => n + (l.credit || 0), 0));
    if (Math.abs(debit - credit) > 0.005) {
      return { ok: false, error: `Out of balance by ${Math.abs(debit - credit).toFixed(2)} — debits ${debit.toFixed(2)}, credits ${credit.toFixed(2)}.` };
    }
    if (debit === 0) return { ok: false, error: "A journal entry cannot be for zero." };
    return { ok: true };
  },

  postJournal: (input) => {
    const status = input.status ?? "Posted";
    const v = get().validateLines(input.lines);
    if (!v.ok) return { ok: false, error: v.error };

    if (status === "Posted") {
      const lock = get().isDateLocked(input.date);
      if (lock.locked) return { ok: false, error: lock.reason };
    }

    const me = input.createdBy ?? useIdentity.getState().user.id;
    const now = new Date().toISOString();
    const entry: JournalEntry = {
      id: `je-${rid()}`,
      number: get().nextEntryNumber(input.date),
      date: input.date,
      branchId: input.branchId ?? get().activeBranchId,
      source: input.source,
      reference: input.reference,
      memo: input.memo,
      lines: toLines(input.lines),
      status,
      createdBy: me,
      createdAt: now,
      approvalRef: input.approvalRef,
      ...(status === "Posted" ? { postedBy: me, postedAt: now } : {}),
    };
    set((s) => ({ entries: [entry, ...s.entries] }));
    audit(
      status === "Posted" ? `posted journal entry ${entry.number}` : `drafted journal entry ${entry.number}`,
      `accounting/journal/${entry.number}`,
    );
    return { ok: true, entry };
  },

  updateDraft: (id, patch) => {
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== id || e.status !== "Draft") return e;
        return {
          ...e,
          date: patch.date ?? e.date,
          memo: patch.memo ?? e.memo,
          reference: patch.reference ?? e.reference,
          lines: patch.lines ? toLines(patch.lines) : e.lines,
          number: patch.date ? e.number : e.number,
        };
      }),
    }));
  },

  postDraft: (id) => {
    const e = get().entries.find((x) => x.id === id);
    if (!e || e.status !== "Draft") return { ok: false, error: "Not a draft." };
    const v = get().validateLines(e.lines);
    if (!v.ok) return { ok: false, error: v.error };
    const lock = get().isDateLocked(e.date);
    if (lock.locked) return { ok: false, error: lock.reason };
    const me = useIdentity.getState().user.id;
    const now = new Date().toISOString();
    set((s) => ({ entries: s.entries.map((x) => (x.id === id ? { ...x, status: "Posted", postedBy: me, postedAt: now } : x)) }));
    audit(`posted journal entry ${e.number}`, `accounting/journal/${e.number}`);
    return { ok: true };
  },

  voidDraft: (id) => {
    const e = get().entries.find((x) => x.id === id);
    if (!e || (e.status !== "Draft" && e.status !== "Pending Approval")) return;
    set((s) => ({ entries: s.entries.map((x) => (x.id === id ? { ...x, status: "Void" } : x)) }));
    audit(`voided journal entry ${e.number}`, `accounting/journal/${e.number}`);
  },

  reverseEntry: (id, opts) => {
    const orig = get().entries.find((x) => x.id === id);
    if (!orig) return { ok: false, error: "Entry not found." };
    if (orig.status !== "Posted") return { ok: false, error: "Only a posted entry can be reversed." };
    if (orig.reversedByEntryId) return { ok: false, error: "This entry has already been reversed." };
    const date = opts?.date ?? new Date().toISOString();
    const lock = get().isDateLocked(date);
    if (lock.locked) return { ok: false, error: lock.reason };
    const me = useIdentity.getState().user.id;
    const now = new Date().toISOString();
    const reversal: JournalEntry = {
      id: `je-${rid()}`,
      number: get().nextEntryNumber(date),
      date,
      branchId: orig.branchId,
      source: "Reversal",
      reference: orig.number,
      memo: opts?.memo ?? `Reversal of ${orig.number} — ${orig.memo}`,
      lines: orig.lines.map((l) => ({ ...l, id: `jl-${rid()}`, debit: l.credit, credit: l.debit })),
      status: "Posted",
      createdBy: me,
      createdAt: now,
      postedBy: me,
      postedAt: now,
      reversesEntryId: orig.id,
    };
    set((s) => ({
      entries: [reversal, ...s.entries.map((x) => (x.id === id ? { ...x, status: "Reversed" as const, reversedByEntryId: reversal.id } : x))],
    }));
    audit(`reversed journal entry ${orig.number} via ${reversal.number}`, `accounting/journal/${orig.number}`);
    return { ok: true, entry: reversal };
  },

  addAccount: (a) => {
    if (get().accountByNumber(a.number)) return { ok: false, error: `Account ${a.number} already exists.` };
    if (a.number < 1000 || a.number > 5999) return { ok: false, error: "Use a number between 1000 and 5999." };
    const acct: Account = {
      id: `acct-${a.number}`,
      number: a.number,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      parentNumber: a.parentNumber,
      description: a.description,
      isActive: true,
      allowManualEntry: a.allowManualEntry ?? true,
      openingBalance: a.openingBalance ?? 0,
      currency: "NGN",
    };
    set((s) => ({ accounts: [...s.accounts, acct].sort((x, y) => x.number - y.number) }));
    audit(`created account ${a.number} ${a.name}`, `accounting/coa/${a.number}`);

    // A non-zero opening balance is booked as a real journal entry against
    // Opening Balance Equity (3900) — never a magic per-account field.
    const opening = round2(a.openingBalance ?? 0);
    if (opening !== 0) {
      const debitNormal = a.type === "asset" || a.type === "expense" || a.type === "cogs";
      const asOf = get().booksLockedBefore ?? new Date().toISOString();
      get().postJournal({
        date: asOf,
        source: "Opening Balance",
        memo: `Opening balance — ${a.number} ${a.name}`,
        lines: debitNormal
          ? [{ accountNumber: a.number, debit: opening, credit: 0 }, { accountNumber: 3900, debit: 0, credit: opening }]
          : [{ accountNumber: 3900, debit: opening, credit: 0 }, { accountNumber: a.number, debit: 0, credit: opening }],
      });
    }
    return { ok: true };
  },

  updateAccount: (id, patch) => {
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    const a = get().accountById(id);
    if (a) audit(`updated account ${a.number} ${a.name}`, `accounting/coa/${a.number}`);
  },

  archiveAccount: (id) => {
    const a = get().accountById(id);
    if (!a) return;
    const used = get().linesFor(a.number).length > 0;
    set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, isActive: false } : x)) }));
    audit(`archived account ${a.number} ${a.name}${used ? " (has history)" : ""}`, `accounting/coa/${a.number}`);
  },

  setPeriodStatus: (id, status) => {
    set((s) => ({ periods: s.periods.map((p) => (p.id === id ? { ...p, status } : p)) }));
    const p = get().periods.find((x) => x.id === id);
    if (p) audit(`${status.toLowerCase()} accounting period ${p.label}`, `accounting/periods/${p.label}`);
  },

  setBooksLockedBefore: (date) => {
    set({ booksLockedBefore: date });
    audit(date ? `locked books before ${new Date(date).toLocaleDateString()}` : "removed books lock", "accounting/periods/lock");
  },

  openFiscalYear: (year) => {
    if (get().fiscalYears.some((f) => f.year === year)) return;
    set((s) => ({
      fiscalYears: [
        ...s.fiscalYears,
        { id: `fy-${year}`, year, startDate: `${year}-01-01T00:00:00.000Z`, endDate: `${year}-12-31T23:59:59.999Z`, status: "Open" as const },
      ].sort((a, b) => a.year - b.year),
      periods: [...s.periods, ...buildPeriods(year)],
    }));
    audit(`opened fiscal year ${year}`, `accounting/fiscal-year/${year}`);
  },

  addRecurringJournal: (input) => {
    const check = get().validateLines(input.lines);
    if (!check.ok) return { ok: false, error: check.error };
    if (input.everyMonths < 1) return { ok: false, error: "Cadence must be at least 1 month." };
    const rj: RecurringJournal = {
      id: `rj-${rid()}`,
      memo: input.memo,
      lines: input.lines,
      everyMonths: input.everyMonths,
      nextDate: input.startDate,
      endDate: input.endDate,
      postedCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ recurringJournals: [rj, ...s.recurringJournals] }));
    audit(`created recurring journal — ${input.memo}`, "accounting/recurring-journals");
    return { ok: true };
  },
  updateRecurringJournal: (id, patch) => set((s) => ({ recurringJournals: s.recurringJournals.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeRecurringJournal: (id) => set((s) => ({ recurringJournals: s.recurringJournals.filter((r) => r.id !== id) })),
  dueRecurringJournals: (asOf) => {
    const t = new Date(asOf).getTime();
    return get().recurringJournals.filter((r) => r.active && new Date(r.nextDate).getTime() <= t && (!r.endDate || new Date(r.nextDate).getTime() <= new Date(r.endDate).getTime()));
  },
  runRecurringJournals: (asOf) => {
    let posted = 0;
    for (const rj of get().dueRecurringJournals(asOf)) {
      const res = get().postJournal({ date: rj.nextDate, source: "Manual", memo: `${rj.memo} (recurring)`, reference: rj.id, lines: rj.lines });
      if (!res.ok) continue;
      posted++;
      const next = monthsFwd(rj.nextDate, rj.everyMonths);
      set((s) => ({
        recurringJournals: s.recurringJournals.map((r) => (r.id === rj.id ? { ...r, lastPostedDate: rj.nextDate, nextDate: next, postedCount: r.postedCount + 1, active: r.endDate && new Date(next).getTime() > new Date(r.endDate).getTime() ? false : r.active } : r)),
      }));
    }
    if (posted) audit(`posted ${posted} recurring journal(s)`, "accounting/recurring-journals");
    return { posted };
  },
}));

const monthsFwd = (iso: string, m: number) => { const d = new Date(iso); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate(), 12)).toISOString(); };

export { normalBalanceOf, isDebitNormal };
