import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { ACCT, type AccountSubtype } from "@/data/accounting/coa";
import type { JournalEntry } from "@/data/accounting/journal";
import { seedBankAccounts, seedStatementLines, seedReconciliations, type BankAccountMeta, type BankStatementLine, type BankReconciliation } from "@/data/accounting/banking";

type PostResult = { ok: boolean; error?: string; entry?: JournalEntry };

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type BankGLMovement = { key: string; entryId: string; lineId: string; date: string; memo: string; description?: string; amount: number; source: string };

type BankingState = {
  accounts: BankAccountMeta[];
  statementLines: BankStatementLine[];
  reconciliations: BankReconciliation[];

  metaFor: (accountNumber: number) => BankAccountMeta | undefined;
  addBankAccount: (input: { number: number; name: string; bankName: string; accountName: string; accountNo: string; currency: string; subtype: Extract<AccountSubtype, "bank" | "cash">; openingBalance?: number }) => { ok: boolean; error?: string };

  bookBalance: (accountNumber: number, asOf?: string) => number;
  glMovements: (accountNumber: number, asOf?: string) => BankGLMovement[];

  recordTransfer: (input: { fromAccount: number; toAccount: number; amount: number; date: string; reference?: string; note?: string }) => PostResult;
  recordBankLine: (input: { accountNumber: number; contraAccount: number; direction: "in" | "out"; amount: number; date: string; description: string; reference?: string }) => PostResult;

  importStatementLines: (accountNumber: number, lines: { date: string; description: string; amount: number; reference?: string }[]) => void;
  clearStatementLine: (lineId: string, matchedJournalEntryId?: string) => void;
  addStatementLineToBooks: (lineId: string, contraAccount: number) => { ok: boolean; error?: string };
  unclearedStatementLines: (accountNumber: number) => BankStatementLine[];

  startReconciliation: (accountNumber: number, statementDate: string, closingBalance: number) => string;
  toggleCleared: (reconId: string, movementKey: string) => void;
  reconciliationProgress: (reconId: string) => { clearedTotal: number; statementTarget: number; difference: number };
  completeReconciliation: (reconId: string) => { ok: boolean; error?: string };
};

export const useBanking = create<BankingState>((set, get) => ({
  accounts: seedBankAccounts,
  statementLines: seedStatementLines,
  reconciliations: seedReconciliations,

  metaFor: (accountNumber) => get().accounts.find((a) => a.accountNumber === accountNumber),

  addBankAccount: (input) => {
    const res = useLedger.getState().addAccount({
      number: input.number,
      name: input.name,
      type: "asset",
      subtype: input.subtype,
      openingBalance: input.openingBalance ?? 0,
      allowManualEntry: true,
    });
    if (!res.ok) return res;
    set((s) => ({
      accounts: [...s.accounts, { id: `bank-${rid()}`, accountNumber: input.number, bankName: input.bankName, accountName: input.accountName, accountNo: input.accountNo, currency: input.currency, active: true }],
    }));
    audit(`added bank account ${input.name}`, `accounting/banking/${input.name}`);
    return { ok: true };
  },

  bookBalance: (accountNumber, asOf) => useLedger.getState().balanceOf(accountNumber, asOf),

  glMovements: (accountNumber, asOf) => {
    const cutoff = asOf ? new Date(asOf).getTime() : Infinity;
    return useLedger
      .getState()
      .entries.filter((e) => e.status === "Posted" && new Date(e.date).getTime() <= cutoff)
      .flatMap((e) =>
        e.lines
          .filter((l) => l.accountNumber === accountNumber)
          .map((l) => ({ key: `${e.id}:${l.id}`, entryId: e.id, lineId: l.id, date: e.date, memo: e.memo, description: l.description, amount: round2(l.debit - l.credit), source: e.source })),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  recordTransfer: (input) => {
    if (input.fromAccount === input.toAccount) return { ok: false, error: "Pick two different accounts." };
    const r = useLedger.getState().postJournal({
      date: input.date,
      source: "Bank Transaction",
      memo: input.note || `Transfer — ${get().metaFor(input.fromAccount)?.accountName ?? input.fromAccount} → ${get().metaFor(input.toAccount)?.accountName ?? input.toAccount}`,
      reference: input.reference,
      lines: [
        { accountNumber: input.toAccount, debit: input.amount, credit: 0, description: "Transfer in" },
        { accountNumber: input.fromAccount, debit: 0, credit: input.amount, description: "Transfer out" },
      ],
    });
    if (r.ok) audit("recorded bank transfer", "accounting/banking/transfer");
    return r;
  },

  recordBankLine: (input) => {
    const bankLine = input.direction === "in"
      ? { accountNumber: input.accountNumber, debit: input.amount, credit: 0, description: input.description }
      : { accountNumber: input.accountNumber, debit: 0, credit: input.amount, description: input.description };
    const contraLine = input.direction === "in"
      ? { accountNumber: input.contraAccount, debit: 0, credit: input.amount, description: input.description }
      : { accountNumber: input.contraAccount, debit: input.amount, credit: 0, description: input.description };
    const r = useLedger.getState().postJournal({ date: input.date, source: "Bank Transaction", memo: input.description, reference: input.reference, lines: [bankLine, contraLine] });
    if (r.ok) audit(`recorded bank ${input.direction === "in" ? "receipt" : "payment"}`, "accounting/banking");
    return r;
  },

  importStatementLines: (accountNumber, lines) => {
    const rows: BankStatementLine[] = lines.map((l) => ({ id: `stmt-${rid()}`, accountNumber, date: l.date, description: l.description, amount: round2(l.amount), reference: l.reference, reconciled: false, importedAt: new Date().toISOString() }));
    set((s) => ({ statementLines: [...rows, ...s.statementLines] }));
    audit(`imported ${rows.length} bank statement line(s)`, `accounting/banking/${accountNumber}`);
  },

  clearStatementLine: (lineId, matchedJournalEntryId) =>
    set((s) => ({ statementLines: s.statementLines.map((l) => (l.id === lineId ? { ...l, reconciled: true, matchedJournalEntryId } : l)) })),

  addStatementLineToBooks: (lineId, contraAccount) => {
    const line = get().statementLines.find((l) => l.id === lineId);
    if (!line) return { ok: false, error: "Line not found." };
    const r = get().recordBankLine({
      accountNumber: line.accountNumber,
      contraAccount,
      direction: line.amount >= 0 ? "in" : "out",
      amount: Math.abs(line.amount),
      date: line.date,
      description: line.description,
      reference: line.reference,
    });
    if (!r.ok) return r;
    const newKey = r.entry ? `${r.entry.id}:${r.entry.lines.find((x) => x.accountNumber === line.accountNumber)?.id}` : undefined;
    set((s) => ({
      statementLines: s.statementLines.map((l) => (l.id === lineId ? { ...l, reconciled: true, matchedJournalEntryId: r.entry?.id } : l)),
      reconciliations: newKey
        ? s.reconciliations.map((rec) => (rec.accountNumber === line.accountNumber && rec.status === "In Progress" ? { ...rec, reconciledLineIds: [...rec.reconciledLineIds, newKey] } : rec))
        : s.reconciliations,
    }));
    return { ok: true };
  },

  unclearedStatementLines: (accountNumber) => get().statementLines.filter((l) => l.accountNumber === accountNumber && !l.reconciled),

  startReconciliation: (accountNumber, statementDate, closingBalance) => {
    const id = `recon-${rid()}`;
    // opening balance = book balance the day before the statement window's earliest uncleared item;
    // for simplicity use the cleared-through balance as of the prior recon, else 0.
    const prior = get().reconciliations.filter((r) => r.accountNumber === accountNumber && r.status === "Reconciled").sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime())[0];
    const opening = prior ? prior.closingBalance : 0;
    set((s) => ({
      reconciliations: [{ id, accountNumber, statementDate, openingBalance: opening, closingBalance, status: "In Progress", reconciledLineIds: [] }, ...s.reconciliations],
    }));
    audit(`started bank reconciliation for ${accountNumber}`, `accounting/banking/reconciliation`);
    return id;
  },

  toggleCleared: (reconId, movementKey) =>
    set((s) => ({
      reconciliations: s.reconciliations.map((r) => {
        if (r.id !== reconId) return r;
        const has = r.reconciledLineIds.includes(movementKey);
        return { ...r, reconciledLineIds: has ? r.reconciledLineIds.filter((k) => k !== movementKey) : [...r.reconciledLineIds, movementKey] };
      }),
    })),

  reconciliationProgress: (reconId) => {
    const r = get().reconciliations.find((x) => x.id === reconId);
    if (!r) return { clearedTotal: 0, statementTarget: 0, difference: 0 };
    const movements = get().glMovements(r.accountNumber, r.statementDate);
    const cleared = round2(movements.filter((m) => r.reconciledLineIds.includes(m.key)).reduce((n, m) => n + m.amount, 0));
    const clearedTotal = round2(r.openingBalance + cleared);
    return { clearedTotal, statementTarget: r.closingBalance, difference: round2(r.closingBalance - clearedTotal) };
  },

  completeReconciliation: (reconId) => {
    const p = get().reconciliationProgress(reconId);
    if (Math.abs(p.difference) > 0.01) return { ok: false, error: `Still ${round2(Math.abs(p.difference)).toLocaleString()} out — clear or add the missing items.` };
    set((s) => ({ reconciliations: s.reconciliations.map((r) => (r.id === reconId ? { ...r, status: "Reconciled", completedAt: new Date().toISOString(), completedBy: useIdentity.getState().user.id } : r)) }));
    audit("completed a bank reconciliation", "accounting/banking/reconciliation");
    return { ok: true };
  },
}));

export { ACCT };
