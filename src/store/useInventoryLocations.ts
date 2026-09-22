import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { persisted } from "@/platform/persist";
import { DEFAULT_STORE_LOCATION_ID } from "@/data/accounting/inventory";

// Inventory — physical storage locations (Store/Department/Ward that hold or
// draw stock). Distinct from useWards' clinical WARDS/BEDS (bed assignment for
// admitted patients) — these are stock-holding points, configurable by an
// administrator.

const rid = () => Math.random().toString(36).slice(2, 9);

export type LocationType = "Store" | "Department" | "Ward";
export const LOCATION_TYPES: LocationType[] = ["Store", "Department", "Ward"];

export type StorageLocation = {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  status: "Active" | "Inactive";
};

const SEED: StorageLocation[] = [
  { id: DEFAULT_STORE_LOCATION_ID, name: "Main Store", code: "MAIN", type: "Store", status: "Active" },
  { id: "loc-pharm", name: "Pharmacy Store", code: "PHARM", type: "Store", status: "Active" },
  { id: "loc-lab", name: "Laboratory Store", code: "LAB", type: "Store", status: "Active" },
  { id: "loc-er", name: "Emergency", code: "ER", type: "Department", status: "Active" },
  { id: "loc-icu", name: "ICU", code: "ICU", type: "Ward", status: "Active" },
  { id: "loc-theatre", name: "Theatre", code: "OT", type: "Department", status: "Active" },
  { id: "loc-medward", name: "Medical Ward", code: "MEDW", type: "Ward", status: "Active" },
  { id: "loc-mat", name: "Maternity", code: "MAT", type: "Ward", status: "Active" },
  { id: "loc-ped", name: "Pediatrics", code: "PED", type: "Ward", status: "Active" },
  { id: "loc-rad", name: "Radiology", code: "RAD", type: "Department", status: "Active" },
];

type InventoryLocationsState = {
  locations: StorageLocation[];
  activeLocations: () => StorageLocation[];
  locationById: (id?: string) => StorageLocation | undefined;
  locationName: (id?: string) => string;
  addLocation: (input: Omit<StorageLocation, "id" | "status">) => string;
  setLocationStatus: (id: string, status: StorageLocation["status"]) => void;
};

export const useInventoryLocations = create<InventoryLocationsState>(persisted<InventoryLocationsState>("inventory-locations", (set, get) => ({
  locations: SEED,

  activeLocations: () => get().locations.filter((l) => l.status === "Active"),
  locationById: (id) => get().locations.find((l) => l.id === id),
  locationName: (id) => get().locationById(id)?.name ?? id ?? "—",

  addLocation: (input) => {
    const id = `loc-${rid()}`;
    set((s) => ({ locations: [{ ...input, id, status: "Active" }, ...s.locations] }));
    audit("added storage location", `inventory/location/${id}`, { meta: { name: input.name } });
    return id;
  },

  setLocationStatus: (id, status) => {
    set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, status } : l)) }));
    audit(`storage location ${status.toLowerCase()}`, `inventory/location/${id}`);
  },
})));
