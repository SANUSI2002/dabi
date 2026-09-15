import { create } from "zustand";
import { persisted } from "@/platform/persist";
import { activeTenantId, readActiveTenant } from "@/platform/tenantRuntime";
import { useIdentity } from "@/store/useIdentity";
import { audit } from "@/store/useAudit";
import type { Invoice as LegacyInvoice, Patient } from "@/data/types";
import { seedBillingCatalog } from "./catalog";
import {
  invoiceStatusFor,
  type BillingAuditEvent,
  type ChargeEventInput,
  type ChargeException,
  type ChargeItem,
  type PatientAccount,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
  type PriceVersion,
  type Receipt,
  type RevenueInvoice,
  type ServiceCatalogItem,
} from "./domain";

const rid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const totalLegacy = (invoice: LegacyInvoice) => invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);

type LegacyInput = { invoice: LegacyInvoice; patient?: Patient };
type PaymentInput = {
  invoiceId: string;
  amountMinor: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
  receivingAccount: string;
  notes?: string;
  idempotencyKey?: string;
};

type RevenueCycleState = {
  accounts: PatientAccount[];
  charges: ChargeItem[];
  invoices: RevenueInvoice[];
  payments: Payment[];
  allocations: PaymentAllocation[];
  receipts: Receipt[];
  exceptions: ChargeException[];
  auditEvents: BillingAuditEvent[];
  serviceCatalog: ServiceCatalogItem[];
  priceVersions: PriceVersion[];
  ensureAccount: (input: Pick<ChargeEventInput, "patientId" | "encounterId" | "appointmentId" | "visitType" | "payer" | "performedBy" | "performedAt">) => PatientAccount | undefined;
  captureCharge: (event: ChargeEventInput) => { charge?: ChargeItem; exception?: ChargeException; duplicate: boolean };
  updateReadiness: (encounterId: string, reasons: string[]) => void;
  generateInvoice: (accountId: string, chargeIds?: string[], idempotencyKey?: string) => RevenueInvoice | undefined;
  recordPayment: (input: PaymentInput) => { payment: Payment; allocation: PaymentAllocation; receipt: Receipt; invoice: RevenueInvoice };
  bootstrapLegacy: (items: LegacyInput[]) => void;
};

const catalog = seedBillingCatalog();

function actor() {
  const user = useIdentity.getState().user;
  return { actorId: user.id, actor: user.name, role: user.role };
}

function nextNumber(prefix: string, count: number) {
  return `${prefix}/${new Date().getFullYear()}/${String(count + 1).padStart(6, "0")}`;
}

function accountStatus(accountId: string, charges: ChargeItem[], invoices: RevenueInvoice[]): PatientAccount["financialStatus"] {
  const relatedInvoices = invoices.filter((invoice) => invoice.accountId === accountId && !["VOIDED", "CANCELLED"].includes(invoice.status));
  if (relatedInvoices.some((invoice) => invoice.status === "PARTIALLY_PAID")) return "PARTIALLY_PAID";
  if (relatedInvoices.length && relatedInvoices.every((invoice) => ["PAID", "CREDITED"].includes(invoice.status))) return "PAID";
  if (relatedInvoices.length) return "INVOICED";
  if (charges.some((charge) => charge.accountId === accountId && charge.status === "BILLABLE")) return "READY_TO_BILL";
  return "OPEN";
}

export const useRevenueCycle = create<RevenueCycleState>(persisted<RevenueCycleState>("revenue-cycle", (set, get) => ({
  accounts: [],
  charges: [],
  invoices: [],
  payments: [],
  allocations: [],
  receipts: [],
  exceptions: [],
  auditEvents: [],
  serviceCatalog: catalog.services,
  priceVersions: catalog.prices,

  ensureAccount: (input) => {
    if (!input.encounterId) return undefined;
    const existing = get().accounts.find((account) => account.encounterId === input.encounterId);
    if (existing) {
      const updated = {
        ...existing,
        appointmentId: existing.appointmentId ?? input.appointmentId,
        visitType: input.visitType ?? existing.visitType,
        attendingProvider: input.performedBy || existing.attendingProvider,
        payer: input.payer || existing.payer,
        updatedAt: input.performedAt || existing.updatedAt,
      };
      set((state) => ({ accounts: state.accounts.map((account) => account.id === existing.id ? updated : account) }));
      return updated;
    }
    const tenant = readActiveTenant();
    const now = input.performedAt || new Date().toISOString();
    const account: PatientAccount = {
      id: rid("acc"),
      number: nextNumber("ACC", get().accounts.length),
      organizationId: activeTenantId(),
      branchId: tenant.facilityCode,
      patientId: input.patientId,
      encounterId: input.encounterId,
      appointmentId: input.appointmentId,
      visitType: input.visitType ?? "Outpatient",
      attendingProvider: input.performedBy,
      payer: input.payer,
      currency: tenant.currency || "NGN",
      financialStatus: "OPEN",
      readinessReasons: ["Consultation in progress"],
      openedAt: now,
      updatedAt: now,
    };
    const correlationId = rid("corr");
    const event: BillingAuditEvent = {
      id: rid("ba"), organizationId: account.organizationId, ...actor(), patientId: account.patientId,
      encounterId: account.encounterId, accountId: account.id, resourceType: "PATIENT_ACCOUNT", resourceId: account.id,
      action: "PATIENT_ACCOUNT_CREATED", timestamp: now, correlationId,
      newValue: { number: account.number, financialStatus: account.financialStatus },
    };
    set((state) => ({ accounts: [account, ...state.accounts], auditEvents: [event, ...state.auditEvents] }));
    audit("created patient account", `billing/account/${account.number}`, { meta: { patientId: account.patientId, encounterId: account.encounterId, accountId: account.id, correlationId } });
    return account;
  },

  captureCharge: (input) => {
    const now = new Date().toISOString();
    const idempotencyKey = input.idempotencyKey?.trim() || input.sourceEventId;
    const duplicate = get().charges.find((charge) => charge.idempotencyKey === idempotencyKey);
    if (duplicate) return { charge: duplicate, duplicate: true };

    const addException = (reason: ChargeException["reason"], detail: string) => {
      const existing = get().exceptions.find((item) => (item.idempotencyKey ?? item.sourceEventId) === idempotencyKey && item.status === "NEEDS_REVIEW");
      if (existing) return existing;
      const exception: ChargeException = {
        id: rid("exc"), organizationId: activeTenantId(), sourceEventId: input.sourceEventId, idempotencyKey,
        patientId: input.patientId, encounterId: input.encounterId, reason, detail, status: "NEEDS_REVIEW", createdAt: now,
      };
      set((state) => ({ exceptions: [exception, ...state.exceptions] }));
      audit("queued charge exception", `billing/exception/${exception.id}`, { meta: { patientId: input.patientId, encounterId: input.encounterId, sourceEventId: input.sourceEventId, reason } });
      return exception;
    };

    if (!input.encounterId) return { exception: addException("MISSING_ACCOUNT", "The clinical event is not linked to an encounter."), duplicate: false };
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) return { exception: addException("INVALID_QUANTITY", `Invalid charge quantity: ${input.quantity}`), duplicate: false };

    const query = normalize(input.serviceName ?? input.serviceCode ?? "");
    const service = get().serviceCatalog.find((item) =>
      item.active && (item.code === input.serviceCode || normalize(item.name) === query || item.aliases?.some((alias) => normalize(alias) === query) || (input.sourceType === "PHARMACY" && [item.name, ...(item.aliases ?? [])].some((name) => query.includes(normalize(name))))),
    );
    if (!service) return { exception: addException("INVALID_SERVICE", `No active service matches ${input.serviceName ?? input.serviceCode ?? "this event"}.`), duplicate: false };
    const price = get().priceVersions.find((version) => version.serviceId === service.id && version.active && new Date(version.effectiveFrom) <= new Date(input.performedAt));
    if (!price || price.amountMinor <= 0) return { exception: addException("MISSING_PRICE", `${service.name} does not have an active billable price.`), duplicate: false };

    const account = get().ensureAccount(input);
    if (!account) return { exception: addException("MISSING_ACCOUNT", "A patient account could not be created for this encounter."), duplicate: false };
    const correlationId = rid("corr");
    const grossAmountMinor = price.amountMinor * input.quantity;
    const charge: ChargeItem = {
      id: rid("chg"), organizationId: activeTenantId(), branchId: account.branchId, patientId: input.patientId,
      encounterId: input.encounterId, accountId: account.id, sourceType: input.sourceType, sourceId: input.sourceId,
      sourceEventId: input.sourceEventId, idempotencyKey, serviceId: service.id, serviceCode: service.code,
      description: service.name, department: input.department || service.department, quantity: input.quantity,
      unitPriceMinor: price.amountMinor, grossAmountMinor, discountAmountMinor: 0, netAmountMinor: grossAmountMinor,
      currency: price.currency, status: "BILLABLE", performedBy: input.performedBy, performedAt: input.performedAt,
      priceListId: price.priceListId, priceVersionId: price.id, correlationId, createdAt: now, createdBy: actor().actor,
    };
    const event: BillingAuditEvent = {
      id: rid("ba"), organizationId: charge.organizationId, ...actor(), patientId: charge.patientId, encounterId: charge.encounterId,
      accountId: charge.accountId, resourceType: "CHARGE", resourceId: charge.id, action: "CHARGE_CREATED", timestamp: now,
      correlationId, newValue: { serviceCode: charge.serviceCode, quantity: charge.quantity, amountMinor: charge.netAmountMinor, sourceEventId: charge.sourceEventId },
    };
    set((state) => ({
      charges: [charge, ...state.charges], auditEvents: [event, ...state.auditEvents],
      accounts: state.accounts.map((item) => item.id === account.id ? { ...item, financialStatus: "ACCUMULATING_CHARGES", updatedAt: now } : item),
    }));
    audit("captured clinical charge", `billing/charge/${charge.id}`, { meta: { patientId: charge.patientId, encounterId: charge.encounterId, accountId: charge.accountId, sourceEventId: charge.sourceEventId, correlationId } });
    return { charge, duplicate: false };
  },

  updateReadiness: (encounterId, reasons) => set((state) => ({
    accounts: state.accounts.map((account) => {
      if (account.encounterId !== encounterId) return account;
      const relatedInvoices = state.invoices.filter((invoice) => invoice.accountId === account.id);
      const relatedCharges = state.charges.filter((charge) => charge.accountId === account.id && charge.status === "BILLABLE");
      const financialStatus = relatedInvoices.length
        ? accountStatus(account.id, state.charges, state.invoices)
        : reasons.length ? (relatedCharges.length ? "ACCUMULATING_CHARGES" : "OPEN") : relatedCharges.length ? "READY_TO_BILL" : "OPEN";
      return { ...account, readinessReasons: reasons, financialStatus, updatedAt: new Date().toISOString() };
    }),
  })),

  generateInvoice: (accountId, selectedIds, idempotencyKey) => {
    const duplicate = idempotencyKey ? get().invoices.find((invoice) => invoice.idempotencyKey === idempotencyKey) : undefined;
    if (duplicate) return duplicate;
    const account = get().accounts.find((item) => item.id === accountId);
    if (!account) return undefined;
    const selected = get().charges.filter((charge) => charge.accountId === accountId && charge.status === "BILLABLE" && (!selectedIds || selectedIds.includes(charge.id)));
    if (!selected.length) return undefined;
    const now = new Date().toISOString();
    const correlationId = rid("corr");
    const subtotalMinor = selected.reduce((sum, charge) => sum + charge.grossAmountMinor, 0);
    const discountMinor = selected.reduce((sum, charge) => sum + charge.discountAmountMinor, 0);
    const totalMinor = selected.reduce((sum, charge) => sum + charge.netAmountMinor, 0);
    const invoice: RevenueInvoice = {
      id: rid("inv"), organizationId: account.organizationId, branchId: account.branchId, idempotencyKey,
      number: nextNumber("INV", get().invoices.length), patientId: account.patientId, encounterId: account.encounterId,
      accountId, payer: account.payer, status: "ISSUED", lines: selected.map((charge) => ({
        id: rid("invl"), chargeItemId: charge.id, serviceCode: charge.serviceCode, description: charge.description,
        department: charge.department, quantity: charge.quantity, unitPriceMinor: charge.unitPriceMinor,
        grossAmountMinor: charge.grossAmountMinor, discountAmountMinor: charge.discountAmountMinor,
        netAmountMinor: charge.netAmountMinor, serviceDate: charge.performedAt,
      })), subtotalMinor, discountMinor, taxMinor: 0, totalMinor, paidMinor: 0, balanceMinor: totalMinor,
      currency: account.currency, issuedAt: now, createdAt: now, createdBy: actor().actor, correlationId,
    };
    const event: BillingAuditEvent = {
      id: rid("ba"), organizationId: account.organizationId, ...actor(), patientId: account.patientId,
      encounterId: account.encounterId, accountId, resourceType: "INVOICE", resourceId: invoice.id,
      action: "INVOICE_ISSUED", timestamp: now, correlationId, newValue: { number: invoice.number, totalMinor },
    };
    set((state) => {
      const invoices = [invoice, ...state.invoices];
      return {
        invoices,
        charges: state.charges.map((charge) => selected.some((item) => item.id === charge.id) ? { ...charge, status: "INVOICED", invoiceId: invoice.id } : charge),
        accounts: state.accounts.map((item) => item.id === accountId ? { ...item, financialStatus: accountStatus(accountId, state.charges, invoices), updatedAt: now } : item),
        auditEvents: [event, ...state.auditEvents],
      };
    });
    audit("issued patient invoice", `billing/invoice/${invoice.number}`, { meta: { patientId: account.patientId, encounterId: account.encounterId, accountId, correlationId } });
    return invoice;
  },

  recordPayment: (input) => {
    const duplicatePayment = input.idempotencyKey
      ? get().payments.find((payment) => payment.idempotencyKey === input.idempotencyKey)
      : undefined;
    if (duplicatePayment) {
      const allocation = get().allocations.find((item) => item.paymentId === duplicatePayment.id);
      const receipt = get().receipts.find((item) => item.paymentId === duplicatePayment.id);
      const invoice = allocation ? get().invoices.find((item) => item.id === allocation.invoiceId) : undefined;
      if (allocation && receipt && invoice) return { payment: duplicatePayment, allocation, receipt, invoice };
    }
    const current = get().invoices.find((invoice) => invoice.id === input.invoiceId);
    if (!current) throw new Error("Invoice not found.");
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Enter an amount greater than zero.");
    if (input.amountMinor > current.balanceMinor) throw new Error("Amount received cannot exceed the outstanding balance.");
    if (["VOIDED", "CANCELLED", "CREDITED", "PAID"].includes(current.status)) throw new Error("This invoice cannot accept another payment.");
    const now = new Date().toISOString();
    const correlationId = rid("corr");
    const who = actor();
    const payment: Payment = {
      id: rid("pay"), organizationId: current.organizationId, patientId: current.patientId, accountId: current.accountId,
      amountMinor: input.amountMinor, currency: current.currency, method: input.method, paymentDate: input.paymentDate,
      reference: input.reference?.trim() || undefined, receivingAccount: input.receivingAccount,
      notes: input.notes?.trim() || undefined, receivedBy: who.actor, status: "SUCCEEDED", correlationId, createdAt: now,
      idempotencyKey: input.idempotencyKey,
    };
    const allocation: PaymentAllocation = { id: rid("alloc"), paymentId: payment.id, invoiceId: current.id, amountMinor: input.amountMinor, createdAt: now };
    const receipt: Receipt = {
      id: rid("rec"), number: nextNumber("REC", get().receipts.length), organizationId: current.organizationId,
      paymentId: payment.id, invoiceId: current.id, patientId: current.patientId, amountMinor: input.amountMinor,
      currency: current.currency, issuedAt: now,
    };
    const paidMinor = current.paidMinor + input.amountMinor;
    const balanceMinor = current.totalMinor - paidMinor;
    const updated: RevenueInvoice = { ...current, paidMinor, balanceMinor, status: invoiceStatusFor(current.totalMinor, paidMinor) };
    const paymentEvent: BillingAuditEvent = {
      id: rid("ba"), organizationId: current.organizationId, ...who, patientId: current.patientId, encounterId: current.encounterId,
      accountId: current.accountId, resourceType: "PAYMENT", resourceId: payment.id, action: "PAYMENT_RECORDED",
      timestamp: now, correlationId, newValue: { receiptNumber: receipt.number, amountMinor: payment.amountMinor, method: payment.method, reference: payment.reference },
    };
    const allocationEvent: BillingAuditEvent = {
      ...paymentEvent, id: rid("ba"), resourceType: "ALLOCATION", resourceId: allocation.id, action: "PAYMENT_ALLOCATED",
      newValue: { invoiceId: current.id, amountMinor: allocation.amountMinor },
    };
    set((state) => {
      const invoices = state.invoices.map((invoice) => invoice.id === current.id ? updated : invoice);
      return {
        payments: [payment, ...state.payments], allocations: [allocation, ...state.allocations], receipts: [receipt, ...state.receipts], invoices,
        charges: state.charges.map((charge) => charge.invoiceId === current.id && updated.status === "PAID" ? { ...charge, status: "PAID" } : charge),
        accounts: state.accounts.map((account) => account.id === current.accountId ? { ...account, financialStatus: accountStatus(account.id, state.charges, invoices), updatedAt: now } : account),
        auditEvents: [allocationEvent, paymentEvent, ...state.auditEvents],
      };
    });
    audit("recorded patient payment", `billing/payment/${payment.id}`, { meta: { patientId: current.patientId, encounterId: current.encounterId, accountId: current.accountId, invoiceId: current.id, amountMinor: payment.amountMinor, correlationId } });
    return { payment, allocation, receipt, invoice: updated };
  },

  bootstrapLegacy: (items) => {
    const unseen = items.filter(({ invoice }) => !get().invoices.some((current) => current.id === `legacy-${invoice.id}`));
    if (!unseen.length) return;
    const tenant = readActiveTenant();
    const newAccounts: PatientAccount[] = [];
    const newCharges: ChargeItem[] = [];
    const newInvoices: RevenueInvoice[] = [];
    const newPayments: Payment[] = [];
    const newAllocations: PaymentAllocation[] = [];
    const newReceipts: Receipt[] = [];
    unseen.forEach(({ invoice, patient }, itemIndex) => {
      const encounterId = `legacy-${invoice.id}`;
      const accountId = `legacy-account-${invoice.id}`;
      const totalMinor = Math.round(totalLegacy(invoice) * 100);
      const account: PatientAccount = {
        id: accountId, number: `ACC/MIG/${invoice.number.replace(/[^0-9]/g, "")}`, organizationId: activeTenantId(),
        branchId: tenant.facilityCode, patientId: invoice.patientId, encounterId, visitType: "Migrated outpatient",
        payer: invoice.payer, currency: tenant.currency || "NGN", financialStatus: invoice.status === "Unpaid" ? "INVOICED" : "PAID",
        readinessReasons: [],
        openedAt: invoice.createdAt, updatedAt: invoice.paidAt ?? invoice.createdAt,
      };
      const charges = invoice.lines.map((line, lineIndex): ChargeItem => ({
        id: `legacy-charge-${invoice.id}-${lineIndex}`, organizationId: activeTenantId(), branchId: tenant.facilityCode,
        patientId: invoice.patientId, encounterId, accountId, sourceType: "MIGRATION", sourceId: invoice.id,
        sourceEventId: `legacy:${invoice.id}:${lineIndex}`, idempotencyKey: `legacy:${invoice.id}:${lineIndex}`,
        serviceId: `legacy-service-${line.code}`, serviceCode: line.code, description: line.name, department: "Legacy billing",
        quantity: line.qty, unitPriceMinor: Math.round(line.unitPrice * 100), grossAmountMinor: Math.round(line.qty * line.unitPrice * 100),
        discountAmountMinor: 0, netAmountMinor: Math.round(line.qty * line.unitPrice * 100), currency: tenant.currency || "NGN",
        status: invoice.status === "Paid" ? "PAID" : "INVOICED", performedBy: "Legacy billing migration", performedAt: invoice.createdAt,
        priceListId: "LEGACY", priceVersionId: "LEGACY", invoiceId: `legacy-${invoice.id}`, correlationId: `migration-${invoice.id}`,
        createdAt: invoice.createdAt, createdBy: "System migration",
      }));
      const paid = invoice.status === "Paid";
      const credited = invoice.status === "Waived";
      const revenueInvoice: RevenueInvoice = {
        id: `legacy-${invoice.id}`, organizationId: activeTenantId(), branchId: tenant.facilityCode, number: invoice.number,
        patientId: invoice.patientId, encounterId, accountId, payer: invoice.payer,
        status: paid ? "PAID" : credited ? "CREDITED" : "ISSUED",
        lines: charges.map((charge, index) => ({ id: `legacy-line-${invoice.id}-${index}`, chargeItemId: charge.id,
          serviceCode: charge.serviceCode, description: charge.description, department: charge.department, quantity: charge.quantity,
          unitPriceMinor: charge.unitPriceMinor, grossAmountMinor: charge.grossAmountMinor, discountAmountMinor: 0,
          netAmountMinor: charge.netAmountMinor, serviceDate: charge.performedAt })),
        subtotalMinor: totalMinor, discountMinor: credited ? totalMinor : 0, taxMinor: 0, totalMinor,
        paidMinor: paid ? totalMinor : 0, balanceMinor: paid || credited ? 0 : totalMinor,
        currency: tenant.currency || "NGN", issuedAt: invoice.createdAt, createdAt: invoice.createdAt,
        createdBy: "System migration", correlationId: `migration-${invoice.id}`,
      };
      newAccounts.push(account); newCharges.push(...charges); newInvoices.push(revenueInvoice);
      if (paid) {
        const paymentId = `legacy-payment-${invoice.id}`;
        newPayments.push({ id: paymentId, organizationId: activeTenantId(), patientId: invoice.patientId, accountId,
          amountMinor: totalMinor, currency: tenant.currency || "NGN", method: invoice.method === "POS" ? "CARD_POS" : invoice.method === "Transfer" ? "BANK_TRANSFER" : "CASH",
          paymentDate: invoice.paidAt ?? invoice.createdAt, receivingAccount: "Legacy collection account", receivedBy: "Legacy cashier",
          status: "SUCCEEDED", correlationId: `migration-${invoice.id}`, createdAt: invoice.paidAt ?? invoice.createdAt });
        newAllocations.push({ id: `legacy-allocation-${invoice.id}`, paymentId, invoiceId: revenueInvoice.id, amountMinor: totalMinor, createdAt: invoice.paidAt ?? invoice.createdAt });
        newReceipts.push({ id: `legacy-receipt-${invoice.id}`, number: `REC/MIG/${itemIndex + 1}`, organizationId: activeTenantId(), paymentId,
          invoiceId: revenueInvoice.id, patientId: invoice.patientId, amountMinor: totalMinor, currency: tenant.currency || "NGN", issuedAt: invoice.paidAt ?? invoice.createdAt });
      }
      void patient;
    });
    set((state) => ({ accounts: [...newAccounts, ...state.accounts], charges: [...newCharges, ...state.charges], invoices: [...newInvoices, ...state.invoices],
      payments: [...newPayments, ...state.payments], allocations: [...newAllocations, ...state.allocations], receipts: [...newReceipts, ...state.receipts] }));
  },
}), {
  merge: (base, saved) => ({
    ...base,
    ...saved,
    accounts: (saved.accounts ?? base.accounts).map((account) => ({ ...account, readinessReasons: account.readinessReasons ?? [] })),
    serviceCatalog: saved.serviceCatalog?.length ? saved.serviceCatalog : base.serviceCatalog,
    priceVersions: saved.priceVersions?.length ? saved.priceVersions : base.priceVersions,
  }),
}));

export const minorMoney = (amountMinor: number, currency = "NGN") => new Intl.NumberFormat("en-NG", {
  style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amountMinor / 100);

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: "Cash", CARD_POS: "Card / POS", BANK_TRANSFER: "Bank transfer", MOBILE_MONEY: "Mobile money", INSURANCE: "Insurance", OTHER: "Other",
};
