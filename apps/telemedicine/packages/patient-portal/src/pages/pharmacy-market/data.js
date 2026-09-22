export const PHARMACY_FILTERS = ["All Results", "Open Now", "Highly Rated", "Quickest Delivery"];

export const PHARMACY_SEARCH_CONFIG = {
  defaultRadiusKm: 2,
  maxRadiusKm: 10,
  radiusSteps: [2, 4, 6, 8, 10],
  recommendationStrategy: "none",
};

export const PHARMACY_STATS = {
  count: 8,
  radius: "5km",
  closestDistance: "1.2km",
  deliveryTime: "15 - 25 mins",
};

export const PHARMACIES = [
  { id: "medplus", name: "MedPlus Pharmacy", rating: "4.8", distance: "1.2km away", status: "Open 24/7", availability: "available", delivery: "18 mins", lat: 6.6238, lng: 3.3110 },
  { id: "healthplus", name: "HealthPlus Lagos", rating: "4.5", distance: "2.8km away", status: "Closes 10 PM", availability: "available", delivery: "25 mins", lat: 6.6156, lng: 3.3262 },
  { id: "safari", name: "Safari Pharmacy", rating: "4.9", distance: "3.5km away", status: "Open 24/7", availability: "limited", delivery: "30 mins", lat: 6.6073, lng: 3.3385 },
  { id: "tmed", name: "T-Med Care", rating: "4.2", distance: "4.9km away", status: "Closes 8 PM", availability: "available", delivery: "35 mins", lat: 6.6002, lng: 3.3034 },
  { id: "carepoint", name: "CarePoint Pharmacy", rating: "4.7", distance: "6.8km away", status: "Closes 9 PM", availability: "available", delivery: "45 mins", lat: 6.5850, lng: 3.3560 },
  { id: "wellcare", name: "WellCare Pharmacy", rating: "4.6", distance: "8.9km away", status: "Open 24/7", availability: "available", delivery: "55 mins", lat: 6.5600, lng: 3.3720 },
];

export const PRESCRIPTION = "Lisinopril 10mg";
