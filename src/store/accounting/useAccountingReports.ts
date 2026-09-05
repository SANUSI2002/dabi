import { useLedger } from "@/store/accounting/useLedger";
import { useAR } from "@/store/accounting/useAR";
import { useAP } from "@/store/accounting/useAP";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useFixedAssets, netBookValue } from "@/store/accounting/useFixedAssets";
import { isDebitNormal, type Account } from "@/data/accounting/coa";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const INCEPTION = "2000-01-01T00:00:00.000Z";

export type StatementLine = { account: Account; amount: number };
export type StatementGroup = { title: string; lines: StatementLine[]; total: number };

/** movement of an account over a window, signed in its normal direction */
function periodActivity(accountNumber: number, from: string, to: string) {
  return useLedger.getState().activityOf(accountNumber, from, to);
}
function balanceAsOf(accountNumber: number, asOf: string) {
  return useLedger.getState().balanceOf(accountNumber, asOf);
}

export function profitAndLoss(from: string, to: string) {
  const led = useLedger.getState();
  const accts = led.accounts;
  // `credit` side for revenue (a discount debited to contra-revenue nets it down);
  // `debit` side for expenses/COGS.
  const grp = (types: Account["type"][], side: "credit" | "debit"): StatementGroup => {
    const lines = accts
      .filter((a) => types.includes(a.type))
      .map((a) => {
        const dc = led.debitCreditOf(a.number, { from, asOf: to });
        const amount = round2(side === "credit" ? dc.credit - dc.debit : dc.debit - dc.credit);
        return { account: a, amount };
      })
      .filter((l) => Math.abs(l.amount) > 0.005)
      .sort((a, b) => a.account.number - b.account.number);
    return { title: "", lines, total: round2(lines.reduce((n, l) => n + l.amount, 0)) };
  };
  const revenue = grp(["revenue"], "credit");
  const cogs = grp(["cogs"], "debit");
  const expenses = grp(["expense"], "debit");
  const grossProfit = round2(revenue.total - cogs.total);
  const netIncome = round2(grossProfit - expenses.total);
  return { from, to, revenue, cogs, expenses, grossProfit, netIncome };
}

export function retainedEarnings(asOf: string) {
  const pl = profitAndLoss(INCEPTION, asOf);
  return pl.netIncome;
}

export function balanceSheet(asOf: string) {
  const accts = useLedger.getState().accounts;
  // Assets are presented on the debit side: a contra-asset (accumulated
  // depreciation) reduces the section total, so negate its normal-direction
  // balance. Liabilities and equity are presented on the credit side and their
  // normal-direction balance is already the right sign.
  const section = (predicate: (a: Account) => boolean, title: string, assetSide = false): StatementGroup => {
    const lines = accts
      .filter(predicate)
      .map((a) => {
        const bal = balanceAsOf(a.number, asOf);
        const amount = assetSide && !isDebitNormal(a) ? round2(-bal) : round2(bal);
        return { account: a, amount };
      })
      .filter((l) => Math.abs(l.amount) > 0.005)
      .sort((a, b) => a.account.number - b.account.number);
    return { title, lines, total: round2(lines.reduce((n, l) => n + l.amount, 0)) };
  };

  const currentAssets = section((a) => a.type === "asset" && ["cash", "bank", "accounts_receivable", "inventory", "current_asset"].includes(a.subtype), "Current assets", true);
  const fixedAssets = section((a) => a.type === "asset" && ["fixed_asset", "contra_asset", "other_asset"].includes(a.subtype), "Non-current assets", true);
  const currentLiabilities = section((a) => a.type === "liability" && a.subtype !== "long_term_liability", "Current liabilities");
  const longLiabilities = section((a) => a.type === "liability" && a.subtype === "long_term_liability", "Non-current liabilities");
  const equity = section((a) => a.type === "equity", "Equity");

  const re = retainedEarnings(asOf);
  const totalAssets = round2(currentAssets.total + fixedAssets.total);
  const totalLiabilities = round2(currentLiabilities.total + longLiabilities.total);
  const totalEquity = round2(equity.total + re);

  return {
    asOf,
    currentAssets,
    fixedAssets,
    totalAssets,
    currentLiabilities,
    longLiabilities,
    totalLiabilities,
    equity,
    retainedEarnings: re,
    totalEquity,
    totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05,
  };
}

export function cashFlow(from: string, to: string) {
  const accts = useLedger.getState().accounts;
  // Baseline snapshot is the start of the period *including* opening balances
  // (which are dated on the period-start boundary) — so brought-forward
  // positions are the opening state, not period cash movement.
  const priorDay = from;
  const cashAccts = accts.filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const cashOpen = round2(cashAccts.reduce((n, a) => n + balanceAsOf(a.number, priorDay), 0));
  const cashClose = round2(cashAccts.reduce((n, a) => n + balanceAsOf(a.number, to), 0));

  const pl = profitAndLoss(from, to);
  const netIncome = pl.netIncome;

  // non-cash: depreciation expense movement in the period
  const depreciation = round2(accts.filter((a) => a.subtype === "depreciation_expense").reduce((n, a) => n + Math.abs(periodActivity(a.number, from, to)), 0));

  // working capital movements (increase in AR uses cash, increase in AP releases cash)
  const deltaOf = (predicate: (a: Account) => boolean) =>
    round2(accts.filter(predicate).reduce((n, a) => n + (balanceAsOf(a.number, to) - balanceAsOf(a.number, priorDay)), 0));
  const arChange = deltaOf((a) => a.subtype === "accounts_receivable");
  const invChange = deltaOf((a) => a.subtype === "inventory");
  const apChange = deltaOf((a) => a.subtype === "accounts_payable");
  const otherCurrentLiabChange = deltaOf((a) => a.type === "liability" && ["current_liability", "tax_payable"].includes(a.subtype));

  const operating = round2(netIncome + depreciation - arChange - invChange + apChange + otherCurrentLiabChange);

  // investing: change in fixed-asset cost accounts (net of contra)
  const fixedAssetChange = deltaOf((a) => a.type === "asset" && ["fixed_asset"].includes(a.subtype));
  const investing = round2(-fixedAssetChange);

  // financing: change in equity (ex-retained) + long-term liabilities
  const equityChange = deltaOf((a) => a.type === "equity");
  const loanChange = deltaOf((a) => a.subtype === "long_term_liability");
  const financing = round2(equityChange + loanChange);

  const netChange = round2(operating + investing + financing);
  return {
    from,
    to,
    operating: { netIncome, depreciation, arChange: -arChange, invChange: -invChange, apChange, otherCurrentLiabChange, total: operating },
    investing: { fixedAssetChange: -fixedAssetChange, total: investing },
    financing: { equityChange, loanChange, total: financing },
    netChange,
    cashOpen,
    cashClose,
    reconciles: Math.abs(round2(cashOpen + netChange) - cashClose) < 1,
  };
}

export function generalLedgerReport(from: string, to: string) {
  const led = useLedger.getState();
  return led.accounts
    .filter((a) => a.isActive)
    .map((a) => {
      const opening = led.balanceOf(a.number, new Date(new Date(from).getTime() - 1).toISOString());
      const dc = led.debitCreditOf(a.number, { from, asOf: to });
      const closing = led.balanceOf(a.number, to);
      return { account: a, opening, debit: dc.debit, credit: dc.credit, closing };
    })
    .filter((r) => Math.abs(r.opening) > 0.005 || r.debit > 0.005 || r.credit > 0.005 || Math.abs(r.closing) > 0.005);
}

export function inventoryValuationReport() {
  const inv = useInventoryAccounting.getState();
  return inv.items.map((it) => ({ item: it, qty: it.currentQty, valuation: inv.valuationOf(it.id) }));
}

export function fixedAssetRegisterReport(asOf: string) {
  void asOf;
  return useFixedAssets.getState().assets.map((a) => ({ asset: a, nbv: netBookValue(a) }));
}

export function arAgingReport() {
  return useAR.getState().agingFor(new Date().toISOString());
}
export function apAgingReport() {
  return useAP.getState().apAgingFor(new Date().toISOString());
}

export { isDebitNormal };
