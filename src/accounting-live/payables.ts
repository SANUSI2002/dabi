import { create } from "zustand";
import { purchaseTotal, useAP } from "@/store/accounting/useAP";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { accountingRequest } from "@/emr-live/client";
import type { Bill, GoodsReceipt, PurchaseLine, PurchaseOrder, PurchaseRequisition, Vendor, VendorCredit, VendorPayment } from "@/data/accounting/payables";
import type { ApprovalRule, DocApproval } from "@/data/accounting/control";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";

// Payables in live mode (GET /payables): vendors, requisitions, orders, goods receipts, bills, payments and
// vendor credits are the organization's records. Approvals follow the organization's rules on the server:
// whether a step is yours to decide comes from the server (your finance role, and never your own
// submission), and a bill posts only once approved — as does a payment a rule covers. The books reload after
// every change.

type Versioned = { version?: number };
type LiveApproval = DocApproval & { decidableByMe?: boolean; submittedByMe?: boolean };
type ApiAP = {
  vendors: (Vendor & Versioned)[]; requisitions: (PurchaseRequisition & Versioned)[]; purchaseOrders: (PurchaseOrder & Versioned)[]; goodsReceipts: GoodsReceipt[];
  bills: (Bill & Versioned)[]; vendorPayments: VendorPayment[]; vendorCredits: (VendorCredit & Versioned)[];
};

export const useLiveAPMeta = create<{ loaded: boolean }>(() => ({ loaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as T;

export async function loadPayables() {
  const { data } = await accountingRequest<{ data: ApiAP }>("/payables");
  useLiveAPMeta.setState({ loaded: true });
  useAP.setState({
    vendors: data.vendors.map((v) => noNull(v)), requisitions: data.requisitions.map((d) => noNull(d)), purchaseOrders: data.purchaseOrders.map((d) => noNull(d)),
    goodsReceipts: data.goodsReceipts.map((g) => noNull(g)), bills: data.bills.map((d) => noNull(d)), vendorPayments: data.vendorPayments.map((p) => noNull(p)), vendorCredits: data.vendorCredits.map((d) => noNull(d)),
  });
  adoptLiveIdentity(null);
}

const reload = async () => { await Promise.all([loadPayables(), loadLedger()]); };
const P = () => useAP.getState();
const post = (path: string, body: unknown = {}) => accountingRequest(`/payables${path}`, { method: "POST", body });
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const versionOf = (list: ({ id: string } & Versioned)[], id: string) => list.find((x) => x.id === id)?.version ?? 1;
const lineBody = (lines: PurchaseLine[]) => lines.map((l) => defined({ id: l.id, accountNumber: l.accountNumber, description: l.description, qty: l.qty, unitPrice: l.unitPrice, taxRateId: l.taxRateId, taxRateIds: l.taxRateIds?.length ? l.taxRateIds : undefined, itemId: l.itemId }));
const vendorBody = (v: Partial<Vendor> & { openingBalance?: number }) => defined({ name: v.name, email: v.email, phone: v.phone, address: v.address, taxId: v.taxId, category: v.category, currency: v.currency, paymentTermsDays: v.paymentTermsDays, paymentTermId: v.paymentTermId, openingBalance: v.openingBalance || undefined });

export function goLivePayables() {
  useAP.setState({
    addVendor: (v) => { const id = uuid(); void liveChange(() => post("/vendors", { id, ...vendorBody(v) }), reload); return id; },
    updateVendor: (id, change) => {
      const body = defined({ ...vendorBody(change), active: change.active });
      void liveChange(() => accountingRequest(`/payables/vendors/${id}`, { method: "PATCH", body, version: versionOf(P().vendors, id) }), reload, () => useAP.setState((s) => ({ vendors: s.vendors.map((v) => (v.id === id ? { ...v, ...change } : v)) })));
    },

    createRequisition: (input) => { const id = uuid(); void liveChange(() => post("/requisitions", defined({ id, vendorId: input.vendorId, department: input.department, date: input.date, needBy: input.needBy, lines: lineBody(input.lines), justification: input.justification })), reload); return id; },
    submitRequisition: (id) => { void liveChange(() => post(`/requisitions/${id}/submit`), reload); },
    decideRequisition: (id, decision, comment) => { void liveChange(() => post(`/requisitions/${id}/decide`, defined({ decision, comment })), reload); },
    convertRequisitionToPO: (id, vendorId) => {
      if (P().requisitions.find((x) => x.id === id)?.status !== "Approved") return undefined;
      const newId = uuid();
      void liveChange(() => post(`/requisitions/${id}/convert`, { vendorId, newId }), reload);
      return newId;
    },

    createPurchaseOrder: (input) => { const id = uuid(); void liveChange(() => post("/purchase-orders", defined({ id, vendorId: input.vendorId, date: input.date, expectedDate: input.expectedDate, lines: lineBody(input.lines), notes: input.notes, requisitionId: input.requisitionId })), reload); return id; },
    sendPurchaseOrder: (id) => { void liveChange(() => post(`/purchase-orders/${id}/status`, { status: "Sent" }), reload); },
    cancelPurchaseOrder: (id) => { void liveChange(() => post(`/purchase-orders/${id}/status`, { status: "Cancelled" }), reload); },
    receiveGoods: (poId, received, notes) => { void liveChange(() => post(`/purchase-orders/${poId}/receive`, defined({ id: uuid(), received, notes })), reload); },
    markGoodsReceiptStocked: (id, poLineIds) => { void liveChange(() => post(`/goods-receipts/${id}/stocked`, { poLineIds }), reload); },
    convertPOToBill: (id) => { const newId = uuid(); void liveChange(() => post(`/purchase-orders/${id}/bill`, { newId }), reload); return newId; },

    createBill: (input) => {
      const id = uuid();
      void liveChange(() => post("/bills", defined({
        id, vendorId: input.vendorId, vendorInvoiceNumber: input.vendorInvoiceNumber, date: input.date, dueDate: input.dueDate, lines: lineBody(input.lines), notes: input.notes, purchaseOrderId: input.purchaseOrderId,
        currency: input.currency, exchangeRate: input.currency && input.currency !== "NGN" ? input.exchangeRate : undefined, recurEveryMonths: input.recurEveryMonths || undefined, recurEndDate: input.recurEndDate, projectId: input.projectId,
      })), reload);
      return id;
    },
    updateBill: (id, change) => {
      void liveChange(() => accountingRequest(`/payables/docs/bill/${id}`, { method: "PATCH", body: defined({ date: change.date, dueDate: change.dueDate, vendorInvoiceNumber: change.vendorInvoiceNumber, lines: change.lines ? lineBody(change.lines) : undefined, notes: change.notes }), version: versionOf(P().bills, id) }), reload);
    },
    submitBill: (id) => { void liveChange(() => post(`/bills/${id}/submit`), reload); },
    decideBill: (id, decision, comment) => { void liveChange(() => post(`/bills/${id}/decide`, defined({ decision, comment })), reload); },
    decideVendorPayment: (id, decision, comment) => { void liveChange(() => post(`/payments/${id}/decide`, defined({ decision, comment })), reload); },
    postBill: (id) => {
      const bill = P().bills.find((x) => x.id === id);
      if (!bill || bill.status !== "Draft") return { ok: false, error: "Bill is not awaiting posting." };
      if (purchaseTotal(bill.lines) <= 0) return { ok: false, error: "Add at least one line with an amount." };
      // Posting goes through submission so the organization's approval rules apply.
      void liveChange(() => post(`/bills/${id}/submit`), reload);
      return { ok: true };
    },
    voidBill: (id) => {
      const bill = P().bills.find((x) => x.id === id);
      if (!bill) return { ok: false, error: "Not found." };
      if (bill.amountPaid > 0) return { ok: false, error: "Un-apply payments before voiding." };
      void liveChange(() => post(`/bills/${id}/void`), reload);
      return { ok: true };
    },

    payVendor: (input) => {
      if (!P().vendorById(input.vendorId)) return { ok: false, error: "Vendor not found." };
      const allocTotal = Math.round(input.allocations.reduce((n, a) => n + a.amount, 0) * 100) / 100;
      if (allocTotal > input.amount + (input.withheldTax ?? 0) + 0.01) return { ok: false, error: "Allocations exceed the payment." };
      void liveChange(() => post("/payments", defined({
        id: uuid(), vendorId: input.vendorId, date: input.date, method: input.method, fromAccountNumber: input.fromAccountNumber, amount: input.amount,
        allocations: input.allocations.filter((a) => a.amount > 0), settlementRate: input.settlementRate, reference: input.reference, withheldTax: input.withheldTax || undefined,
      })), reload);
      return { ok: true };
    },
    createVendorCredit: (input) => { const id = uuid(); void liveChange(() => post("/vendor-credits", defined({ id, vendorId: input.vendorId, billId: input.billId, date: input.date, lines: lineBody(input.lines), reason: input.reason })), reload); return id; },
    applyVendorCredit: (vcId, billId, amount) => { void liveChange(() => post(`/vendor-credits/${vcId}/apply`, { billId, amount }), reload); },

    revalueForeignAp: (asOf, rates) => {
      let adjusted = 0;
      let net = 0;
      for (const bill of P().bills.filter((b) => b.currency !== "NGN" && (b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue"))) {
        const to = rates[bill.currency];
        const from = bill.exchangeRate || 1;
        if (!to || Math.abs(to - from) < 0.005) continue;
        const delta = Math.round((purchaseTotal(bill.lines) - bill.amountPaid) * (to - from) * 100) / 100;
        if (Math.abs(delta) < 0.005) continue;
        adjusted += 1;
        net = Math.round((net + delta) * 100) / 100;
      }
      if (adjusted) void liveChange(() => post("/revaluation", { asOf, rates }), reload);
      return { module: "AP", adjusted, net };
    },
    runRecurringBills: (asOf) => {
      const due = P().bills.filter((b) => b.isRecurring && b.recurrenceNextDate && new Date(b.recurrenceNextDate).getTime() <= new Date(asOf).getTime()).map((b) => b.id);
      void liveChange(() => post("/bills/recurring/run", { asOf }), reload);
      return { created: due };
    },
  });

  const reloadRules = () => loadLedger(); // the approval rules come with the books
  useAcctControl.setState({
    // The server says whether the current step is yours (your finance role, never your own submission).
    canDecide: (approval) => (approval as LiveApproval).decidableByMe === true,
    addRule: (r) => { void liveChange(() => accountingRequest("/approval-rules", { method: "POST", body: { id: uuid(), ...r } }), reloadRules); },
    updateRule: (id, change) => {
      const version = (useAcctControl.getState().rules.find((x) => x.id === id) as (ApprovalRule & Versioned) | undefined)?.version ?? 1;
      const body = defined({ minAmount: change.minAmount, maxAmount: change.maxAmount === undefined ? undefined : change.maxAmount, approverRole: change.approverRole, level: change.level, active: change.active });
      if (change.maxAmount === null) body.maxAmount = null;
      void liveChange(() => accountingRequest(`/approval-rules/${id}`, { method: "PATCH", body, version }), reloadRules, () => useAcctControl.setState((s) => ({ rules: s.rules.map((x) => (x.id === id ? { ...x, ...change } : x)) })));
    },
    // A rule stays on record; removing it switches it off.
    removeRule: (id) => useAcctControl.getState().updateRule(id, { active: false }),
  });
}

export function clearPayables() {
  useLiveAPMeta.setState({ loaded: false });
  useAP.setState({ vendors: [], requisitions: [], purchaseOrders: [], goodsReceipts: [], bills: [], vendorPayments: [], vendorCredits: [] });
}
