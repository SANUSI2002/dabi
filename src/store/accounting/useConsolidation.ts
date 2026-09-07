import { useLedger } from "@/store/accounting/useLedger";
import { isDebitNormal, type Account } from "@/data/accounting/coa";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ConsolLine = {
  account: Account;
  perBranch: Record<string, number>; // branchId -> balance (normal direction)
  eliminations: number; // signed adjustment applied on consolidation
  consolidated: number;
};

/**
 * Consolidated trial balance for a group of branches, as of a date.
 * Each entity's balances are summed, then matching intercompany
 * receivable/payable balances are eliminated so the group doesn't show amounts
 * it owes itself.
 */
export function consolidate(groupId: string, asOf: string) {
  const led = useLedger.getState();
  const group = led.consolidationGroups.find((g) => g.id === groupId);
  if (!group) return { lines: [] as ConsolLine[], totals: { debit: 0, credit: 0 }, eliminated: 0, branchIds: [] as string[] };

  const branchIds = group.branchIds;
  const lines: ConsolLine[] = led.accounts.map((account) => {
    const perBranch: Record<string, number> = {};
    for (const b of branchIds) perBranch[b] = round2(led.balanceOf(account.number, asOf, b));
    const summed = round2(branchIds.reduce((n, b) => n + perBranch[b], 0));
    return { account, perBranch, eliminations: 0, consolidated: summed };
  });

  let eliminated = 0;
  for (const pair of group.eliminate) {
    const recv = lines.find((l) => l.account.number === pair.receivable);
    const pay = lines.find((l) => l.account.number === pair.payable);
    if (!recv || !pay) continue;
    const amt = round2(Math.min(Math.abs(recv.consolidated), Math.abs(pay.consolidated)));
    if (amt < 0.005) continue;
    recv.eliminations = -Math.sign(recv.consolidated) * amt;
    recv.consolidated = round2(recv.consolidated + recv.eliminations);
    pay.eliminations = -Math.sign(pay.consolidated) * amt;
    pay.consolidated = round2(pay.consolidated + pay.eliminations);
    eliminated = round2(eliminated + amt);
  }

  const rows = lines.filter((l) => Math.abs(l.consolidated) > 0.005 || branchIds.some((b) => Math.abs(l.perBranch[b]) > 0.005));
  let debit = 0;
  let credit = 0;
  for (const l of rows) {
    const dn = isDebitNormal(l.account);
    const b = l.consolidated;
    debit += dn ? Math.max(b, 0) : Math.max(-b, 0);
    credit += dn ? Math.max(-b, 0) : Math.max(b, 0);
  }
  return { lines: rows, totals: { debit: round2(debit), credit: round2(credit) }, eliminated, branchIds };
}

/** consolidated P&L / balance-sheet headline numbers for a group */
export function consolidatedSummary(groupId: string, from: string, to: string) {
  const led = useLedger.getState();
  const group = led.consolidationGroups.find((g) => g.id === groupId);
  if (!group) return null;
  const sumType = (t: Account["type"], mode: "activity" | "balance") =>
    round2(
      group.branchIds.reduce(
        (n, b) => n + led.accounts.filter((a) => a.type === t).reduce((m, a) => m + (mode === "activity" ? Math.abs(led.activityOf(a.number, from, to, b)) : led.balanceOf(a.number, to, b)), 0),
        0,
      ),
    );
  const revenue = sumType("revenue", "activity");
  const cogs = sumType("cogs", "activity");
  const expenses = sumType("expense", "activity");
  const assets = sumType("asset", "balance");
  const liabilities = sumType("liability", "balance");
  return { revenue, netIncome: round2(revenue - cogs - expenses), assets, liabilities };
}
