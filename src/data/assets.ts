// Equipment / asset register + maintenance jobs.

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type AssetStatus = "In service" | "Under repair" | "Out of service" | "Retired";
export type AssetCategory = "Cold chain" | "Maternity" | "Diagnostics" | "Power" | "IT" | "General";

export type Asset = {
  id: string;
  tag: string;
  name: string;
  category: AssetCategory;
  location: string;
  status: AssetStatus;
  commissionedOn: string;
  serviceIntervalDays: number;
  lastServicedOn: string;
};

export type JobType = "Corrective" | "Preventive";
export type JobStatus = "Open" | "In Progress" | "Resolved";

export type MaintenanceJob = {
  id: string;
  assetId: string;
  type: JobType;
  summary: string;
  reportedBy: string;
  priority: "Low" | "Medium" | "High";
  status: JobStatus;
  openedOn: string;
  closedOn?: string;
  resolution?: string;
};

export const assets: Asset[] = [
  { id: "eq1", tag: "VR-8890", name: "Vaccine Refrigerator (Haier HBC-260)", category: "Cold chain", location: "EPI room", status: "In service", commissionedOn: day(900), serviceIntervalDays: 90, lastServicedOn: day(104) },
  { id: "eq2", tag: "DB-1120", name: "Delivery Bed (hydraulic)", category: "Maternity", location: "Labour ward", status: "Under repair", commissionedOn: day(1200), serviceIntervalDays: 180, lastServicedOn: day(210) },
  { id: "eq3", tag: "SU-2201", name: "Suction Machine", category: "Maternity", location: "Labour ward", status: "In service", commissionedOn: day(700), serviceIntervalDays: 120, lastServicedOn: day(60) },
  { id: "eq4", tag: "GEN-05", name: "Standby Generator (10 kVA)", category: "Power", location: "Plant room", status: "In service", commissionedOn: day(1500), serviceIntervalDays: 30, lastServicedOn: day(41) },
  { id: "eq5", tag: "MIC-013", name: "Binocular Microscope", category: "Diagnostics", location: "Laboratory", status: "In service", commissionedOn: day(1100), serviceIntervalDays: 180, lastServicedOn: day(150) },
  { id: "eq6", tag: "CENT-04", name: "Haematocrit Centrifuge", category: "Diagnostics", location: "Laboratory", status: "In service", commissionedOn: day(820), serviceIntervalDays: 180, lastServicedOn: day(95) },
  { id: "eq7", tag: "BP-221", name: "Digital BP Monitor (adult)", category: "General", location: "Consulting room 2", status: "In service", commissionedOn: day(400), serviceIntervalDays: 365, lastServicedOn: day(300) },
  { id: "eq8", tag: "OXY-02", name: "Oxygen Concentrator (5 L)", category: "General", location: "Emergency bay", status: "Out of service", commissionedOn: day(600), serviceIntervalDays: 90, lastServicedOn: day(220) },
];

export const maintenanceJobs: MaintenanceJob[] = [
  { id: "j1", assetId: "eq2", type: "Corrective", summary: "Side rail loose, hydraulics leaking", reportedBy: "Nurse Grace Nwangbo", priority: "High", status: "In Progress", openedOn: day(3) },
  { id: "j2", assetId: "eq1", type: "Corrective", summary: "Temperature log shows 2 excursions above 8°C", reportedBy: "Folashade Adeniyi", priority: "High", status: "Open", openedOn: day(1) },
  { id: "j3", assetId: "eq8", type: "Corrective", summary: "Unit will not start — suspected compressor failure", reportedBy: "Samuel Etim", priority: "High", status: "Open", openedOn: day(9) },
  { id: "j4", assetId: "eq5", type: "Preventive", summary: "Quarterly clean, lamp check, calibration", reportedBy: "System (PM schedule)", priority: "Low", status: "Resolved", openedOn: day(155), closedOn: day(150), resolution: "Cleaned optics, replaced illuminator lamp" },
];
