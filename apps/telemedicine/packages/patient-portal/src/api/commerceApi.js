// Prescription commerce: prescriptions → pharmacy requests → quotes → reservation → order →
// Paystack payment → pharmacist fulfilment → delivery tracking. Every price, stock hold and
// status comes from the server; nothing is confirmed on the client.
import { authorizedRequest } from "../utils/sabiIdentity";

const data = async (promise) => (await promise).data;
const get = (path, query) => data(authorizedRequest(path, { query }));
const post = (path, body = {}) => data(authorizedRequest(path, { method: "POST", body }));

export const naira = (minor) => (minor == null ? null : minor / 100);

/** A fresh key per attempt; a retry of the same attempt reuses it so nothing is created twice. */
export const newIdempotencyKey = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/-/g, "") + Date.now().toString(16);

// ---------------- Prescriptions (doctor-issued, read-only for the patient) ----------------
export async function listPrescriptions() {
  const result = await get("/api/v1/prescriptions/patient", { limit: 100 });
  return result.items;
}

export const getPrescription = (id) => get(`/api/v1/prescriptions/${id}`);

// ---------------- Pharmacies near the patient that can serve this prescription ----------------
export async function discoverPharmacies(prescriptionId, { latitude, longitude, radiusKm }) {
  const result = await get(`/api/v1/pharmacies/discovery/prescriptions/${prescriptionId}`, { latitude, longitude, radiusKm, limit: 50 });
  return result.items;
}

// ---------------- Requests and quotes ----------------
export const requestQuotes = (prescriptionId, pharmacyIds) => post("/api/v1/pharmacy-requests", { prescriptionId, pharmacyIds });
export const listRequests = () => get("/api/v1/pharmacy-requests/patient");
/** Current (unexpired) quotes; each line carries the id needed to reserve it. */
export const listQuotes = () => get("/api/v1/pharmacy-requests/quotes/patient");

// ---------------- Reservation (20-minute stock hold) ----------------
export const createReservation = ({ prescriptionId, idempotencyKey, allocations }) =>
  post("/api/v1/reservations", { prescriptionId, idempotencyKey, allocations });
export const getReservation = (id) => get(`/api/v1/reservations/${id}`);
export const releaseReservation = (id) => authorizedRequest(`/api/v1/reservations/${id}`, { method: "DELETE" });

// ---------------- Checkout ----------------
export const previewCheckout = (reservationId, { fulfilments, deliveryCoordinates }) =>
  post(`/api/v1/checkout-pricing/preview/reservations/${reservationId}`, { fulfilments, ...(deliveryCoordinates ? { deliveryCoordinates } : {}) });

export const createOrder = ({ reservationId, idempotencyKey, fulfilments, delivery }) =>
  post("/api/v1/orders", { reservationId, idempotencyKey, fulfilments, ...(delivery ? { delivery } : {}) });

export async function listOrders() {
  const result = await get("/api/v1/orders");
  return result.items || result;
}
export const getOrder = (id) => get(`/api/v1/orders/${id}`);

// ---------------- Paystack ----------------
export const initializePayment = (orderId, idempotencyKey) => post(`/api/v1/orders/${orderId}/payment/initialize`, { idempotencyKey });
export const getPayment = (orderId) => get(`/api/v1/orders/${orderId}/payment`);

// Paystack returns to one fixed callback URL, so remember which order is being paid for (and the
// delivery address, which the server only keeps encrypted) for this browser tab.
const PENDING_ORDER_KEY = "sabi-pending-order";
export function rememberPendingOrder(orderId, address = null) {
  try {
    window.sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId, address }));
  } catch {
    /* the confirmation page can still be opened from the order link */
  }
}
export function pendingOrder() {
  try {
    return JSON.parse(window.sessionStorage.getItem(PENDING_ORDER_KEY)) || null;
  } catch {
    return null;
  }
}

// ---------------- Delivery tracking ----------------
export const getTracking = (orderId) => get(`/api/v1/delivery/orders/${orderId}/tracking`);

// Patient-facing wording for fulfilment and tracking states.
export const FULFILMENT_LABELS = {
  AWAITING_PAYMENT: "Awaiting payment",
  AWAITING_PHARMACIST_REVIEW: "Pharmacist reviewing",
  APPROVED_FOR_DISPENSING: "Approved for dispensing",
  PREPARING: "Preparing your order",
  READY_FOR_PICKUP: "Ready",
  PICKED_UP: "Picked up by rider",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CLARIFICATION_REQUIRED: "Pharmacy needs clarification",
  REJECTED: "Declined by pharmacy",
  UNABLE_TO_FULFILL: "Pharmacy unable to fulfil",
  CANCELLED: "Cancelled",
};
export const TRACKING_LABELS = {
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready for pickup",
  IN_DELIVERY: "In delivery",
  PARTIALLY_DELIVERED: "Partially delivered",
  DELIVERED: "Delivered",
  ACTION_REQUIRED: "Action required",
  CANCELLED: "Cancelled",
};
export const ORDER_LABELS = { PENDING_PAYMENT: "Awaiting payment", PAID: "Paid", PAYMENT_FAILED: "Payment failed", CANCELLED: "Cancelled" };
