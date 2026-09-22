import { create } from "zustand";
import { developmentFixturesEnabled } from "@/config/runtime";
import { persisted } from "@/platform/persist";

export type PrescriptionRequestStatus = "NEW" | "UNDER_REVIEW" | "QUOTED" | "CANCELLED";
export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "EXPIRED" | "DECLINED";
export type PaymentStatus = "PENDING" | "CONFIRMED" | "REFUNDED";
export type FulfilmentStatus =
  | "AWAITING_PAYMENT"
  | "READY_TO_PREPARE"
  | "PREPARING"
  | "DISPENSING"
  | "READY_FOR_PICKUP"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

export type PrescriptionLine = {
  id: string;
  masterDrugId: string;
  name: string;
  directions: string;
  quantity: number;
};

export type PharmacyRequest = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId: string;
  patientName: string;
  prescriptionNumber: string;
  prescriberName: string;
  receivedAt: string;
  deliveryPreference: "PICKUP" | "DELIVERY";
  patientNote?: string;
  status: PrescriptionRequestStatus;
  items: PrescriptionLine[];
};

export type QuoteLine = PrescriptionLine & {
  available: boolean;
  unitPriceMinor: number;
};

export type PharmacyQuote = {
  id: string;
  organizationId: string;
  branchId: string;
  requestId: string;
  patientId: string;
  patientName: string;
  status: QuoteStatus;
  items: QuoteLine[];
  deliveryFeeMinor: number;
  expiresAt: string;
  createdAt: string;
  sentAt?: string;
};

export type PharmacyOrder = {
  id: string;
  organizationId: string;
  branchId: string;
  requestId: string;
  quoteId: string;
  patientId: string;
  patientName: string;
  deliveryPreference: "PICKUP" | "DELIVERY";
  items: QuoteLine[];
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  createdAt: string;
  paidAt?: string;
};

export type PharmacyWorkflowEvent = {
  id: string;
  organizationId: string;
  branchId: string;
  entityType: "REQUEST" | "QUOTE" | "ORDER";
  entityId: string;
  action: string;
  actor: string;
  occurredAt: string;
};

type QuoteInput = {
  requestId: string;
  items: QuoteLine[];
  deliveryFeeMinor: number;
  expiresAt: string;
};

type WorkflowState = {
  requests: PharmacyRequest[];
  quotes: PharmacyQuote[];
  orders: PharmacyOrder[];
  events: PharmacyWorkflowEvent[];
  startReview: (requestId: string, organizationId: string) => void;
  saveQuote: (organizationId: string, input: QuoteInput) => { quote?: PharmacyQuote; error?: string };
  sendQuote: (quoteId: string, organizationId: string) => { error?: string };
  acceptQuote: (quoteId: string, organizationId: string) => { order?: PharmacyOrder; error?: string };
  confirmDevelopmentPayment: (orderId: string, organizationId: string) => { error?: string };
  advanceOrder: (orderId: string, organizationId: string, next: FulfilmentStatus, action: string) => { error?: string };
};

const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const seedRequests = (): PharmacyRequest[] => developmentFixturesEnabled ? [
  {
    id: "rxr-1001", organizationId: "org-haven", branchId: "branch-org-haven-1", patientId: "patient-taiwo", patientName: "Taiwo Adebayo",
    prescriptionNumber: "RX/2026/00481", prescriberName: "Dr. N. Okafor", receivedAt: iso(18), deliveryPreference: "DELIVERY",
    patientNote: "Please call if the prescribed brand is unavailable.", status: "NEW",
    items: [{ id: "rxl-1001-a", masterDrugId: "d3", name: "Amoxicillin 500mg", directions: "One capsule three times daily for 7 days", quantity: 2 }],
  },
  {
    id: "rxr-1002", organizationId: "org-haven", branchId: "branch-org-haven-1", patientId: "patient-ada", patientName: "Ada Nwosu",
    prescriptionNumber: "RX/2026/00480", prescriberName: "Dr. A. Bello", receivedAt: iso(54), deliveryPreference: "PICKUP", status: "UNDER_REVIEW",
    items: [{ id: "rxl-1002-a", masterDrugId: "d2", name: "Paracetamol 500mg", directions: "Two tablets every 8 hours when required", quantity: 1 }],
  },
  {
    id: "rxr-1003", organizationId: "org-haven", branchId: "branch-org-haven-1", patientId: "patient-ngozi", patientName: "Ngozi Eze",
    prescriptionNumber: "RX/2026/00476", prescriberName: "Dr. M. Yusuf", receivedAt: iso(220), deliveryPreference: "PICKUP", status: "QUOTED",
    items: [{ id: "rxl-1003-a", masterDrugId: "d2", name: "Paracetamol 500mg", directions: "One tablet twice daily for 5 days", quantity: 2 }],
  },
] : [];

const seedQuotes = (): PharmacyQuote[] => developmentFixturesEnabled ? [{
  id: "quote-1003", organizationId: "org-haven", branchId: "branch-org-haven-1", requestId: "rxr-1003", patientId: "patient-ngozi", patientName: "Ngozi Eze",
  status: "ACCEPTED", items: [{ id: "rxl-1003-a", masterDrugId: "d2", name: "Paracetamol 500mg", directions: "One tablet twice daily for 5 days", quantity: 2, available: true, unitPriceMinor: 1800 }],
  deliveryFeeMinor: 0, createdAt: iso(190), sentAt: iso(180), expiresAt: iso(-1_200),
}] : [];

const seedOrders = (): PharmacyOrder[] => developmentFixturesEnabled ? [{
  id: "PHO-26092101", organizationId: "org-haven", branchId: "branch-org-haven-1", requestId: "rxr-1003", quoteId: "quote-1003", patientId: "patient-ngozi", patientName: "Ngozi Eze",
  deliveryPreference: "PICKUP", items: [{ id: "rxl-1003-a", masterDrugId: "d2", name: "Paracetamol 500mg", directions: "One tablet twice daily for 5 days", quantity: 2, available: true, unitPriceMinor: 1800 }],
  subtotalMinor: 3600, deliveryFeeMinor: 0, totalMinor: 3600, paymentStatus: "CONFIRMED", fulfilmentStatus: "READY_TO_PREPARE", createdAt: iso(170), paidAt: iso(160),
}] : [];

function event(organizationId: string, branchId: string, entityType: PharmacyWorkflowEvent["entityType"], entityId: string, action: string): PharmacyWorkflowEvent {
  return { id: id("evt"), organizationId, branchId, entityType, entityId, action, actor: "Current pharmacy user", occurredAt: new Date().toISOString() };
}

export const usePharmacyWorkflow = create<WorkflowState>(persisted<WorkflowState>("pharmacy-workflow", (set, get) => ({
  requests: seedRequests(),
  quotes: seedQuotes(),
  orders: seedOrders(),
  events: [],
  startReview: (requestId, organizationId) => set((state) => {
    const request = state.requests.find((item) => item.id === requestId && item.organizationId === organizationId);
    if (!request || request.status !== "NEW") return state;
    return {
      requests: state.requests.map((item) => item.id === requestId ? { ...item, status: "UNDER_REVIEW" as const } : item),
      events: [...state.events, event(organizationId, request.branchId, "REQUEST", requestId, "Prescription review started")],
    };
  }),
  saveQuote: (organizationId, input) => {
    const state = get();
    const request = state.requests.find((item) => item.id === input.requestId && item.organizationId === organizationId);
    if (!request) return { error: "Prescription request was not found for this pharmacy." };
    if (!input.items.some((item) => item.available)) return { error: "At least one medicine must be available before saving a quote." };
    const existing = state.quotes.find((item) => item.requestId === request.id && item.organizationId === organizationId && item.status === "DRAFT");
    const quote: PharmacyQuote = {
      id: existing?.id ?? id("quote"), organizationId, branchId: request.branchId, requestId: request.id, patientId: request.patientId, patientName: request.patientName,
      status: "DRAFT", items: input.items, deliveryFeeMinor: Math.max(0, input.deliveryFeeMinor), expiresAt: input.expiresAt, createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    set((current) => ({
      quotes: existing ? current.quotes.map((item) => item.id === existing.id ? quote : item) : [...current.quotes, quote],
      requests: current.requests.map((item) => item.id === request.id && item.status === "NEW" ? { ...item, status: "UNDER_REVIEW" as const } : item),
      events: [...current.events, event(organizationId, request.branchId, "QUOTE", quote.id, existing ? "Draft quote updated" : "Draft quote created")],
    }));
    return { quote };
  },
  sendQuote: (quoteId, organizationId) => {
    const quote = get().quotes.find((item) => item.id === quoteId && item.organizationId === organizationId);
    if (!quote) return { error: "Quote was not found for this pharmacy." };
    if (quote.status !== "DRAFT") return { error: "Only draft quotes can be sent." };
    const sentAt = new Date().toISOString();
    set((state) => ({
      quotes: state.quotes.map((item) => item.id === quoteId ? { ...item, status: "SENT" as const, sentAt } : item),
      requests: state.requests.map((item) => item.id === quote.requestId ? { ...item, status: "QUOTED" as const } : item),
      events: [...state.events, event(organizationId, quote.branchId, "QUOTE", quoteId, "Quote sent to patient")],
    }));
    return {};
  },
  acceptQuote: (quoteId, organizationId) => {
    const state = get();
    const quote = state.quotes.find((item) => item.id === quoteId && item.organizationId === organizationId);
    if (!quote) return { error: "Quote was not found for this pharmacy." };
    if (quote.status !== "SENT") return { error: "Only a sent quote can be accepted." };
    if (new Date(quote.expiresAt).getTime() <= Date.now()) return { error: "This quote has expired." };
    const existing = state.orders.find((item) => item.quoteId === quote.id && item.organizationId === organizationId);
    if (existing) return { order: existing };
    const request = state.requests.find((item) => item.id === quote.requestId && item.organizationId === organizationId);
    if (!request) return { error: "The prescription request no longer exists." };
    const subtotalMinor = quote.items.filter((item) => item.available).reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
    const order: PharmacyOrder = {
      id: `PHO-${Date.now().toString().slice(-8)}`, organizationId, branchId: quote.branchId, requestId: quote.requestId, quoteId: quote.id, patientId: quote.patientId, patientName: quote.patientName,
      deliveryPreference: request.deliveryPreference, items: quote.items.filter((item) => item.available), subtotalMinor, deliveryFeeMinor: quote.deliveryFeeMinor,
      totalMinor: subtotalMinor + quote.deliveryFeeMinor, paymentStatus: "PENDING", fulfilmentStatus: "AWAITING_PAYMENT", createdAt: new Date().toISOString(),
    };
    set((current) => ({
      quotes: current.quotes.map((item) => item.id === quoteId ? { ...item, status: "ACCEPTED" as const } : item),
      orders: [...current.orders, order],
      events: [...current.events, event(organizationId, quote.branchId, "QUOTE", quoteId, "Patient acceptance recorded"), event(organizationId, quote.branchId, "ORDER", order.id, "Order created; awaiting payment")],
    }));
    return { order };
  },
  confirmDevelopmentPayment: (orderId, organizationId) => {
    if (!developmentFixturesEnabled) return { error: "Payment must be confirmed by the payment service." };
    const order = get().orders.find((item) => item.id === orderId && item.organizationId === organizationId);
    if (!order) return { error: "Order was not found for this pharmacy." };
    if (order.paymentStatus !== "PENDING") return { error: "This order is not awaiting payment." };
    const paidAt = new Date().toISOString();
    set((state) => ({
      orders: state.orders.map((item) => item.id === orderId ? { ...item, paymentStatus: "CONFIRMED" as const, fulfilmentStatus: "READY_TO_PREPARE" as const, paidAt } : item),
      events: [...state.events, event(organizationId, order.branchId, "ORDER", orderId, "Development payment marked confirmed")],
    }));
    return {};
  },
  advanceOrder: (orderId, organizationId, next, action) => {
    const order = get().orders.find((item) => item.id === orderId && item.organizationId === organizationId);
    if (!order) return { error: "Order was not found for this pharmacy." };
    if (order.paymentStatus !== "CONFIRMED" && !["AWAITING_PAYMENT", "CANCELLED"].includes(next)) return { error: "Payment must be confirmed before fulfilment can continue." };
    set((state) => ({
      orders: state.orders.map((item) => item.id === orderId ? { ...item, fulfilmentStatus: next } : item),
      events: [...state.events, event(organizationId, order.branchId, "ORDER", orderId, action)],
    }));
    return {};
  },
}), { scope: "global" }));

export function workflowForOrganization(organizationId: string) {
  const state = usePharmacyWorkflow.getState();
  return {
    requests: state.requests.filter((item) => item.organizationId === organizationId),
    quotes: state.quotes.filter((item) => item.organizationId === organizationId),
    orders: state.orders.filter((item) => item.organizationId === organizationId),
    events: state.events.filter((item) => item.organizationId === organizationId),
  };
}
