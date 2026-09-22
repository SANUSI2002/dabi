// PHASE 9 — PRODUCT MANAGEMENT SPANNING BOTH PRODUCTS.
//
// Product Roadmap and Releases (../pages/ProductRoadmap.tsx, ../pages/ProductReleases.tsx) file
// items against Command Center's product catalog (useCommandCenter().products), which already
// includes Sabi OS's licensed products (Sabi EMR, Workforce, Accounting — see
// @/platform/entitlements) alongside forward-looking entries (Patient Portal, Doctor Portal,
// Telemedicine, Sabi Analytics, Sabi AI Services — see ../seed.ts's futureProducts). That catalog
// never distinguished which ecosystem half each product belongs to, so a PM planning a
// Telemedicine feature and the Command Center's own ecosystem product switcher
// (useProductContext) had no connection to each other. This classifier is that connection.
export type ProductEcosystem = "Sabi OS" | "Sabi Health" | "Shared";

const SABI_OS_PRODUCT_IDS = new Set(["emr", "workforce", "accounting"]);
const SABI_HEALTH_PRODUCT_IDS = new Set(["patient-portal", "doctor-portal", "telemedicine"]);

export function ecosystemOfProduct(productId: string): ProductEcosystem {
  if (SABI_OS_PRODUCT_IDS.has(productId)) return "Sabi OS";
  if (SABI_HEALTH_PRODUCT_IDS.has(productId)) return "Sabi Health";
  return "Shared";
}

export const PRODUCT_ECOSYSTEM_FILTERS = ["All", "Sabi OS", "Sabi Health", "Shared"] as const;
