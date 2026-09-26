import { FULFILMENT_LABELS, TRACKING_LABELS, getOrder, getTracking, listOrders, naira, pendingOrder } from "../../api/commerceApi";
import { formatNaira } from "../../utils/currency";

// Orders and their tracking from the Sabi API, in the shape the delivery pages read.
// Rider names aren't shared with patients; only the assignment and its locations are.

const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null);

// Same precedence as the server's trackingStatus, for list rows (which don't include it).
function trackingStatusOf(fulfilments) {
  const statuses = fulfilments.map((f) => f.status);
  if (statuses.length && statuses.every((s) => s === "DELIVERED")) return "DELIVERED";
  if (statuses.some((s) => s === "DELIVERED")) return "PARTIALLY_DELIVERED";
  if (statuses.some((s) => ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(s))) return "IN_DELIVERY";
  if (statuses.length && statuses.every((s) => s === "READY_FOR_PICKUP")) return "READY_FOR_PICKUP";
  if (statuses.some((s) => ["CLARIFICATION_REQUIRED", "REJECTED", "UNABLE_TO_FULFILL"].includes(s))) return "ACTION_REQUIRED";
  if (statuses.length && statuses.every((s) => s === "CANCELLED")) return "CANCELLED";
  return "PROCESSING";
}

function statusOf(order, trackingStatus) {
  if (order.status === "PENDING_PAYMENT") return { status: "Awaiting Payment", tone: "current" };
  if (order.status === "PAYMENT_FAILED") return { status: "Payment Failed", tone: "done" };
  if (order.status === "CANCELLED") return { status: "Cancelled", tone: "done" };
  // For delivery orders, "ready" means waiting for the rider.
  if (trackingStatus === "READY_FOR_PICKUP" && order.fulfilments.some((f) => f.fulfilmentMethod === "DELIVERY")) {
    return { status: "Ready for Dispatch", tone: "current" };
  }
  return { status: TRACKING_LABELS[trackingStatus] || "Processing", tone: ["DELIVERED", "CANCELLED"].includes(trackingStatus) ? "done" : "current" };
}

function itemsSummaryOf(order) {
  const items = order.fulfilments.flatMap((f) => f.allocations || []);
  if (!items.length) return "Order items";
  return `${items[0].medicationName}${items.length > 1 ? ` + ${items.length - 1} more item${items.length === 2 ? "" : "s"}` : ""}`;
}

const pharmacyLabel = (order) =>
  `${order.fulfilments[0]?.pharmacy?.name || "Sabi Health Order"}${order.fulfilments.length > 1 ? ` + ${order.fulfilments.length - 1} more` : ""}`;

/** Every order the patient has placed, newest first. */
export async function listDeliveries() {
  const orders = await listOrders();
  return orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((order) => {
      const trackingStatus = trackingStatusOf(order.fulfilments);
      const { status, tone } = statusOf(order, trackingStatus);
      const delivery = order.fulfilments.some((f) => f.fulfilmentMethod === "DELIVERY");
      return {
        id: order.id,
        reference: order.reference,
        status,
        statusTone: tone,
        pharmacy: pharmacyLabel(order),
        location: delivery ? "Home delivery" : "In-store pickup",
        itemsSummary: itemsSummaryOf(order),
        total: formatNaira(naira(order.totalPayableMinor)),
        eta: new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
    });
}

// The five journey steps, marked from each fulfilment's real state.
const ORDER = ["AWAITING_PHARMACIST_REVIEW", "APPROVED_FOR_DISPENSING", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"];
const reached = (status, step) => ORDER.indexOf(status) >= ORDER.indexOf(step);

function journeyFor(order, fulfilment, assignment) {
  const paid = order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_FAILED";
  const s = fulfilment?.status || "AWAITING_PAYMENT";
  const problem = ["CLARIFICATION_REQUIRED", "REJECTED", "UNABLE_TO_FULFILL", "CANCELLED"].includes(s);
  const pickup = fulfilment?.fulfilmentMethod === "PICKUP";
  const state = (done, current) => (done ? "done" : current ? "current" : "pending");
  return [
    { title: "Order Confirmed", detail: paid ? "Payment verified" : "Awaiting payment", state: state(paid, !paid) },
    {
      title: "Pharmacist Review",
      detail: problem ? FULFILMENT_LABELS[s] : reached(s, "APPROVED_FOR_DISPENSING") ? "Prescription approved" : paid ? "In review" : "Not yet reviewed",
      state: problem ? "current" : state(reached(s, "APPROVED_FOR_DISPENSING"), s === "AWAITING_PHARMACIST_REVIEW"),
    },
    { title: "Preparing Order", detail: reached(s, "READY_FOR_PICKUP") ? "Packed and ready" : s === "PREPARING" ? "In progress" : "Not yet started", state: state(reached(s, "READY_FOR_PICKUP"), s === "PREPARING" || s === "APPROVED_FOR_DISPENSING") },
    pickup
      ? { title: "Ready for Pickup", detail: s === "READY_FOR_PICKUP" ? "Collect it from the pharmacy" : "Not yet ready", state: state(false, s === "READY_FOR_PICKUP") }
      : {
          title: "Out for Delivery",
          detail: assignment?.outForDeliveryAt ? `${clock(assignment.outForDeliveryAt)} • Heading to you` : assignment ? "Rider assigned" : "Not yet dispatched",
          state: state(s === "DELIVERED", ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(s)),
        },
    { title: pickup ? "Collected" : "Delivered", detail: assignment?.deliveredAt ? `${clock(assignment.deliveredAt)} • Delivered` : "Pending", state: state(s === "DELIVERED", false) },
  ];
}

/** One order with its tracking: map points, journey, items and fees. */
export async function getDelivery(orderId) {
  const [order, tracking] = await Promise.all([getOrder(orderId), getTracking(orderId).catch(() => null)]);
  const fulfilment = order.fulfilments.find((f) => f.fulfilmentMethod === "DELIVERY") || order.fulfilments[0];
  const tracked = tracking?.fulfilments?.find((f) => f.id === fulfilment?.id);
  const assignment = tracked?.deliveryAssignments?.[0] || null;
  const latest = assignment?.trackingPoints?.[0];
  const pending = pendingOrder();
  const address = pending?.orderId === orderId ? pending.address : null;
  const { status } = statusOf(order, tracking?.trackingStatus || trackingStatusOf(order.fulfilments));
  const pharmacy = fulfilment?.pharmacy || {};
  return {
    order: {
      id: order.reference,
      eta: status,
      minutes: fulfilment ? FULFILMENT_LABELS[tracked?.status || fulfilment.status] || status : status,
      distance: "—",
      rider: assignment ? "Your Sabi delivery partner" : "Not assigned yet",
      riderInitials: assignment ? "SH" : "—",
      riderRating: null,
      headline: tracked?.status === "OUT_FOR_DELIVERY" || tracked?.status === "PICKED_UP" ? "Heading to your location" : status,
      subline: latest ? `Last seen ${clock(latest.recordedAt)}` : FULFILMENT_LABELS[tracked?.status || fulfilment?.status] || status,
      vehicle: assignment ? `Assigned ${clock(assignment.assignedAt) || ""}`.trim() : "—",
      pharmacy: pharmacyLabel(order),
      location: [pharmacy.address, pharmacy.city].filter(Boolean).join(", ") || "Pharmacy address on file",
      destinationCoordinates: address?.lat != null ? [address.lat, address.lng] : undefined,
      pharmacyCoordinates: pharmacy.latitude != null ? [pharmacy.latitude, pharmacy.longitude] : undefined,
      courierCoordinates: latest ? [latest.latitude, latest.longitude] : pharmacy.latitude != null ? [pharmacy.latitude, pharmacy.longitude] : undefined,
    },
    steps: journeyFor(order, { ...fulfilment, status: tracked?.status || fulfilment?.status }, assignment),
    items: order.fulfilments.flatMap((f) =>
      (f.allocations || []).map((a) => ({ name: `${a.medicationName} × ${a.selectedQuantity}`, detail: f.pharmacy?.name || "Pharmacy", price: formatNaira(naira(a.lineTotalMinor)) }))),
    deliveryFee: naira(order.deliveryFeeMinor),
  };
}
