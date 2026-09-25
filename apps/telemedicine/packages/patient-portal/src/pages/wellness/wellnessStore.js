// Wellness Hub — categories plus mappers over the live Sabi API. Providers publish
// offerings (a service in a category); patients book one, and the provider confirms or
// declines. Offering `category` values use the category ids below.

export const CATEGORIES = [
  { id: "caregiver", label: "Caregivers", description: "Home and elderly care" },
  { id: "nutritionist", label: "Nutritionists & Dieticians", description: "Meal plans and nutrition advice" },
  { id: "fitness_coach", label: "Fitness Coaches", description: "Exercise and rehabilitation" },
  { id: "therapist", label: "Therapists", description: "Mental health and counseling" },
  { id: "health_educator", label: "Health Educators", description: "Lifestyle and disease education" },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

export const categoryLabel = (id) => getCategory(id)?.label || id;

/** A published offering, flattened for display. */
export const toOffering = (o) => {
  const org = o.provider?.organisation;
  const pro = o.provider?.professional;
  return {
    id: o.id,
    name: o.name,
    category: o.category,
    description: o.description || "",
    price: (o.priceMinor ?? 0) / 100,
    providerName: org?.name || pro?.practiceName || "Verified provider",
    providerDetail: org ? [org.address, org.city].filter(Boolean).join(", ") : pro?.specialty || "",
  };
};

export const BOOKING_STATUS = {
  PENDING: { label: "Awaiting provider", tone: "pending" },
  CONFIRMED: { label: "Confirmed", tone: "good" },
  REJECTED: { label: "Declined", tone: "bad" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const toBooking = (b) => ({
  id: b.id,
  status: b.status,
  statusLabel: BOOKING_STATUS[b.status]?.label || b.status,
  tone: BOOKING_STATUS[b.status]?.tone || "neutral",
  requestedAt: b.requestedAt,
  createdAt: b.createdAt,
  offering: b.offering ? toOffering(b.offering) : null,
});

export const initials = (name) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
