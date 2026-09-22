// unavailableItemIds lists which prescription item IDs (see
// prescriptions/data.js PRESCRIPTION_DETAILS items) this pharmacy does
// NOT have in stock — everything else is treated as available. Powers
// "2 of 3 available" comparisons and the Available / Unavailable
// Medicines split on each pharmacy's invoice.
export const QUOTES = [
  { id: "medplus", name: "MedPlus Pharmacy", rating: "4.8", distance: "1.2 km away", total: "₦12,500", availability: "Available", eta: "Ready for Pickup or Delivery (30-45 mins)", best: true, lat: 6.6238, lng: 3.3110, fulfillmentRate: 96, deliveryFee: 1000, unavailableItemIds: [] },
  { id: "healthplus", name: "HealthPlus Lagos", rating: "4.5", distance: "2.8 km away", total: "₦14,200", availability: "Available", eta: "Ready for Pickup in 1 hour", lat: 6.6156, lng: 3.3262, fulfillmentRate: 88, deliveryFee: 1200, unavailableItemIds: ["d3"] },
  { id: "safari", name: "Safari Pharmacy", rating: "4.9", distance: "3.5 km away", total: "₦13,100", availability: "Available", eta: "Ready for Delivery (45-60 mins)", lat: 6.6073, lng: 3.3385, fulfillmentRate: 99, deliveryFee: 1500, unavailableItemIds: ["d2", "d3"] },
  { id: "tmed", name: "T-Med Care", rating: "4.2", distance: "5.1 km away", availability: "Out of Stock", lat: 6.6002, lng: 3.3034, fulfillmentRate: 61, deliveryFee: 1200, unavailableItemIds: null },
];

export const PRESCRIPTION_DETAILS = { medication: "Lisinopril 10mg", supply: "30 Tablets (Monthly Supply)", requested: "Oct 24, 09:12 AM", expires: "22h 15m" };
