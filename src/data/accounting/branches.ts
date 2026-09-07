// Branches / operating entities and consolidation groups.
//
// Reference: Company (multi-entity), ConsolidationGroup + ConsolidationService,
// FinancialStatementService::withTeam(). Sabi tags every journal entry with a
// branchId; statements can be produced per branch, or consolidated across a
// group with intercompany balances eliminated.

export type Branch = {
  id: string;
  code: string;
  name: string;
  isHeadOffice: boolean;
  baseCurrency: string;
  active: boolean;
};

export type ConsolidationGroup = {
  id: string;
  name: string;
  branchIds: string[];
  /** account-number pairs that net out on consolidation (due-to / due-from) */
  eliminate: { receivable: number; payable: number }[];
};

export const seedBranches: Branch[] = [
  { id: "br-ho", code: "HO", name: "Sabi Health Post — Head Office", isHeadOffice: true, baseCurrency: "NGN", active: true },
  { id: "br-ikorodu", code: "IKR", name: "Sabi Clinic — Ikorodu", isHeadOffice: false, baseCurrency: "NGN", active: true },
  { id: "br-epe", code: "EPE", name: "Sabi Clinic — Epe", isHeadOffice: false, baseCurrency: "NGN", active: true },
];

export const DEFAULT_BRANCH = "br-ho";

export const seedConsolidationGroups: ConsolidationGroup[] = [
  {
    id: "cg-all",
    name: "Sabi Health Group (all entities)",
    branchIds: ["br-ho", "br-ikorodu", "br-epe"],
    eliminate: [{ receivable: 1150, payable: 2150 }],
  },
];
