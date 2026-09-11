// Equipment Intelligence + SCADA domain model. This is a NEW module, additive to the existing
// generic src/data/assets.ts (Asset/MaintenanceJob), which remains untouched and keeps serving
// non-monitored assets (furniture, hand tools, etc.). EquipmentRecord is for devices this module
// can monitor, simulate telemetry for, and raise alarms against — clinical devices and facility
// infrastructure (generators, HVAC, medical gas, cold chain, water, elevators).
//
// FHIR/DICOM-aligned where it helps (device category concepts), but this module never claims
// literal DICOM/HL7 conformance — see equipmentIntegration.ts for the honest SIMULATOR vs
// REAL_DEVICE vs NOT_CONFIGURED distinction.

export type EquipmentCategory =
  | "Laboratory Analyzer" | "Radiology Imaging" | "ICU Device" | "Theatre Equipment"
  | "Dialysis Equipment" | "Pharmacy Cold Chain" | "Generator" | "HVAC" | "Medical Gas"
  | "Water Treatment" | "Solar / Inverter" | "Elevator" | "Other Infrastructure";

export type OwnershipType = "Owned" | "Leased" | "Rented" | "Donated" | "Vendor-owned" | "Government-owned";

export type EquipmentLocation = {
  building: string;
  floor?: string;
  department: string;
  ward?: string;
  room?: string;
  exact?: string;
};

export type EquipmentProcurement = {
  supplier?: string;
  purchaseDate?: string;
  purchaseOrderNo?: string;
  invoiceNo?: string;
  purchasePrice?: number;
  currency?: string;
  installationCost?: number;
};

export type EquipmentLifecycle = {
  installationDate?: string;
  commissioningDate?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  expectedLifespanYears?: number;
  decommissionDate?: string;
};

export type IntegrationKind = "SIMULATOR" | "REAL_DEVICE" | "NOT_CONFIGURED";
export type AdapterProtocol = "HL7" | "ASTM" | "DICOM" | "REST" | "WebSocket" | "TCP/IP" | "Serial" | "Modbus" | "Manufacturer SDK" | "Simulator";

export type EquipmentTechnical = {
  firmwareVersion?: string;
  ipAddress?: string;
  gateway?: string;
  protocol?: AdapterProtocol;
  integrationKind: IntegrationKind;
};

export type EquipmentCompliance = {
  regulatoryRegistration?: string;
  certificationExpiry?: string;
  calibrationRequired: boolean;
  calibrationIntervalDays?: number;
  preventiveMaintenanceIntervalDays?: number;
};

export type EquipmentRecord = {
  id: string;
  equipmentId: string; // human-facing tag, e.g. "EQ-LAB-0007"
  linkedAssetId?: string; // optional link into the existing fixed-asset/accounting register
  name: string;
  category: EquipmentCategory;
  manufacturer: string;
  model: string;
  serialNumber: string;
  ownership: OwnershipType;
  location: EquipmentLocation;
  procurement: EquipmentProcurement;
  lifecycle: EquipmentLifecycle;
  technical: EquipmentTechnical;
  compliance: EquipmentCompliance;
  createdAt: string;
  registeredBy: string;
};

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  "Laboratory Analyzer", "Radiology Imaging", "ICU Device", "Theatre Equipment",
  "Dialysis Equipment", "Pharmacy Cold Chain", "Generator", "HVAC", "Medical Gas",
  "Water Treatment", "Solar / Inverter", "Elevator", "Other Infrastructure",
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const EQUIPMENT_SEED: EquipmentRecord[] = [
  {
    id: "eq1", equipmentId: "EQ-LAB-0001", name: "Hematology Analyzer", category: "Laboratory Analyzer",
    manufacturer: "Mindray", model: "BC-5150", serialNumber: "MDR-5150-2291", ownership: "Owned",
    location: { building: "Main Building", floor: "Ground", department: "Laboratory", room: "Haematology Bay" },
    procurement: { supplier: "Mindray Nigeria", purchaseDate: daysAgo(540), purchasePrice: 4200000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(520), commissioningDate: daysAgo(515), warrantyStart: daysAgo(520), warrantyEnd: daysAgo(-660), expectedLifespanYears: 8 },
    technical: { firmwareVersion: "2.4.1", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 90, preventiveMaintenanceIntervalDays: 180 },
    createdAt: daysAgo(520), registeredBy: "Biomed Eng. Tunde Bakare",
  },
  {
    id: "eq2", equipmentId: "EQ-LAB-0002", name: "Chemistry Analyzer", category: "Laboratory Analyzer",
    manufacturer: "Beckman Coulter", model: "AU480", serialNumber: "BC-AU480-1187", ownership: "Owned",
    location: { building: "Main Building", floor: "Ground", department: "Laboratory", room: "Chemistry Bay" },
    procurement: { supplier: "Beckman Coulter West Africa", purchaseDate: daysAgo(700), purchasePrice: 9800000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(680), commissioningDate: daysAgo(675), warrantyStart: daysAgo(680), warrantyEnd: daysAgo(-50), expectedLifespanYears: 10 },
    technical: { firmwareVersion: "1.9.0", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 60, preventiveMaintenanceIntervalDays: 180 },
    createdAt: daysAgo(680), registeredBy: "Biomed Eng. Tunde Bakare",
  },
  {
    id: "eq3", equipmentId: "EQ-ICU-0001", name: "Ventilator — ICU Bed 2", category: "ICU Device",
    manufacturer: "Drager", model: "Evita V300", serialNumber: "DRG-V300-4471", ownership: "Owned",
    location: { building: "Main Building", floor: "1st Floor", department: "ICU", ward: "ICU", room: "Bed 2" },
    procurement: { supplier: "Drager Medical", purchaseDate: daysAgo(400), purchasePrice: 15500000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(390), commissioningDate: daysAgo(388), warrantyStart: daysAgo(390), warrantyEnd: daysAgo(-340), expectedLifespanYears: 10 },
    technical: { firmwareVersion: "3.1.2", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 180, preventiveMaintenanceIntervalDays: 90 },
    createdAt: daysAgo(390), registeredBy: "Biomed Eng. Tunde Bakare",
  },
  {
    id: "eq4", equipmentId: "EQ-ICU-0002", name: "Patient Monitor — ICU Bed 1", category: "ICU Device",
    manufacturer: "Philips", model: "IntelliVue MX450", serialNumber: "PHL-MX450-8820", ownership: "Owned",
    location: { building: "Main Building", floor: "1st Floor", department: "ICU", ward: "ICU", room: "Bed 1" },
    procurement: { supplier: "Philips Healthcare", purchaseDate: daysAgo(300), purchasePrice: 3800000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(290), warrantyStart: daysAgo(290), warrantyEnd: daysAgo(-440), expectedLifespanYears: 8 },
    technical: { firmwareVersion: "K.10", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 180, preventiveMaintenanceIntervalDays: 90 },
    createdAt: daysAgo(290), registeredBy: "Biomed Eng. Tunde Bakare",
  },
  {
    id: "eq5", equipmentId: "EQ-DLY-0001", name: "Dialysis Machine 1", category: "Dialysis Equipment",
    manufacturer: "Fresenius", model: "4008S", serialNumber: "FMC-4008S-5521", ownership: "Leased",
    location: { building: "Main Building", floor: "Ground", department: "Dialysis Unit", room: "Station 1" },
    procurement: { supplier: "Fresenius Medical Care", purchaseDate: daysAgo(200) },
    lifecycle: { installationDate: daysAgo(195), warrantyStart: daysAgo(195), warrantyEnd: daysAgo(-165), expectedLifespanYears: 7 },
    technical: { firmwareVersion: "5.2", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 90, preventiveMaintenanceIntervalDays: 90 },
    createdAt: daysAgo(195), registeredBy: "Biomed Eng. Tunde Bakare",
  },
  {
    id: "eq6", equipmentId: "EQ-PHM-0001", name: "Pharmacy Cold Room Fridge", category: "Pharmacy Cold Chain",
    manufacturer: "Haier Biomedical", model: "HYC-610", serialNumber: "HYC610-7742", ownership: "Owned",
    location: { building: "Main Building", floor: "Ground", department: "Pharmacy", room: "Cold Storage" },
    procurement: { supplier: "Haier Biomedical Nigeria", purchaseDate: daysAgo(450), purchasePrice: 1200000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(440), warrantyStart: daysAgo(440), warrantyEnd: daysAgo(-285), expectedLifespanYears: 10 },
    technical: { firmwareVersion: "1.0", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 180, preventiveMaintenanceIntervalDays: 90 },
    createdAt: daysAgo(440), registeredBy: "Biomed Eng. Tunde Bakare",
  },
  {
    id: "eq7", equipmentId: "EQ-INF-0001", name: "Standby Generator 250kVA", category: "Generator",
    manufacturer: "Cummins", model: "C250D5", serialNumber: "CUM-C250-9910", ownership: "Owned",
    location: { building: "Generator House", department: "Facilities", exact: "Generator Yard" },
    procurement: { supplier: "Mantrac Nigeria", purchaseDate: daysAgo(900), purchasePrice: 28000000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(880), warrantyStart: daysAgo(880), warrantyEnd: daysAgo(-215), expectedLifespanYears: 15 },
    technical: { firmwareVersion: "—", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: false, preventiveMaintenanceIntervalDays: 30 },
    createdAt: daysAgo(880), registeredBy: "Facility Eng. Chuka Eze",
  },
  {
    id: "eq8", equipmentId: "EQ-INF-0002", name: "Theatre HVAC Unit 1", category: "HVAC",
    manufacturer: "Carrier", model: "AquaSnap 30RA", serialNumber: "CAR-30RA-3301", ownership: "Owned",
    location: { building: "Main Building", floor: "1st Floor", department: "Theatre", room: "Plant Room" },
    procurement: { supplier: "Carrier Nigeria", purchaseDate: daysAgo(600), purchasePrice: 9200000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(590), warrantyStart: daysAgo(590), warrantyEnd: daysAgo(-140), expectedLifespanYears: 12 },
    technical: { firmwareVersion: "—", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: false, preventiveMaintenanceIntervalDays: 60 },
    createdAt: daysAgo(590), registeredBy: "Facility Eng. Chuka Eze",
  },
  {
    id: "eq9", equipmentId: "EQ-INF-0003", name: "Medical Gas Manifold — O2", category: "Medical Gas",
    manufacturer: "BeaconMedaes", model: "Vacuum/O2 Manifold", serialNumber: "BMX-O2-6610", ownership: "Owned",
    location: { building: "Main Building", floor: "Ground", department: "Facilities", room: "Gas Plant Room" },
    procurement: { supplier: "BeaconMedaes West Africa", purchaseDate: daysAgo(750), purchasePrice: 4500000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(740), warrantyStart: daysAgo(740), warrantyEnd: daysAgo(15), expectedLifespanYears: 15 },
    technical: { firmwareVersion: "—", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 365, preventiveMaintenanceIntervalDays: 90 },
    createdAt: daysAgo(740), registeredBy: "Facility Eng. Chuka Eze",
  },
  {
    id: "eq10", equipmentId: "EQ-RAD-0001", name: "X-Ray Machine", category: "Radiology Imaging",
    manufacturer: "GE Healthcare", model: "Optima XR220amx", serialNumber: "GEH-XR220-2201", ownership: "Owned",
    location: { building: "Main Building", floor: "Ground", department: "Radiology", room: "X-Ray Suite" },
    procurement: { supplier: "GE Healthcare Nigeria", purchaseDate: daysAgo(620), purchasePrice: 21000000, currency: "NGN" },
    lifecycle: { installationDate: daysAgo(610), warrantyStart: daysAgo(610), warrantyEnd: daysAgo(-90), expectedLifespanYears: 12 },
    technical: { firmwareVersion: "4.0", protocol: "Simulator", integrationKind: "SIMULATOR" },
    compliance: { calibrationRequired: true, calibrationIntervalDays: 365, preventiveMaintenanceIntervalDays: 180 },
    createdAt: daysAgo(610), registeredBy: "Biomed Eng. Tunde Bakare",
  },
];

export function newEquipmentId(category: EquipmentCategory, sequence: number): string {
  const prefix: Record<EquipmentCategory, string> = {
    "Laboratory Analyzer": "LAB", "Radiology Imaging": "RAD", "ICU Device": "ICU", "Theatre Equipment": "THR",
    "Dialysis Equipment": "DLY", "Pharmacy Cold Chain": "PHM", "Generator": "INF", "HVAC": "INF",
    "Medical Gas": "INF", "Water Treatment": "INF", "Solar / Inverter": "INF", "Elevator": "INF", "Other Infrastructure": "INF",
  };
  return `EQ-${prefix[category]}-${String(sequence).padStart(4, "0")}`;
}
