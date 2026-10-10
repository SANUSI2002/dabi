import { useEffect, useRef } from "react";
import { create } from "zustand";
import type { Patient } from "@/data/types";
import type {
  BillingAuditEvent, ChargeException, ChargeItem, ChargeSourceType, ChargeStatus, CurrencyCode, FinancialStatus, InvoiceStatus,
  PatientAccount, Payment, PaymentMethod, Receipt, RevenueInvoice, RevenueInvoiceLine,
} from "@/billing/domain";
import { minorMoney } from "@/billing/useRevenueCycle";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// The hospital's billing desk for the live Billing screens. The backend works per visit: charges are
// captured from the visit's clinical records, an invoice claims every unbilled charge, payments go
// against an invoice. The screens were built around "patient accounts", so each visit becomes one
// account here, in the same shapes the demo store uses. Every action goes to the server and the data
// is reloaded from it; nothing is calculated or kept locally.

const REFRESH_MS = 30_000;

type ApiCategory = "CONSULTATION" | "LAB" | "MEDICATION" | "BED_DAY" | "PROCEDURE" | "OTHER";
type ApiCharge = {
  id: string; encounterId: string; patientId: string; category: ApiCategory; description: string; quantity: number;
  unitPriceMinor: number; amountMinor: number; taxMinor: number; currency: string; sourceType: string; sourceKey: string | null;
  serviceAt: string; status: "UNBILLED" | "INVOICED" | "VOIDED"; invoiceId: string | null; createdByName?: string | null; createdAt: string;
};
type ApiInvoice = {
  id: string; number: string; status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID"; patientId: string; encounterId: string; currency: string;
  subtotalMinor: number; taxMinor: number; discountMinor: number; totalMinor: number; amountPaidMinor: number; balanceMinor: number;
  dueDate: string | null; issuedAt: string; createdAt: string; version: number;
};
type ApiPaymentMethod = "CASH" | "CARD" | "POS" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE";
type ApiPayment = {
  id: string; invoiceId: string; patientId: string; receiptNumber: string; method: ApiPaymentMethod; amountMinor: number; reference: string | null;
  transactionDate: string | null; receivingAccount: string | null; notes: string | null; status: "POSTED" | "REVERSED"; receivedAt: string;
  receivedByName?: string | null; reversedByName?: string | null;
};
type ApiEncounter = { id: string; class: "OUTPATIENT" | "INPATIENT" | "EMERGENCY" | "TELEHEALTH"; status: string; visitType: string | null; arrivedAt: string; endedAt: string | null; attendingName: string | null };
type ApiUnpriced = { category: ApiCategory; reference: string; description: string };
type ApiRow = { encounter: ApiEncounter & { source: string }; patient: ApiPatient; charges: ApiCharge[]; invoices: ApiInvoice[]; payments: ApiPayment[]; unpriced: ApiUnpriced[] | null };
type ApiWorklist = { items: ApiRow[]; nextCursor: string | null; totals: { collectedMinor: number; unbilledMinor: number; outstandingMinor: number }; captured: boolean };
type ApiLedger = { id: string; kind: "INVOICE_ISSUED" | "PAYMENT" | "PAYMENT_REVERSED" | "INVOICE_VOIDED"; amountMinor: number; balanceAfterMinor: number; paymentId: string | null; createdAt: string; createdByName: string | null };
type ApiInvoiceDetail = ApiInvoice & {
  patient: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth"> & { sex?: ApiPatient["sex"] };
  charges: ApiCharge[]; payments: ApiPayment[]; ledger: ApiLedger[]; issuedByName: string | null;
  encounter: ApiEncounter | null;
};

// ---- mapping to the screens' shapes ----

const CLASS_LABEL: Record<ApiEncounter["class"], string> = { OUTPATIENT: "Outpatient", INPATIENT: "Inpatient", EMERGENCY: "Emergency", TELEHEALTH: "Telehealth" };
const DEPARTMENT: Record<ApiCategory, string> = { CONSULTATION: "Consultation", LAB: "Laboratory", MEDICATION: "Pharmacy", BED_DAY: "Ward", PROCEDURE: "Procedure", OTHER: "Other" };
const SOURCE: Record<ApiCategory, ChargeSourceType> = { CONSULTATION: "CONSULTATION", LAB: "LABORATORY", MEDICATION: "PHARMACY", BED_DAY: "WARD", PROCEDURE: "PROCEDURE", OTHER: "OTHER" };
const CHARGE_STATUS: Record<ApiCharge["status"], ChargeStatus> = { UNBILLED: "BILLABLE", INVOICED: "INVOICED", VOIDED: "VOIDED" };
const INVOICE_STATUS: Record<ApiInvoice["status"], InvoiceStatus> = { ISSUED: "ISSUED", PARTIALLY_PAID: "PARTIALLY_PAID", PAID: "PAID", VOID: "VOIDED" };
const METHOD_FROM_API: Record<ApiPaymentMethod, PaymentMethod> = { CASH: "CASH", CARD: "CARD_POS", POS: "CARD_POS", BANK_TRANSFER: "BANK_TRANSFER", MOBILE_MONEY: "MOBILE_MONEY", CHEQUE: "CHEQUE" };
const METHOD_TO_API: Partial<Record<PaymentMethod, ApiPaymentMethod>> = { CASH: "CASH", CARD_POS: "POS", BANK_TRANSFER: "BANK_TRANSFER", MOBILE_MONEY: "MOBILE_MONEY", CHEQUE: "CHEQUE" };
/** The methods the hospital's billing service accepts (insurance claims are not supported yet). */
export const LIVE_PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD_POS", "BANK_TRANSFER", "MOBILE_MONEY", "CHEQUE"];

const visitLabel = (e: ApiEncounter) => `${CLASS_LABEL[e.class]}${e.visitType ? ` · ${e.visitType}` : ""}`;
const arrivalLabel = (at: string) => `Visit of ${new Date(at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`;

export function chargeFromApi(c: ApiCharge): ChargeItem {
  return {
    id: c.id, organizationId: "", branchId: "", patientId: c.patientId, encounterId: c.encounterId, accountId: c.encounterId,
    sourceType: SOURCE[c.category], sourceId: c.sourceKey ?? "manual entry", sourceEventId: c.sourceKey ?? c.id, idempotencyKey: c.id,
    serviceId: c.category, serviceCode: c.category, description: c.description, department: DEPARTMENT[c.category], quantity: c.quantity,
    unitPriceMinor: c.unitPriceMinor, grossAmountMinor: c.amountMinor, discountAmountMinor: 0, netAmountMinor: c.amountMinor + c.taxMinor,
    currency: c.currency as CurrencyCode, status: CHARGE_STATUS[c.status],
    performedBy: c.sourceType === "MANUAL" ? `Added by ${c.createdByName ?? "staff"}` : "From the visit's records",
    performedAt: c.serviceAt, priceListId: "", priceVersionId: "", invoiceId: c.invoiceId ?? undefined, correlationId: c.id, createdAt: c.createdAt, createdBy: c.createdByName ?? "",
  };
}

function invoiceFromApi(i: ApiInvoice, payer: string, lines: RevenueInvoiceLine[] = []): RevenueInvoice {
  return {
    id: i.id, organizationId: "", branchId: "", number: i.number, patientId: i.patientId, encounterId: i.encounterId, accountId: i.encounterId,
    payer, status: INVOICE_STATUS[i.status], lines, subtotalMinor: i.subtotalMinor, discountMinor: i.discountMinor, taxMinor: i.taxMinor,
    totalMinor: i.totalMinor, paidMinor: i.amountPaidMinor, balanceMinor: i.balanceMinor, currency: i.currency as CurrencyCode,
    issuedAt: i.issuedAt, dueAt: i.dueDate ?? undefined, correlationId: i.id, createdAt: i.createdAt, createdBy: "",
  };
}

function paymentFromApi(p: ApiPayment, encounterId: string, currency: string): Payment {
  return {
    id: p.id, organizationId: "", patientId: p.patientId, accountId: encounterId, amountMinor: p.amountMinor, currency: currency as CurrencyCode,
    method: METHOD_FROM_API[p.method], paymentDate: p.transactionDate ? `${p.transactionDate}T12:00:00.000Z` : p.receivedAt,
    reference: p.reference ?? undefined, receivingAccount: p.receivingAccount ?? "—", notes: p.notes ?? undefined,
    receivedBy: p.receivedByName ?? "—", status: p.status === "POSTED" ? "SUCCEEDED" : "REVERSED", correlationId: p.id, createdAt: p.receivedAt,
  };
}

/** Where a visit stands financially, from its charges and invoices. */
export function financialStatusFor(charges: ChargeItem[], invoices: RevenueInvoice[]): FinancialStatus {
  const live = charges.filter((c) => c.status !== "VOIDED");
  const open = invoices.filter((i) => i.status !== "VOIDED");
  const unbilled = live.some((c) => c.status === "BILLABLE");
  if (!live.length && !open.length) return "OPEN";
  if (unbilled) return open.length ? "PARTIALLY_INVOICED" : "READY_TO_BILL";
  const balance = open.reduce((sum, i) => sum + i.balanceMinor, 0);
  if (!balance) return "PAID";
  return open.some((i) => i.paidMinor > 0) ? "PARTIALLY_PAID" : "INVOICED";
}

export type LiveBillingRow = { account: PatientAccount; patient: Patient; charges: ChargeItem[]; invoices: RevenueInvoice[]; payments: Payment[]; exceptions: ChargeException[] };

export function rowFromApi(row: ApiRow): LiveBillingRow {
  const patient = patientFromApi(row.patient);
  const charges = row.charges.map(chargeFromApi);
  const invoices = row.invoices.map((i) => invoiceFromApi(i, patient.payer));
  const currency = (row.charges[0]?.currency ?? row.invoices[0]?.currency ?? "NGN") as CurrencyCode;
  const payments = row.payments.map((p) => paymentFromApi(p, row.encounter.id, row.invoices.find((i) => i.id === p.invoiceId)?.currency ?? currency));
  const exceptions: ChargeException[] = (row.unpriced ?? []).map((u) => ({
    id: `${row.encounter.id}:${u.category}:${u.reference}`, organizationId: "", sourceEventId: `${patient.firstName} ${patient.lastName} · ${arrivalLabel(row.encounter.arrivedAt)}`,
    patientId: patient.id, encounterId: row.encounter.id, reason: "MISSING_PRICE", status: "NEEDS_REVIEW", createdAt: row.encounter.arrivedAt,
    detail: `${u.description} — no ${DEPARTMENT[u.category].toLowerCase()} price is set for "${u.reference}", so it has not been charged.`,
  }));
  return {
    patient, charges, invoices, payments, exceptions,
    account: {
      id: row.encounter.id, number: arrivalLabel(row.encounter.arrivedAt), organizationId: "", branchId: "", patientId: patient.id, encounterId: row.encounter.id,
      visitType: visitLabel(row.encounter), attendingProvider: row.encounter.attendingName ?? undefined, payer: patient.payer, currency,
      financialStatus: financialStatusFor(charges, invoices), readinessReasons: [], openedAt: row.encounter.arrivedAt, updatedAt: row.encounter.endedAt ?? row.encounter.arrivedAt,
    },
  };
}

// ---- the worklist store ----

type BillingState = {
  rows: LiveBillingRow[];
  totals: ApiWorklist["totals"] | null;
  nextCursor: string | null;
  query: string;
  loaded: boolean;
  error: string;
  load: (query?: string) => Promise<void>;
  loadMore: () => Promise<void>;
  issueInvoice: (encounterId: string, idempotencyKey: string) => Promise<{ id: string; number: string }>;
};

const worklistPath = (query: string, cursor?: string | null) => {
  const params = new URLSearchParams({ capture: "true", limit: "50" });
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  return `/billing/worklist?${params}`;
};

export const useLiveBilling = create<BillingState>((set, get) => ({
  rows: [], totals: null, nextCursor: null, query: "", loaded: false, error: "",
  load: async (query = get().query) => {
    try {
      const data = await emrRequest<{ data: ApiWorklist }>(worklistPath(query));
      // A slower response for an older search must not replace a newer one.
      if (query !== get().query && get().loaded) return;
      set({ rows: data.data.items.map(rowFromApi), totals: data.data.totals, nextCursor: data.data.nextCursor, loaded: true, error: "" });
    } catch (cause) {
      set({ loaded: true, error: cause instanceof Error ? cause.message : "Billing could not be loaded." });
    }
  },
  loadMore: async () => {
    const { nextCursor, query } = get();
    if (!nextCursor) return;
    const data = await emrRequest<{ data: ApiWorklist }>(worklistPath(query, nextCursor));
    set((state) => ({ rows: [...state.rows, ...data.data.items.map(rowFromApi)], nextCursor: data.data.nextCursor, totals: data.data.totals }));
  },
  issueInvoice: async (encounterId, idempotencyKey) => {
    const data = await emrRequest<{ data: { id: string; number: string } }>(`/billing/encounters/${encodeURIComponent(encounterId)}/invoices`, { method: "POST", body: {}, idempotencyKey });
    void get().load();
    return data.data;
  },
}));

/** Loads the worklist while the Billing screen is open, follows the search box, and refreshes periodically. */
export function useLiveBillingRefresh(enabled: boolean, query: string) {
  const first = useRef(true);
  useEffect(() => {
    if (!enabled) return undefined;
    const delay = first.current ? 0 : 350; // wait for typing to pause before searching the server
    first.current = false;
    const trimmed = query.trim();
    const timer = window.setTimeout(() => { useLiveBilling.setState({ query: trimmed }); void useLiveBilling.getState().load(trimmed); }, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, query]);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => { void useLiveBilling.getState().load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
}

// ---- one invoice ----

export type LiveInvoiceView = {
  invoice: RevenueInvoice;
  account: PatientAccount;
  patient: Patient;
  payments: Payment[];
  receipts: Receipt[];
  audit: BillingAuditEvent[];
  provider: string;
  serviceDate: string;
};

export function invoiceViewFromApi(detail: ApiInvoiceDetail): LiveInvoiceView {
  const patient = patientFromApi({ ...detail.patient, sex: detail.patient.sex ?? "UNKNOWN" } as ApiPatient);
  const charges = detail.charges.map(chargeFromApi);
  const lines: RevenueInvoiceLine[] = charges.map((c) => ({
    id: c.id, chargeItemId: c.id, serviceCode: c.department, description: c.description, department: c.department, quantity: c.quantity,
    unitPriceMinor: c.unitPriceMinor, grossAmountMinor: c.grossAmountMinor, discountAmountMinor: 0, netAmountMinor: c.netAmountMinor, serviceDate: c.performedAt,
  }));
  const invoice = invoiceFromApi(detail, patient.payer, lines);
  const payments = detail.payments.map((p) => paymentFromApi(p, detail.encounterId, detail.currency));
  const money = (minor: number) => minorMoney(minor, detail.currency);
  const KIND: Record<ApiLedger["kind"], string> = { INVOICE_ISSUED: "INVOICE_ISSUED", PAYMENT: "PAYMENT_RECORDED", PAYMENT_REVERSED: "PAYMENT_REVERSED", INVOICE_VOIDED: "INVOICE_VOIDED" };
  const audit: BillingAuditEvent[] = detail.ledger.map((entry) => ({
    id: entry.id, organizationId: "", actorId: "", actor: entry.createdByName ?? "—", role: "", patientId: detail.patientId, encounterId: detail.encounterId,
    accountId: detail.encounterId, resourceType: entry.paymentId ? "PAYMENT" : "INVOICE",
    resourceId: entry.paymentId ? detail.payments.find((p) => p.id === entry.paymentId)?.receiptNumber ?? entry.paymentId : detail.number,
    action: KIND[entry.kind], timestamp: entry.createdAt, correlationId: `${money(Math.abs(entry.amountMinor))} · balance ${money(entry.balanceAfterMinor)}`,
  }));
  const encounter = detail.encounter;
  return {
    invoice, patient, payments, audit,
    receipts: detail.payments.map((p) => ({ id: p.id, number: p.receiptNumber, organizationId: "", paymentId: p.id, invoiceId: detail.id, patientId: detail.patientId, amountMinor: p.amountMinor, currency: detail.currency as CurrencyCode, issuedAt: p.receivedAt })),
    provider: encounter?.attendingName ?? "—",
    serviceDate: encounter?.arrivedAt ?? detail.issuedAt,
    account: {
      id: detail.encounterId, number: encounter ? arrivalLabel(encounter.arrivedAt) : detail.number, organizationId: "", branchId: "", patientId: detail.patientId,
      encounterId: detail.encounterId, visitType: encounter ? visitLabel(encounter) : "—", attendingProvider: encounter?.attendingName ?? undefined, payer: patient.payer,
      currency: detail.currency as CurrencyCode, financialStatus: financialStatusFor(charges, [invoice]), readinessReasons: [], openedAt: encounter?.arrivedAt ?? detail.issuedAt, updatedAt: detail.issuedAt,
    },
  };
}

type InvoiceState = { view: LiveInvoiceView | null; id: string | null; error: string; load: (id: string) => Promise<void> };

export const useLiveInvoice = create<InvoiceState>((set, get) => ({
  view: null, id: null, error: "",
  load: async (id) => {
    if (get().id !== id) set({ view: null, id, error: "" });
    try {
      const data = await emrRequest<{ data: ApiInvoiceDetail }>(`/billing/invoices/${encodeURIComponent(id)}`);
      if (get().id === id) set({ view: invoiceViewFromApi(data.data), error: "" });
    } catch (cause) {
      if (get().id === id) set({ error: cause instanceof Error ? cause.message : "The invoice could not be loaded." });
    }
  },
}));

export function useLiveInvoiceLoad(enabled: boolean, invoiceId: string | undefined) {
  useEffect(() => {
    if (enabled && invoiceId) void useLiveInvoice.getState().load(invoiceId);
  }, [enabled, invoiceId]);
}

export type LivePaymentForm = { amountMinor: number; method: PaymentMethod; paymentDate: string; reference: string; receivingAccount: string; notes: string };

/** Records a payment; the idempotency key belongs to the dialog, so a retried click never takes the money twice. */
export async function recordLivePayment(invoiceId: string, form: LivePaymentForm, idempotencyKey: string) {
  const method = METHOD_TO_API[form.method];
  if (!method) throw new Error("This payment method is not available for hospital invoices yet.");
  await emrRequest(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    method: "POST", idempotencyKey,
    body: {
      amountMinor: form.amountMinor, method,
      ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
      ...(form.paymentDate ? { transactionDate: form.paymentDate } : {}),
      ...(form.receivingAccount ? { receivingAccount: form.receivingAccount } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    },
  });
  await useLiveInvoice.getState().load(invoiceId);
  void useLiveBilling.getState().load();
}

export { newIdempotencyKey };
