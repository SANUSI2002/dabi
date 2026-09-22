import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { useTax } from "@/store/accounting/useTax";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { ACCT } from "@/data/accounting/coa";
import {
  seedVendors,
  seedBills,
  seedVendorPayments,
  seedRequisitions,
  seedPurchaseOrders,
  seedGoodsReceipts,
  seedVendorCredits,
  type Vendor,
  type PurchaseLine,
  type PurchaseRequisition,
  type PurchaseOrder,
  type GoodsReceipt,
  type Bill,
  type VendorPayment,
  type BillPaymentAllocation,
  type VendorCredit,
} from "@/data/accounting/payables";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const daysAdd = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
const monthsAdd = (iso: string, m: number) => { const d = new Date(iso); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate())).toISOString(); };

const lineAmt = (l: PurchaseLine) => round2(l.qty * l.unitPrice);
export const purchaseSubtotal = (lines: PurchaseLine[]) => round2(lines.reduce((n, l) => n + lineAmt(l), 0));
export const purchaseTax = (lines: PurchaseLine[]) => round2(lines.reduce((n, l) => n + useTax.getState().taxTotal(lineAmt(l), useTax.getState().taxIdsOf(l)), 0));
export const purchaseTotal = (lines: PurchaseLine[]) => round2(purchaseSubtotal(lines) + purchaseTax(lines));
export const purchaseTaxBreakdown = (lines: PurchaseLine[]) => {
  const t = useTax.getState();
  const groups = new Map<number, { amount: number; label: string }>();
  for (const l of lines) for (const b of t.taxBreakdown(lineAmt(l), t.taxIdsOf(l))) {
    const cur = groups.get(b.accountNumber) ?? { amount: 0, label: b.label };
    groups.set(b.accountNumber, { amount: round2(cur.amount + b.amount), label: b.label });
  }
  return [...groups.entries()].map(([accountNumber, v]) => ({ accountNumber, amount: v.amount, label: v.label }));
};

export const fxOfBill = (b: Pick<Bill, "exchangeRate">) => b.exchangeRate || 1;
export const billBalanceNgn = (b: Bill) => round2((purchaseTotal(b.lines) - b.amountPaid) * fxOfBill(b));

function postBillJE(bill: Bill, vendor: Vendor) {
  const rate = fxOfBill(bill);
  const total = round2(purchaseTotal(bill.lines) * rate);
  const tax = round2(purchaseTax(bill.lines) * rate);
  const suffix = bill.currency !== "NGN" ? ` (${bill.currency} ${purchaseTotal(bill.lines).toLocaleString()} @ ${rate})` : "";
  const lines = [
    ...bill.lines.map((l) => ({ accountNumber: l.accountNumber, debit: round2(lineAmt(l) * rate), credit: 0, description: l.description, vendorId: vendor.id, projectId: bill.projectId })),
  ] as { accountNumber: number; debit: number; credit: number; description?: string; vendorId?: string; projectId?: string }[];
  for (const b of purchaseTaxBreakdown(bill.lines)) if (b.amount > 0) lines.push({ accountNumber: b.accountNumber, debit: round2(b.amount * rate), credit: 0, description: `Recoverable input ${b.label} — ${bill.number}`, vendorId: vendor.id });
  lines.push({ accountNumber: vendor.apAccountNumber, debit: 0, credit: total, description: `${bill.number} — ${vendor.name}${suffix}`, vendorId: vendor.id });
  return useLedger.getState().postJournal({ date: bill.date, source: "Bill", memo: `Bill ${bill.number} — ${vendor.name}`, reference: bill.number, lines });
}

function postVendorPaymentJE(vp: VendorPayment, vendor: Vendor, billLookup: (id: string) => Bill | undefined) {
  const withheld = round2(vp.withheldTax ?? 0);
  let apReliefNgn = 0;
  let fxDiff = 0;
  let bankFromAlloc = 0;
  for (const a of vp.allocations) {
    const bill = billLookup(a.billId);
    const bookRate = bill ? fxOfBill(bill) : 1;
    const setRate = bill && bill.currency !== "NGN" ? vp.settlementRate ?? bookRate : 1;
    apReliefNgn += a.amount * bookRate;
    fxDiff += a.amount * (bookRate - setRate); // paying LESS NGN than booked = gain
    bankFromAlloc += a.amount * setRate;
  }
  const unallocatedNgn = round2(vp.amount - bankFromAlloc);
  const debitAp = round2(apReliefNgn + Math.max(unallocatedNgn, 0) + withheld);
  fxDiff = round2(fxDiff);
  const lines: { accountNumber: number; debit: number; credit: number; description?: string; vendorId?: string }[] = [
    { accountNumber: vendor.apAccountNumber, debit: debitAp, credit: 0, description: `Settle ${vp.allocations.length} bill(s) — ${vendor.name}`, vendorId: vendor.id },
    { accountNumber: vp.fromAccountNumber, debit: 0, credit: vp.amount, description: `${vp.method} to ${vendor.name}` },
  ];
  if (withheld > 0) lines.push({ accountNumber: ACCT.whtPayable, debit: 0, credit: withheld, description: `WHT withheld — ${vendor.name}` });
  if (fxDiff > 0.005) lines.push({ accountNumber: ACCT.fxGain, debit: 0, credit: fxDiff, description: "Realised FX gain on settlement" });
  else if (fxDiff < -0.005) lines.push({ accountNumber: ACCT.fxLoss, debit: -fxDiff, credit: 0, description: "Realised FX loss on settlement" });
  return useLedger.getState().postJournal({ date: vp.date, source: "Vendor Payment", memo: `Payment ${vp.number} — ${vendor.name}`, reference: vp.number, lines });
}

function postVendorCreditJE(vc: VendorCredit, vendor: Vendor) {
  const total = purchaseTotal(vc.lines);
  const tax = purchaseTax(vc.lines);
  const lines = [
    { accountNumber: vendor.apAccountNumber, debit: total, credit: 0, description: `${vc.number} — ${vendor.name}`, vendorId: vendor.id },
    ...vc.lines.map((l) => ({ accountNumber: l.accountNumber, debit: 0, credit: lineAmt(l), description: l.description, vendorId: vendor.id })),
  ];
  for (const b of purchaseTaxBreakdown(vc.lines)) if (b.amount > 0) lines.push({ accountNumber: b.accountNumber, debit: 0, credit: b.amount, description: `Input ${b.label} reversed — ${vc.number}`, vendorId: vendor.id });
  return useLedger.getState().postJournal({ date: vc.date, source: "Vendor Credit", memo: `Vendor credit ${vc.number} — ${vendor.name}`, reference: vc.number, lines });
}

const billStatus = (bill: Bill): Bill["status"] => {
  if (bill.status === "Draft" || bill.status === "Pending Approval" || bill.status === "Void") return bill.status;
  const total = purchaseTotal(bill.lines);
  if (bill.amountPaid >= total - 0.01) return "Paid";
  if (new Date(bill.dueDate).getTime() < Date.now()) return "Overdue";
  if (bill.amountPaid > 0.01) return "Partially Paid";
  return "Awaiting Payment";
};

type APState = {
  vendors: Vendor[];
  requisitions: PurchaseRequisition[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  bills: Bill[];
  vendorPayments: VendorPayment[];
  vendorCredits: VendorCredit[];

  vendorById: (id?: string) => Vendor | undefined;
  addVendor: (v: Omit<Vendor, "id" | "createdAt" | "apAccountNumber" | "active" | "openingBalance"> & { openingBalance?: number }) => string;
  updateVendor: (id: string, patch: Partial<Vendor>) => void;

  // requisitions
  createRequisition: (input: { vendorId?: string; department?: string; date: string; needBy?: string; lines: PurchaseLine[]; justification: string }) => string;
  submitRequisition: (id: string) => void;
  decideRequisition: (id: string, decision: "Approved" | "Rejected", comment?: string) => void;
  convertRequisitionToPO: (id: string, vendorId: string) => string | undefined;

  // purchase orders
  createPurchaseOrder: (input: { vendorId: string; date: string; expectedDate?: string; lines: PurchaseLine[]; notes?: string; requisitionId?: string }) => string;
  sendPurchaseOrder: (id: string) => void;
  cancelPurchaseOrder: (id: string) => void;
  receiveGoods: (poId: string, received: { poLineId: string; qtyReceived: number }[], notes?: string) => void;
  /** records that these receipt lines have been received into physical stock, so they can't be received twice */
  markGoodsReceiptStocked: (id: string, poLineIds: string[]) => void;
  convertPOToBill: (id: string) => string | undefined;

  // bills
  createBill: (input: { vendorId: string; vendorInvoiceNumber?: string; date: string; dueDate?: string; lines: PurchaseLine[]; notes?: string; purchaseOrderId?: string; currency?: string; exchangeRate?: number; recurEveryMonths?: number; recurEndDate?: string; projectId?: string }) => string;
  updateBill: (id: string, patch: Partial<Pick<Bill, "date" | "dueDate" | "lines" | "notes" | "vendorInvoiceNumber">>) => void;
  submitBill: (id: string) => void;
  decideBill: (id: string, decision: "Approved" | "Rejected", comment?: string) => void;
  postBill: (id: string) => { ok: boolean; error?: string };
  voidBill: (id: string) => { ok: boolean; error?: string };

  // payments
  payVendor: (input: { vendorId: string; date: string; method: VendorPayment["method"]; fromAccountNumber: number; amount: number; allocations: BillPaymentAllocation[]; settlementRate?: number; reference?: string; withheldTax?: number }) => { ok: boolean; error?: string };
  revalueForeignAp: (asOf: string, rates: Record<string, number>) => { module: string; adjusted: number; net: number };
  runRecurringBills: (asOf: string) => { created: string[] };

  // vendor credits
  createVendorCredit: (input: { vendorId: string; billId?: string; date: string; lines: PurchaseLine[]; reason: string }) => string;
  applyVendorCredit: (vcId: string, billId: string, amount: number) => void;

  // selectors
  billsOf: (vendorId: string) => Bill[];
  openBillsOf: (vendorId: string) => Bill[];
  billBalance: (b: Bill) => number;
  vendorBalance: (vendorId: string) => number;
  apAgingFor: (asOf: string) => { vendor: Vendor; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }[];
  /** B30 — withholding-tax certificates derived from payments that withheld tax */
  whtCertificates: () => { payment: VendorPayment; vendor?: Vendor; grossPaid: number; withheld: number; rate: number; certNumber: string }[];
};

export const useAP = create<APState>((set, get) => {
  const vendors = seedVendors;
  const vOf = (id: string) => vendors.find((v) => v.id === id)!;

  const bills = seedBills.map((b) => {
    if (b.status === "Draft" || b.status === "Pending Approval" || b.status === "Void" || b.journalEntryId) return b;
    const je = postBillJE(b, vOf(b.vendorId));
    return { ...b, journalEntryId: je.entry?.id, status: billStatus(b) };
  });
  const billById = (id: string) => bills.find((b) => b.id === id);
  const vendorPayments = seedVendorPayments.map((vp) => {
    if (vp.journalEntryId) return vp;
    const je = postVendorPaymentJE(vp, vOf(vp.vendorId), billById);
    return { ...vp, journalEntryId: je.entry?.id };
  });

  return {
    vendors,
    requisitions: seedRequisitions,
    purchaseOrders: seedPurchaseOrders,
    goodsReceipts: seedGoodsReceipts,
    bills,
    vendorPayments,
    vendorCredits: seedVendorCredits,

    vendorById: (id) => get().vendors.find((v) => v.id === id),
    addVendor: (v) => {
      const id = `ven-${rid()}`;
      const vendor: Vendor = { ...v, id, apAccountNumber: ACCT.apTrade, active: true, openingBalance: v.openingBalance ?? 0, createdAt: new Date().toISOString() };
      set((s) => ({ vendors: [vendor, ...s.vendors] }));
      audit(`added vendor ${v.name}`, `accounting/vendors/${v.name}`);
      if (vendor.openingBalance > 0) {
        useLedger.getState().postJournal({
          date: useLedger.getState().booksLockedBefore ?? new Date().toISOString(),
          source: "Opening Balance",
          memo: `Opening AP balance — ${v.name}`,
          lines: [
            { accountNumber: ACCT.openingBalanceEquity, debit: vendor.openingBalance, credit: 0 },
            { accountNumber: vendor.apAccountNumber, debit: 0, credit: vendor.openingBalance, vendorId: id },
          ],
        });
      }
      return id;
    },
    updateVendor: (id, patch) => {
      set((s) => ({ vendors: s.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
      audit(`updated vendor`, `accounting/vendors/${id}`);
    },

    createRequisition: (input) => {
      const id = `pr-${rid()}`;
      const pr: PurchaseRequisition = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("requisition"),
        vendorId: input.vendorId,
        requestedBy: useIdentity.getState().user.id,
        department: input.department,
        date: input.date,
        needBy: input.needBy,
        lines: input.lines,
        justification: input.justification,
        status: "Draft",
        approval: { status: "Not Required", currentLevel: 0, steps: [] },
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ requisitions: [pr, ...s.requisitions] }));
      audit(`created purchase requisition ${pr.number}`, `accounting/requisitions/${pr.number}`);
      return id;
    },
    submitRequisition: (id) => {
      const pr = get().requisitions.find((x) => x.id === id);
      if (!pr) return;
      const approval = useAcctControl.getState().buildApproval("Purchase Requisition", purchaseTotal(pr.lines), useIdentity.getState().user.id);
      set((s) => ({ requisitions: s.requisitions.map((x) => (x.id === id ? { ...x, approval, status: approval.status === "Not Required" ? "Approved" : "Pending Approval" } : x)) }));
      audit(`submitted requisition ${pr.number} for approval`, `accounting/requisitions/${pr.number}`);
    },
    decideRequisition: (id, decision, comment) => {
      set((s) => ({
        requisitions: s.requisitions.map((x) => {
          if (x.id !== id) return x;
          const approval = useAcctControl.getState().decide(x.approval, decision, comment);
          return { ...x, approval, status: approval.status === "Approved" ? "Approved" : approval.status === "Rejected" ? "Rejected" : x.status };
        }),
      }));
      audit(`${decision.toLowerCase()} requisition`, `accounting/requisitions/${id}`);
    },
    convertRequisitionToPO: (id, vendorId) => {
      const pr = get().requisitions.find((x) => x.id === id);
      if (!pr || pr.status !== "Approved") return;
      const poId = get().createPurchaseOrder({ vendorId, date: new Date().toISOString(), lines: pr.lines, requisitionId: pr.id });
      set((s) => ({ requisitions: s.requisitions.map((x) => (x.id === id ? { ...x, status: "Ordered", purchaseOrderId: poId } : x)) }));
      return poId;
    },

    createPurchaseOrder: (input) => {
      const id = `po-${rid()}`;
      const po: PurchaseOrder = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("po"),
        vendorId: input.vendorId,
        requisitionId: input.requisitionId,
        date: input.date,
        expectedDate: input.expectedDate,
        lines: input.lines,
        notes: input.notes,
        status: "Draft",
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ purchaseOrders: [po, ...s.purchaseOrders] }));
      audit(`created purchase order ${po.number}`, `accounting/purchase-orders/${po.number}`);
      return id;
    },
    sendPurchaseOrder: (id) => set((s) => ({ purchaseOrders: s.purchaseOrders.map((o) => (o.id === id ? { ...o, status: "Sent" } : o)) })),
    cancelPurchaseOrder: (id) => set((s) => ({ purchaseOrders: s.purchaseOrders.map((o) => (o.id === id ? { ...o, status: "Cancelled" } : o)) })),

    receiveGoods: (poId, received, notes) => {
      const po = get().purchaseOrders.find((x) => x.id === poId);
      if (!po) return;
      const grId = `gr-${rid()}`;
      const gr: GoodsReceipt = {
        id: grId,
        number: useAccountingSettings.getState().nextDocNumber("goods-receipt"),
        purchaseOrderId: poId,
        vendorId: po.vendorId,
        date: new Date().toISOString(),
        receivedBy: useIdentity.getState().user.id,
        lines: po.lines.map((l) => ({ poLineId: l.id, description: l.description, qtyOrdered: l.qty, qtyReceived: received.find((r) => r.poLineId === l.id)?.qtyReceived ?? 0, itemId: l.itemId })),
        notes,
        createdAt: new Date().toISOString(),
      };
      const fullyReceived = gr.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
      set((s) => ({
        goodsReceipts: [gr, ...s.goodsReceipts],
        purchaseOrders: s.purchaseOrders.map((o) => (o.id === poId ? { ...o, status: fullyReceived ? "Received" : "Partially Received" } : o)),
      }));
      audit(`recorded goods receipt ${gr.number}`, `accounting/goods-receipts/${gr.number}`);
    },
    markGoodsReceiptStocked: (id, poLineIds) =>
      set((s) => ({
        goodsReceipts: s.goodsReceipts.map((g) => (g.id === id ? { ...g, stockedLineIds: [...new Set([...(g.stockedLineIds ?? []), ...poLineIds])] } : g)),
      })),
    convertPOToBill: (id) => {
      const po = get().purchaseOrders.find((x) => x.id === id);
      if (!po) return;
      const billId = get().createBill({ vendorId: po.vendorId, date: new Date().toISOString(), lines: po.lines, purchaseOrderId: po.id });
      set((s) => ({ purchaseOrders: s.purchaseOrders.map((x) => (x.id === id ? { ...x, status: "Billed", billId } : x)) }));
      return billId;
    },

    createBill: (input) => {
      const id = `bill-${rid()}`;
      const vendor = get().vendorById(input.vendorId);
      const currency = input.currency ?? vendor?.currency ?? "NGN";
      const rate = currency === "NGN" ? 1 : input.exchangeRate ?? (useLedger.getState().fxRates.find((r) => r.code === currency)?.rateToNgn ?? 1);
      const bill: Bill = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("bill"),
        vendorInvoiceNumber: input.vendorInvoiceNumber,
        vendorId: input.vendorId,
        purchaseOrderId: input.purchaseOrderId,
        projectId: input.projectId,
        date: input.date,
        dueDate: input.dueDate ?? useAccountingSettings.getState().dueDateFor(input.date, vendor?.paymentTermId, vendor?.paymentTermsDays ?? 30),
        lines: input.lines,
        notes: input.notes,
        status: "Draft",
        approval: { status: "Not Required", currentLevel: 0, steps: [] },
        amountPaid: 0,
        currency,
        exchangeRate: rate,
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
        ...(input.recurEveryMonths ? { isRecurring: true, recurrenceEveryMonths: input.recurEveryMonths, recurrenceNextDate: monthsAdd(input.date, input.recurEveryMonths), recurrenceEndDate: input.recurEndDate } : {}),
      };
      set((s) => ({ bills: [bill, ...s.bills] }));
      audit(`entered bill ${bill.number}`, `accounting/bills/${bill.number}`);
      return id;
    },
    updateBill: (id, patch) => set((s) => ({ bills: s.bills.map((b) => (b.id === id && b.status === "Draft" ? { ...b, ...patch } : b)) })),
    submitBill: (id) => {
      const b = get().bills.find((x) => x.id === id);
      if (!b) return;
      const approval = useAcctControl.getState().buildApproval("Bill", purchaseTotal(b.lines), useIdentity.getState().user.id);
      if (approval.status === "Not Required") {
        get().postBill(id);
        return;
      }
      set((s) => ({ bills: s.bills.map((x) => (x.id === id ? { ...x, approval, status: "Pending Approval" } : x)) }));
      audit(`submitted bill ${b.number} for approval`, `accounting/bills/${b.number}`);
    },
    decideBill: (id, decision, comment) => {
      const before = get().bills.find((x) => x.id === id);
      if (!before) return;
      const approval = useAcctControl.getState().decide(before.approval, decision, comment);
      set((s) => ({ bills: s.bills.map((x) => (x.id === id ? { ...x, approval } : x)) }));
      audit(`${decision.toLowerCase()} bill ${before.number}`, `accounting/bills/${before.number}`);
      if (approval.status === "Approved") get().postBill(id);
      else if (approval.status === "Rejected") set((s) => ({ bills: s.bills.map((x) => (x.id === id ? { ...x, status: "Void" } : x)) }));
    },
    postBill: (id) => {
      const bill = get().bills.find((x) => x.id === id);
      if (!bill || (bill.status !== "Draft" && bill.status !== "Pending Approval")) return { ok: false, error: "Bill is not awaiting posting." };
      const vendor = get().vendorById(bill.vendorId);
      if (!vendor) return { ok: false, error: "Vendor not found." };
      if (purchaseTotal(bill.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      const je = postBillJE(bill, vendor);
      if (!je.ok) return { ok: false, error: je.error };
      set((s) => ({ bills: s.bills.map((x) => (x.id === id ? { ...x, journalEntryId: je.entry?.id, postedAt: new Date().toISOString(), status: billStatus({ ...x, status: "Awaiting Payment" }) } : x)) }));
      audit(`posted bill ${bill.number}`, `accounting/bills/${bill.number}`);
      return { ok: true };
    },
    voidBill: (id) => {
      const bill = get().bills.find((x) => x.id === id);
      if (!bill) return { ok: false, error: "Not found." };
      if (bill.amountPaid > 0) return { ok: false, error: "Un-apply payments before voiding." };
      if (bill.journalEntryId) {
        const r = useLedger.getState().reverseEntry(bill.journalEntryId, { memo: `Void bill ${bill.number}` });
        if (!r.ok) return { ok: false, error: r.error };
      }
      set((s) => ({ bills: s.bills.map((x) => (x.id === id ? { ...x, status: "Void" } : x)) }));
      audit(`voided bill ${bill.number}`, `accounting/bills/${bill.number}`);
      return { ok: true };
    },

    payVendor: (input) => {
      const vendor = get().vendorById(input.vendorId);
      if (!vendor) return { ok: false, error: "Vendor not found." };
      const allocTotal = round2(input.allocations.reduce((n, a) => n + a.amount, 0));
      if (allocTotal > input.amount + round2(input.withheldTax ?? 0) + 0.01) return { ok: false, error: "Allocations exceed the payment." };
      const id = `vp-${rid()}`;
      const vp: VendorPayment = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("payment"),
        vendorId: input.vendorId,
        date: input.date,
        method: input.method,
        fromAccountNumber: input.fromAccountNumber,
        amount: input.amount,
        allocations: input.allocations.filter((a) => a.amount > 0),
        settlementRate: input.settlementRate,
        reference: input.reference,
        withheldTax: input.withheldTax,
        approval: { status: "Not Required", currentLevel: 0, steps: [] },
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postVendorPaymentJE(vp, vendor, (bid) => get().bills.find((b) => b.id === bid));
      if (!je.ok) return { ok: false, error: je.error };
      vp.journalEntryId = je.entry?.id;
      set((s) => ({
        vendorPayments: [vp, ...s.vendorPayments],
        bills: s.bills.map((b) => {
          const a = vp.allocations.find((x) => x.billId === b.id);
          if (!a) return b;
          const paid = round2(b.amountPaid + a.amount);
          return { ...b, amountPaid: paid, status: billStatus({ ...b, amountPaid: paid }) };
        }),
      }));
      audit(`paid vendor ${vendor.name} — ${vp.number}`, `accounting/vendor-payments/${vp.number}`);
      return { ok: true };
    },

    createVendorCredit: (input) => {
      const vendor = get().vendorById(input.vendorId)!;
      const id = `vc-${rid()}`;
      const vc: VendorCredit = {
        id,
        number: useAccountingSettings.getState().nextDocNumber("vendor-credit"),
        vendorId: input.vendorId,
        billId: input.billId,
        date: input.date,
        lines: input.lines,
        reason: input.reason,
        status: "Open",
        applications: [],
        createdBy: useIdentity.getState().user.id,
        createdAt: new Date().toISOString(),
      };
      const je = postVendorCreditJE(vc, vendor);
      vc.journalEntryId = je.entry?.id;
      set((s) => ({ vendorCredits: [vc, ...s.vendorCredits] }));
      audit(`recorded vendor credit ${vc.number}`, `accounting/vendor-credits/${vc.number}`);
      return id;
    },
    applyVendorCredit: (vcId, billId, amount) => {
      const amt = round2(amount);
      set((s) => ({
        vendorCredits: s.vendorCredits.map((vc) => {
          if (vc.id !== vcId) return vc;
          const apps = [...vc.applications, { billId, amount: amt, date: new Date().toISOString() }];
          const used = round2(apps.reduce((n, a) => n + a.amount, 0));
          return { ...vc, applications: apps, status: used >= purchaseTotal(vc.lines) - 0.01 ? "Applied" : "Partially Applied" };
        }),
        bills: s.bills.map((b) => {
          if (b.id !== billId) return b;
          const paid = round2(b.amountPaid + amt);
          return { ...b, amountPaid: paid, status: billStatus({ ...b, amountPaid: paid }) };
        }),
      }));
      audit(`applied vendor credit to bill`, `accounting/vendor-credits/${vcId}`);
    },

    revalueForeignAp: (asOf, rates) => {
      const led = useLedger.getState();
      const open = get().bills.filter((b) => b.currency !== "NGN" && (b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue"));
      let adjusted = 0;
      let net = 0;
      for (const bill of open) {
        const newRate = rates[bill.currency];
        if (!newRate || Math.abs(newRate - fxOfBill(bill)) < 0.005) continue;
        const balForeign = round2(purchaseTotal(bill.lines) - bill.amountPaid);
        const delta = round2(balForeign * (newRate - fxOfBill(bill))); // AP owed goes up when rate rises
        if (Math.abs(delta) < 0.005) continue;
        const vendor = get().vendorById(bill.vendorId)!;
        led.postJournal({
          date: asOf,
          source: "FX Revaluation",
          memo: `FX revaluation — ${bill.number} (${bill.currency} ${fxOfBill(bill)} → ${newRate})`,
          reference: bill.number,
          lines: delta > 0
            ? [{ accountNumber: ACCT.fxLoss, debit: delta, credit: 0, description: "Unrealised FX loss" }, { accountNumber: vendor.apAccountNumber, debit: 0, credit: delta, vendorId: vendor.id }]
            : [{ accountNumber: vendor.apAccountNumber, debit: -delta, credit: 0, vendorId: vendor.id }, { accountNumber: ACCT.fxGain, debit: 0, credit: -delta, description: "Unrealised FX gain" }],
        });
        set((s) => ({ bills: s.bills.map((x) => (x.id === bill.id ? { ...x, exchangeRate: newRate } : x)) }));
        adjusted++;
        net = round2(net + delta);
      }
      audit(`revalued ${adjusted} foreign AP balance(s) — net ${net.toLocaleString()}`, "accounting/fx/revaluation");
      return { module: "AP", adjusted, net };
    },

    runRecurringBills: (asOf) => {
      const t = new Date(asOf).getTime();
      const created: string[] = [];
      for (const src of get().bills.filter((b) => b.isRecurring && b.recurrenceNextDate && new Date(b.recurrenceNextDate).getTime() <= t)) {
        if (src.recurrenceEndDate && new Date(src.recurrenceNextDate!).getTime() > new Date(src.recurrenceEndDate).getTime()) continue;
        const newId = get().createBill({ vendorId: src.vendorId, date: src.recurrenceNextDate!, lines: src.lines, notes: `Recurring from ${src.number}`, currency: src.currency, exchangeRate: src.exchangeRate });
        get().postBill(newId);
        created.push(newId);
        set((s) => ({ bills: s.bills.map((x) => (x.id === src.id ? { ...x, recurrenceNextDate: monthsAdd(x.recurrenceNextDate!, x.recurrenceEveryMonths ?? 1) } : x)) }));
      }
      if (created.length) audit(`generated ${created.length} recurring bill(s)`, "accounting/bills/recurring");
      return { created };
    },

    whtCertificates: () =>
      get().vendorPayments
        .filter((p) => (p.withheldTax ?? 0) > 0)
        .map((payment) => {
          const grossPaid = round2(payment.amount + (payment.withheldTax ?? 0));
          const withheld = round2(payment.withheldTax ?? 0);
          return {
            payment,
            vendor: get().vendorById(payment.vendorId),
            grossPaid,
            withheld,
            rate: grossPaid > 0 ? round2((withheld / grossPaid) * 100) : 0,
            certNumber: `WHT/${new Date(payment.date).getUTCFullYear()}/${payment.number.replace(/\D/g, "").slice(-6)}`,
          };
        }),

    billsOf: (vendorId) => get().bills.filter((b) => b.vendorId === vendorId),
    openBillsOf: (vendorId) => get().bills.filter((b) => b.vendorId === vendorId && (b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue")),
    billBalance: (b) => round2(purchaseTotal(b.lines) - b.amountPaid),
    vendorBalance: (vendorId) => {
      const open = get().bills.filter((b) => b.vendorId === vendorId && b.status !== "Draft" && b.status !== "Pending Approval" && b.status !== "Void");
      return round2(open.reduce((n, b) => n + billBalanceNgn(b), 0));
    },
    apAgingFor: (asOf) => {
      const now = new Date(asOf).getTime();
      return get().vendors.map((vendor) => {
        const bucket = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
        get()
          .bills.filter((b) => b.vendorId === vendor.id && (b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue"))
          .forEach((b) => {
            const bal = billBalanceNgn(b);
            const od = Math.floor((now - new Date(b.dueDate).getTime()) / 864e5);
            if (od <= 0) bucket.current += bal;
            else if (od <= 30) bucket.d1_30 += bal;
            else if (od <= 60) bucket.d31_60 += bal;
            else if (od <= 90) bucket.d61_90 += bal;
            else bucket.d90plus += bal;
          });
        const total = round2(bucket.current + bucket.d1_30 + bucket.d31_60 + bucket.d61_90 + bucket.d90plus);
        return { vendor, ...bucket, total };
      });
    },
  };
});
