import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { useTax } from "@/store/accounting/useTax";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useHr } from "@/store/useHr";
import { ACCT } from "@/data/accounting/coa";
import { seedExpenseClaims, type ExpenseClaim, type ExpenseLine, type ExpensePayMode } from "@/data/accounting/expenses";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const claimSubtotal = (lines: ExpenseLine[]) => round2(lines.reduce((n, l) => n + l.amount, 0));
export const claimTax = (lines: ExpenseLine[]) => round2(lines.reduce((n, l) => n + useTax.getState().taxOn(l.amount, l.taxRateId), 0));
export const claimTotal = (lines: ExpenseLine[]) => round2(claimSubtotal(lines) + claimTax(lines));

const creditAccountFor = (mode: ExpensePayMode, paidFromAccount?: number) =>
  mode === "Reimburse to staff" ? ACCT.reimbursementsPayable : mode === "Petty Cash" ? ACCT.cashOnHand : paidFromAccount ?? ACCT.bank;

function postAccrualJE(claim: ExpenseClaim, claimantName: string) {
  const tax = claimTax(claim.lines);
  const credit = creditAccountFor(claim.payMode, claim.paidFromAccount);
  const lines = [
    ...claim.lines.map((l) => ({ accountNumber: l.accountNumber, debit: l.amount, credit: 0, description: l.description })),
  ];
  if (tax > 0) lines.push({ accountNumber: ACCT.vatPayable, debit: tax, credit: 0, description: `Input VAT — ${claim.number}` });
  lines.push({ accountNumber: credit, debit: 0, credit: claimTotal(claim.lines), description: `${claim.number} — ${claimantName}` });
  return useLedger.getState().postJournal({ date: claim.date, source: "Expense", memo: `Expense claim ${claim.number} — ${claim.title}`, reference: claim.number, lines });
}

function postSettlementJE(claim: ExpenseClaim, fromAccount: number, claimantName: string) {
  return useLedger.getState().postJournal({
    date: new Date().toISOString(),
    source: "Expense",
    memo: `Reimbursement of ${claim.number} — ${claimantName}`,
    reference: claim.number,
    lines: [
      { accountNumber: ACCT.reimbursementsPayable, debit: claimTotal(claim.lines), credit: 0, description: `Settle ${claim.number}` },
      { accountNumber: fromAccount, debit: 0, credit: claimTotal(claim.lines), description: `Paid to ${claimantName}` },
    ],
  });
}

type ExpensesState = {
  claims: ExpenseClaim[];

  claimById: (id: string) => ExpenseClaim | undefined;
  createClaim: (input: { claimantId?: string; date: string; title: string; costCenter?: string; payMode: ExpensePayMode; paidFromAccount?: number; lines: ExpenseLine[]; receiptRef?: string }) => string;
  updateClaim: (id: string, patch: Partial<Pick<ExpenseClaim, "date" | "title" | "costCenter" | "payMode" | "lines" | "receiptRef" | "paidFromAccount">>) => void;
  submitClaim: (id: string) => void;
  decideClaim: (id: string, decision: "Approved" | "Rejected", comment?: string) => void;
  payClaim: (id: string, fromAccount: number) => { ok: boolean; error?: string };
  deleteDraft: (id: string) => void;
};

const nameOf = (id: string) => useHr.getState().byId(id)?.name ?? id;

export const useExpenses = create<ExpensesState>((set, get) => {
  const claims = seedExpenseClaims.map((c) => {
    if (c.status === "Draft" || c.status === "Rejected" || c.journalEntryId) return c;
    const accrual = postAccrualJE(c, nameOf(c.claimantId));
    let out: ExpenseClaim = { ...c, journalEntryId: accrual.entry?.id };
    if (c.status === "Paid" && c.payMode === "Reimburse to staff") {
      const settle = postSettlementJE(out, ACCT.cashOnHand, nameOf(c.claimantId));
      out = { ...out, paymentJournalEntryId: settle.entry?.id, paidFromAccount: ACCT.cashOnHand };
    }
    return out;
  });

  return {
    claims,
    claimById: (id) => get().claims.find((c) => c.id === id),

    createClaim: (input) => {
      const id = `exp-${rid()}`;
      const n = get().claims.length + 1;
      const claim: ExpenseClaim = {
        id,
        number: `EXP-2026-${String(n).padStart(6, "0")}`,
        claimantId: input.claimantId ?? useIdentity.getState().user.id,
        date: input.date,
        title: input.title,
        costCenter: input.costCenter,
        payMode: input.payMode,
        paidFromAccount: input.paidFromAccount,
        lines: input.lines,
        receiptRef: input.receiptRef,
        status: "Draft",
        approval: { status: "Not Required", currentLevel: 0, steps: [] },
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ claims: [claim, ...s.claims] }));
      audit(`created expense claim ${claim.number}`, `accounting/expenses/${claim.number}`);
      return id;
    },
    updateClaim: (id, patch) => set((s) => ({ claims: s.claims.map((c) => (c.id === id && c.status === "Draft" ? { ...c, ...patch } : c)) })),

    submitClaim: (id) => {
      const c = get().claims.find((x) => x.id === id);
      if (!c || c.status !== "Draft") return;
      const approval = useAcctControl.getState().buildApproval("Expense Claim", claimTotal(c.lines), c.claimantId);
      if (approval.status === "Not Required") {
        // no approval needed — book it straight away
        const je = postAccrualJE(c, nameOf(c.claimantId));
        const settled = c.payMode !== "Reimburse to staff";
        set((s) => ({ claims: s.claims.map((x) => (x.id === id ? { ...x, approval, status: settled ? "Paid" : "Approved", journalEntryId: je.entry?.id, paidAt: settled ? new Date().toISOString() : undefined } : x)) }));
        audit(`booked expense claim ${c.number}`, `accounting/expenses/${c.number}`);
        return;
      }
      set((s) => ({ claims: s.claims.map((x) => (x.id === id ? { ...x, approval, status: "Pending Approval" } : x)) }));
      audit(`submitted expense claim ${c.number} for approval`, `accounting/expenses/${c.number}`);
    },

    decideClaim: (id, decision, comment) => {
      const c = get().claims.find((x) => x.id === id);
      if (!c) return;
      const approval = useAcctControl.getState().decide(c.approval, decision, comment);
      set((s) => ({ claims: s.claims.map((x) => (x.id === id ? { ...x, approval } : x)) }));
      audit(`${decision.toLowerCase()} expense claim ${c.number}`, `accounting/expenses/${c.number}`);
      if (approval.status === "Rejected") {
        set((s) => ({ claims: s.claims.map((x) => (x.id === id ? { ...x, status: "Rejected" } : x)) }));
        return;
      }
      if (approval.status === "Approved") {
        const je = postAccrualJE(c, nameOf(c.claimantId));
        const settled = c.payMode !== "Reimburse to staff";
        set((s) => ({ claims: s.claims.map((x) => (x.id === id ? { ...x, status: settled ? "Paid" : "Approved", journalEntryId: je.entry?.id, paidAt: settled ? new Date().toISOString() : undefined } : x)) }));
      }
    },

    payClaim: (id, fromAccount) => {
      const c = get().claims.find((x) => x.id === id);
      if (!c || c.status !== "Approved" || c.payMode !== "Reimburse to staff") return { ok: false, error: "Nothing to reimburse." };
      const je = postSettlementJE(c, fromAccount, nameOf(c.claimantId));
      if (!je.ok) return { ok: false, error: je.error };
      set((s) => ({ claims: s.claims.map((x) => (x.id === id ? { ...x, status: "Paid", paymentJournalEntryId: je.entry?.id, paidFromAccount: fromAccount, paidAt: new Date().toISOString() } : x)) }));
      audit(`reimbursed expense claim ${c.number}`, `accounting/expenses/${c.number}`);
      return { ok: true };
    },

    deleteDraft: (id) => set((s) => ({ claims: s.claims.filter((c) => !(c.id === id && c.status === "Draft")) })),
  };
});
