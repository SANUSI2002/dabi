// Fixed Assets — register, depreciation runs, disposal.
// Reference: Asset, AssetAcquisition, DepreciationCalculation with straight-line
// and reducing-balance methods. Depreciation posts Dr Depreciation Expense /
// Cr Accumulated Depreciation; disposal clears cost + accumulated depreciation
// and books the gain or loss.

export type DepreciationMethod = "Straight Line" | "Reducing Balance";
export type AssetStatus = "Active" | "Fully Depreciated" | "Disposed" | "Under Construction" | "Impaired";

export type FixedAsset = {
  id: string;
  tag: string; // FA-0001
  name: string;
  category: string;
  acquisitionDate: string;
  cost: number;
  assetAccountNumber: number; // 1500 / 1510
  method: DepreciationMethod;
  usefulLifeMonths: number;
  salvageValue: number;
  reducingRateAnnual?: number; // % — only for Reducing Balance
  accumulatedDepreciation: number;
  status: AssetStatus;
  sourceBillId?: string;
  disposalDate?: string;
  disposalProceeds?: number;
  lastDepreciatedPeriod?: string; // YYYY-MM
  revaluationReserve?: number; // B28 — cumulative upward revaluation held in equity
  impairmentLoss?: number; // B28 — cumulative impairment charged to P&L
  cwipSpend?: number; // B28 — costs accumulated while Under Construction
  createdAt: string;
};

export type AssetRevaluation = {
  id: string;
  assetId: string;
  date: string;
  kind: "Revaluation" | "Impairment" | "Reversal";
  carryingBefore: number;
  carryingAfter: number;
  delta: number; // + up, - down
  note?: string;
  journalEntryId?: string;
  by: string;
};

export type DepreciationRunEntry = { assetId: string; amount: number; nbvBefore: number; nbvAfter: number };

export type DepreciationRun = {
  id: string;
  period: string; // YYYY-MM
  runDate: string;
  entries: DepreciationRunEntry[];
  total: number;
  journalEntryId?: string;
  runBy: string;
};

const yearsAgo = (n: number) => new Date(Date.now() - n * 365 * 864e5).toISOString();
const monthsAgo = (n: number) => new Date(Date.now() - n * 30 * 864e5).toISOString();

// Costs sum to the opening PPE (1500 = 22,000,000) and Medical Equipment
// (1510 = 9,500,000); accumulated depreciation sums to opening 1590 (3,100,000).
export const seedFixedAssets: FixedAsset[] = [
  { id: "fa-1", tag: "FA-0001", name: "Building improvements & fit-out", category: "Buildings", acquisitionDate: yearsAgo(4), cost: 15_000_000, assetAccountNumber: 1500, method: "Straight Line", usefulLifeMonths: 240, salvageValue: 0, accumulatedDepreciation: 1_800_000, status: "Active", lastDepreciatedPeriod: "2026-08", createdAt: yearsAgo(4) },
  { id: "fa-2", tag: "FA-0002", name: "Generator — 40 kVA Perkins", category: "Plant & Machinery", acquisitionDate: yearsAgo(3), cost: 4_200_000, assetAccountNumber: 1500, method: "Reducing Balance", usefulLifeMonths: 96, salvageValue: 400_000, reducingRateAnnual: 20, accumulatedDepreciation: 700_000, status: "Active", lastDepreciatedPeriod: "2026-08", createdAt: yearsAgo(3) },
  { id: "fa-3", tag: "FA-0003", name: "Furniture & fittings", category: "Furniture", acquisitionDate: yearsAgo(3), cost: 2_800_000, assetAccountNumber: 1500, method: "Straight Line", usefulLifeMonths: 60, salvageValue: 200_000, accumulatedDepreciation: 600_000, status: "Active", lastDepreciatedPeriod: "2026-08", createdAt: yearsAgo(3) },
  { id: "fa-4", tag: "FA-0004", name: "Ultrasound scanner — Mindray DC-40", category: "Medical Equipment", acquisitionDate: monthsAgo(8), cost: 5_500_000, assetAccountNumber: 1510, method: "Straight Line", usefulLifeMonths: 84, salvageValue: 500_000, accumulatedDepreciation: 0, status: "Active", createdAt: monthsAgo(8) },
  { id: "fa-5", tag: "FA-0005", name: "Chemistry analyser — Mindray BS-240", category: "Medical Equipment", acquisitionDate: monthsAgo(5), cost: 4_000_000, assetAccountNumber: 1510, method: "Straight Line", usefulLifeMonths: 84, salvageValue: 400_000, accumulatedDepreciation: 0, status: "Active", createdAt: monthsAgo(5) },
];

export const seedDepreciationRuns: DepreciationRun[] = [];
export const seedAssetRevaluations: AssetRevaluation[] = [];
