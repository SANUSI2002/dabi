// Company / IT assets assigned to staff — distinct from the clinical Equipment
// register (src/data/assets.ts + useAssets), which tracks medical devices.

const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export type CompanyAssetStatus = "Available" | "In Use" | "Not Available" | "Expired";

export type AssetCategory = {
  id: string;
  name: string;
  description: string;
};

export type CompanyAsset = {
  id: string;
  name: string;
  categoryId: string;
  batchNo?: string;
  trackingId: string;
  purchaseDate: string;
  purchaseCost: number;
  status: CompanyAssetStatus;
  expiryDate?: string;
};

export type AssetAllocation = {
  id: string;
  assetId: string;
  employeeId: string;
  assignedDate: string;
  returnDate?: string;
  returnCondition?: "Good" | "Damaged" | "Lost";
  returnNote?: string;
};

export type AssetRequestStatus = "Requested" | "Approved" | "Rejected" | "Allocated";
export type AssetRequest = {
  id: string;
  employeeId: string;
  categoryId: string;
  description: string;
  requestedDate: string;
  status: AssetRequestStatus;
};

export const categories: AssetCategory[] = [
  { id: "ac1", name: "IT Equipment", description: "Laptops, tablets, phones" },
  { id: "ac2", name: "ID & Access", description: "ID badges, access fobs" },
  { id: "ac3", name: "Uniforms & PPE", description: "Scrubs, lab coats, PPE issue" },
  { id: "ac4", name: "Field Kits", description: "CHW outreach bags, BP monitors, cold boxes" },
  { id: "ac5", name: "Vehicles", description: "Ambulance, outreach van" },
];

export const assets: CompanyAsset[] = [
  { id: "ca1", name: "Dell Latitude Laptop", categoryId: "ac1", batchNo: "IT-2025-A", trackingId: "IT-0001", purchaseDate: day(500), purchaseCost: 350000, status: "In Use" },
  { id: "ca2", name: "Dell Latitude Laptop", categoryId: "ac1", batchNo: "IT-2025-A", trackingId: "IT-0002", purchaseDate: day(500), purchaseCost: 350000, status: "Available" },
  { id: "ca3", name: "Facility ID Badge", categoryId: "ac2", trackingId: "ID-0014", purchaseDate: day(400), purchaseCost: 1500, status: "In Use" },
  { id: "ca4", name: "Outreach Field Kit", categoryId: "ac4", trackingId: "FK-0003", purchaseDate: day(300), purchaseCost: 45000, status: "In Use" },
  { id: "ca5", name: "Outreach Van", categoryId: "ac5", trackingId: "VH-0001", purchaseDate: day(900), purchaseCost: 4500000, status: "In Use" },
];

export const allocations: AssetAllocation[] = [
  { id: "al1", assetId: "ca1", employeeId: "s6", assignedDate: day(60) },
  { id: "al2", assetId: "ca3", employeeId: "s2", assignedDate: day(300) },
  { id: "al3", assetId: "ca4", employeeId: "s5", assignedDate: day(120) },
  { id: "al4", assetId: "ca5", employeeId: "s5", assignedDate: day(200) },
];

export const requests: AssetRequest[] = [
  { id: "rq1", employeeId: "s7", categoryId: "ac1", description: "Laptop for lab result data-entry", requestedDate: day(3), status: "Requested" },
];
