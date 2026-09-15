import { LAB_TESTS, SERVICE_TYPES } from "@/data/catalog";
import { drugs } from "@/data/mock";
import { activeTenantId } from "@/platform/tenantRuntime";
import type { PriceVersion, ServiceCatalogItem } from "./domain";

const slug = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const revenueFor = (department: string) => {
  const key = department.toLowerCase();
  if (key.includes("lab")) return "4010";
  if (key.includes("pharm")) return "4020";
  if (key.includes("procedure")) return "4030";
  if (key.includes("admission") || key.includes("mch")) return "4040";
  if (key.includes("radiology") || key.includes("imaging")) return "4050";
  if (key.includes("consult")) return "4000";
  return "4100";
};

const pharmacyPrices: Record<string, number> = {
  Amoxicillin: 1000,
  Paracetamol: 150,
  "Artemether/Lumefantrine": 250,
  ORS: 200,
  Amlodipine: 100,
  Metformin: 120,
  "Ferrous + Folic Acid": 80,
  "DMPA (Depo-Provera)": 1500,
  "Zinc Sulphate": 100,
  "Cough Expectorant": 1200,
};

export function seedBillingCatalog(): { services: ServiceCatalogItem[]; prices: PriceVersion[] } {
  const organizationId = activeTenantId();
  const now = "2026-01-01T00:00:00.000Z";
  const source = [
    ...SERVICE_TYPES.filter((item) => item.billable).map((item) => ({
      code: item.code,
      name: item.name,
      aliases: [] as string[],
      department: item.category,
      category: item.category,
      amount: item.price,
    })),
    ...LAB_TESTS.map((item) => ({
      code: `LAB-${slug(item.name)}`,
      name: item.name,
      aliases: item.name === "Packed Cell Volume (PCV)" ? ["PCV"] : item.name === "Malaria Parasite (MP)" ? ["Malaria Parasite", "MP"] : [],
      department: "Laboratory",
      category: item.category,
      amount: item.price,
    })),
    ...drugs.map((item) => ({
      code: `PHA-${slug(`${item.name}-${item.strength}`)}`,
      name: `${item.name} ${item.strength}`.replace(" —", ""),
      aliases: [item.name],
      department: "Pharmacy",
      category: item.klass,
      amount: pharmacyPrices[item.name] ?? 0,
    })),
  ];

  const unique = source.filter((item, index) => source.findIndex((candidate) => candidate.code === item.code) === index);
  const services = unique.map<ServiceCatalogItem>((item) => ({
    id: `svc-${item.code.toLowerCase()}`,
    organizationId,
    code: item.code,
    name: item.name,
    aliases: item.aliases,
    department: item.department,
    category: item.category,
    revenueAccountCode: revenueFor(item.department),
    active: true,
  }));
  const prices = unique.map<PriceVersion>((item) => ({
    id: `price-${item.code.toLowerCase()}-2026-self`,
    serviceId: `svc-${item.code.toLowerCase()}`,
    priceListId: "SELF_PAY_2026",
    payerType: "DEFAULT",
    amountMinor: Math.round(item.amount * 100),
    currency: "NGN",
    effectiveFrom: now,
    active: true,
  }));
  return { services, prices };
}
