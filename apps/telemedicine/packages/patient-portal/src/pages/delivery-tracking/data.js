// ---------------- Active deliveries (list view) ----------------
// Each entry is a lightweight summary shown on the list page. The full
// detail (journey steps + line items) lives in DELIVERY_JOURNEYS /
// DELIVERY_ITEMS below, keyed by the same id.
export const ACTIVE_DELIVERIES = [
  {
    id: "SHM78934",
    status: "Out for Delivery",
    statusTone: "current",
    pharmacy: "Sabi Premium Pharmacy",
    location: "Victoria Island Branch",
    itemsSummary: "Amoxicillin 500mg + 1 more item",
    total: "₦12,700",
    eta: "12:42 PM",
    minutes: "12 mins",
    distance: "1.8km",
    rider: "Abiodun S.",
    vehicle: "Suzuki Access 125 • ABC-123-XY",
  },
  {
    id: "SHM78811",
    status: "Preparing Order",
    statusTone: "current",
    pharmacy: "City Care Meds",
    location: "Adeola Odeku Branch",
    itemsSummary: "Paracetamol 500mg",
    total: "₦8,500",
    eta: "1:20 PM",
    minutes: "38 mins",
    distance: "3.4km",
    rider: "Not assigned yet",
    vehicle: "—",
  },
  {
    id: "SHM77502",
    status: "Delivered",
    statusTone: "done",
    pharmacy: "Wellness Hub",
    location: "Ikoyi Crescent Branch",
    itemsSummary: "Omega-3 Fish Oil + 1 more item",
    total: "₦59,650",
    eta: "Delivered 2 days ago",
    minutes: "0 mins",
    distance: "0km",
    rider: "Chidi O.",
    vehicle: "Honda CB125 • LSD-882-KJ",
  },
];

export const DELIVERY_JOURNEYS = {
  SHM78934: [
    { title: "Order Confirmed", detail: "12:10 PM • Payment Verified", state: "done" },
    { title: "Pharmacist Review", detail: "12:15 PM • Prescription Approved", state: "done" },
    { title: "Preparing Order", detail: "12:22 PM • Hygienically Packed", state: "done" },
    { title: "Out for Delivery", detail: "Heading to you • 1.8km away", state: "current" },
    { title: "Arriving Soon", detail: "Pending arrival", state: "pending" },
  ],
  SHM78811: [
    { title: "Order Confirmed", detail: "1:02 PM • Payment Verified", state: "done" },
    { title: "Pharmacist Review", detail: "1:08 PM • Prescription Approved", state: "done" },
    { title: "Preparing Order", detail: "In progress • Hygienically packing", state: "current" },
    { title: "Out for Delivery", detail: "Pending dispatch", state: "pending" },
    { title: "Arriving Soon", detail: "Pending arrival", state: "pending" },
  ],
  SHM77502: [
    { title: "Order Confirmed", detail: "Payment Verified", state: "done" },
    { title: "Pharmacist Review", detail: "Prescription Approved", state: "done" },
    { title: "Preparing Order", detail: "Hygienically Packed", state: "done" },
    { title: "Out for Delivery", detail: "Delivered by Chidi O.", state: "done" },
    { title: "Delivered", detail: "Signed for at door", state: "done" },
  ],
};

export const DELIVERY_ITEMS = {
  SHM78934: [
    { name: "Amoxicillin 500mg", detail: "Prescription Required", price: "₦4,200" },
    { name: "Vitamin C Serum", detail: "OTC Item", price: "₦8,500" },
  ],
  SHM78811: [
    { name: "Paracetamol 500mg", detail: "OTC Item", price: "₦8,500" },
  ],
  SHM77502: [
    { name: "Omega-3 Fish Oil", detail: "OTC Item", price: "₦32,550" },
    { name: "Mineral Sunscreen SPF 50", detail: "OTC Item", price: "₦27,100" },
  ],
};

// Fallback template used for any real checkout order (from cartStore)
// that doesn't have a hand-authored journey yet — keeps the detail
// page functional for orders placed through the real checkout flow.
// Reflects only what has genuinely happened to a real, locally-placed order: it was recorded
// as a request. No payment provider, pharmacist review or dispatch integration exists yet, so
// every later stage stays "pending" rather than being marked done in advance.
export function genericJourneyFor(status) {
  const delivered = status === "Delivered";
  return [
    { title: "Order Request Sent", detail: "Awaiting pharmacy confirmation", state: "done" },
    { title: "Pharmacist Review", detail: "Not yet reviewed", state: delivered ? "done" : "pending" },
    { title: "Preparing Order", detail: "Not yet started", state: delivered ? "done" : "pending" },
    { title: "Out for Delivery", detail: delivered ? "Delivered" : "Not yet dispatched", state: delivered ? "done" : "pending" },
    { title: "Arriving Soon", detail: delivered ? "Delivered to door" : "Pending arrival", state: delivered ? "done" : "pending" },
  ];
}
