export const QUICK_ACTIONS = [
  { key: "prescription", label: "Prescription", icon: "UploadCloud", tone: "primary" },
  { key: "refill", label: "Refill Prescription", icon: "RotateCw", tone: "primary" },
  { key: "emergency", label: "Emergency Meds", icon: "Siren", tone: "danger" },
  { key: "repeat", label: "Repeat Last Order", icon: "History", tone: "neutral" },
];

export const CATEGORIES = [
  { key: "prescription", label: "Prescription", icon: "FileText" },
  { key: "otc", label: "Over-the-Counter", icon: "Pill" },
  { key: "baby", label: "Baby Care", icon: "Baby" },
  { key: "devices", label: "Medical Devices", icon: "Stethoscope" },
  { key: "wellness", label: "Wellness", icon: "Leaf" },
  { key: "hygiene", label: "Hygiene", icon: "ShieldCheck" },
  { key: "supplements", label: "Supplements", icon: "Citrus" },
  { key: "vaccines", label: "Vaccines", icon: "Syringe" },
];

export const FEATURED_PHARMACIES = [
  {
    id: "sabi-premium",
    name: "Sabi Premium Pharmacy",
    rating: "4.9",
    delivery: "20 mins delivery",
    tags: ["Verified", "24-Hour", "Insurance Accepted"],
    photo: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80",
    address: "42 Healthcare Crescent, Medical District, VI, Lagos",
    lat: 6.4311,
    lng: 3.4219,
    hours: { weekday: "08:00 AM - 10:00 PM", weekend: "09:00 AM - 08:00 PM" },
    license: "#PHA-2024-8901",
    pharmacist: { name: "Dr. Adebayo Smith", title: "Chief Pharmacist (15+ Years Exp.)" },
    insurance: ["AXA Mansard", "Reliance HMO", "Hygeia HMO", "Bupa Global"],
    products: [
      { id: "amox", name: "Amoxicillin 500mg", category: "Antibiotics", price: 19400, photo: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80", tag: "Prescription Required" },
      { id: "vitc", name: "Radiance Vitamin C Serum", category: "Skincare · Wellness", price: 38750, photo: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80" },
      { id: "bpmon", name: "Digital BP Monitor V2", category: "Medical Devices", price: 69750, photo: "https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=400&q=80", tag: "Best Seller" },
      { id: "ibu", name: "Ibuprofen 200mg (24ct)", category: "Pain Relief · OTC", price: 13550, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" },
      { id: "multi", name: "Daily Multivitamin+", category: "Supplements", price: 29450, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" },
      { id: "baby", name: "Gentle Baby Body Wash", category: "Baby Care", price: 22000, photo: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&q=80" },
    ],
  },
  {
    id: "city-care",
    name: "City Care Meds",
    rating: "4.7",
    delivery: "35 mins delivery",
    tags: ["Emergency Delivery", "Verified"],
    photo: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80",
    address: "18 Adeola Odeku Street, Victoria Island, Lagos",
    lat: 6.4298,
    lng: 3.4189,
    hours: { weekday: "24 hours", weekend: "24 hours" },
    license: "#PHA-2023-4410",
    pharmacist: { name: "Dr. Ngozi Eze", title: "Lead Pharmacist (10+ Years Exp.)" },
    insurance: ["Reliance HMO", "Hygeia HMO"],
    products: [
      { id: "paracet", name: "Paracetamol 500mg", category: "Pain Relief · OTC", price: 8500, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" },
      { id: "orsalt", name: "Oral Rehydration Salts", category: "Wellness", price: 4950, photo: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80" },
    ],
  },
  {
    id: "wellness-hub",
    name: "Wellness Hub",
    rating: "4.8",
    delivery: "25 mins delivery",
    tags: ["Verified", "Insurance Accepted"],
    photo: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800&q=80",
    address: "9 Ikoyi Crescent, Ikoyi, Lagos",
    lat: 6.4532,
    lng: 3.4344,
    hours: { weekday: "08:00 AM - 09:00 PM", weekend: "09:00 AM - 06:00 PM" },
    license: "#PHA-2022-1187",
    pharmacist: { name: "Dr. Femi Bello", title: "Consultant Pharmacist (18+ Years Exp.)" },
    insurance: ["AXA Mansard", "Bupa Global"],
    products: [
      { id: "omega", name: "Omega-3 Fish Oil", category: "Supplements", price: 32550, photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80" },
      { id: "sun", name: "Mineral Sunscreen SPF 50", category: "Skincare · Wellness", price: 27100, photo: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80" },
    ],
  },
];

// The production source for this list is the marketplace API. During local
// development the operator portal publishes a deliberately small, public-only
// projection to this shared key. Private drafts and tenant-owned inventory are
// never read by the patient app.
export function getMarketplacePharmacies() {
  try {
    const preview = new URLSearchParams(window.location.search).get("marketplacePreview");
    const parsedPreview = preview ? JSON.parse(preview) : null;
    if (parsedPreview?.version === 1 && Array.isArray(parsedPreview.offers)) {
      window.localStorage.setItem("sabi-pharmacy-marketplace:published:v1", JSON.stringify(parsedPreview));
    }
    const raw = parsedPreview ? JSON.stringify(parsedPreview) : window.localStorage.getItem("sabi-pharmacy-marketplace:published:v1");
    const projection = raw ? JSON.parse(raw) : null;
    const offers = Array.isArray(projection?.offers) ? projection.offers : [];
    if (offers.length > 0) {
      const grouped = new Map();
      offers.forEach((offer) => {
        if (!grouped.has(offer.organizationId)) grouped.set(offer.organizationId, []);
        grouped.get(offer.organizationId).push(offer);
      });
      return [...grouped.entries()].map(([organizationId, tenantOffers]) => ({
        ...(() => {
          const storefront = tenantOffers[0].storefront || {};
          return {
            address: storefront.address || "Address available from pharmacy",
            phone: storefront.phone || "Contact pharmacy",
            hours: {
              weekday: storefront.weekdayHours || "Store hours available",
              weekend: storefront.weekendHours || "Store hours available",
            },
            description: storefront.description || "Verified Sabi Health pharmacy",
            deliveryFee: storefront.deliveryFeeMinor || 0,
            minimumOrder: storefront.minimumOrderMinor || 0,
          };
        })(),
        id: `tenant-${organizationId}`,
        organizationId,
        name: tenantOffers[0].storefrontName || "Sabi Pharmacy",
        rating: "—",
        delivery: tenantOffers[0].deliveryEnabled ? "Delivery available" : "Pickup available",
        tags: ["Verified", "Published catalogue"],
        photo: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&q=80",
        license: "Verified by Sabi Health",
        pharmacist: { name: "Pharmacy team", title: "Licensed pharmacy organization" },
        insurance: [],
        products: tenantOffers.map((offer) => ({
          id: offer.id,
          name: `${offer.drug?.name || "Medicine"} ${offer.drug?.strength || ""}`.trim(),
          category: offer.drug?.category || "Medicine",
          price: offer.priceMinor,
          stockQuantity: offer.stockQuantity,
          pickupEnabled: offer.pickupEnabled,
          deliveryEnabled: offer.deliveryEnabled,
          photo: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
          tag: offer.prescriptionRequired ? "Prescription Required" : undefined,
        })),
      }));
    }
  } catch {
    // The static development catalogue below remains available while the API is absent.
  }
  return FEATURED_PHARMACIES;
}
