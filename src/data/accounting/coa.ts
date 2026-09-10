// Chart of Accounts — the backbone of Sabi Accounting.
//
// Mirrors the reference ERP's model: a numbered account with an account_type that
// drives its normal balance side and where it lands on the financial statements.
// The reference ships an 18-line starter chart (TenantProvisioningService::CHART);
// Sabi expands it into a realistic hospital chart on the same 1xxx–5xxx scheme.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs";

// Finer classification — used for Balance-Sheet / P&L grouping and for the few
// places that need to single out an account (cash for the cash-flow statement,
// AR/AP for aging, contra accounts for sign flips).
export type AccountSubtype =
  | "cash"
  | "bank"
  | "accounts_receivable"
  | "inventory"
  | "current_asset"
  | "fixed_asset"
  | "contra_asset"
  | "other_asset"
  | "accounts_payable"
  | "tax_payable"
  | "current_liability"
  | "long_term_liability"
  | "equity"
  | "retained_earnings"
  | "operating_revenue"
  | "other_income"
  | "contra_revenue"
  | "cost_of_goods_sold"
  | "operating_expense"
  | "payroll_expense"
  | "depreciation_expense"
  | "other_expense";

export type Account = {
  id: string;
  number: number;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  parentNumber?: number; // nesting, matches reference parent_id
  description?: string;
  isActive: boolean;
  allowManualEntry: boolean; // reference allow_manual_entry — control accounts (AR/AP/tax) are posted only by their subledger
  openingBalance: number; // signed in the account's normal-balance direction
  currency: string; // ISO code; most accounts are the reporting currency
  system?: boolean; // provisioned by Sabi, cannot be deleted
};

export const REPORTING_CURRENCY = "NGN";

export const normalBalanceOf = (t: AccountType, sub: AccountSubtype): "debit" | "credit" => {
  if (sub === "contra_asset") return "credit";
  if (sub === "contra_revenue") return "debit";
  return t === "asset" || t === "expense" || t === "cogs" ? "debit" : "credit";
};

export const isDebitNormal = (a: Pick<Account, "type" | "subtype">) =>
  normalBalanceOf(a.type, a.subtype) === "debit";

type Seed = [number, string, AccountType, AccountSubtype, number, (number | undefined)?];

// [number, name, type, subtype, openingBalance, parentNumber?]
const SEED: Seed[] = [
  // ---- Assets 1000–1999 ----
  [1000, "Cash on Hand", "asset", "cash", 350_000],
  [1010, "Bank — Current Account", "asset", "bank", 8_500_000],
  [1020, "Bank — Domiciliary (USD)", "asset", "bank", 0],
  [1090, "Undeposited Funds", "asset", "current_asset", 0],
  [1100, "Accounts Receivable — Patients", "asset", "accounts_receivable", 1_300_000],
  [1110, "Accounts Receivable — NHIS", "asset", "accounts_receivable", 0],
  [1120, "Accounts Receivable — HMOs", "asset", "accounts_receivable", 0],
  [1150, "Intercompany Receivable", "asset", "current_asset", 0],
  [1200, "Drug & Consumables Inventory", "asset", "inventory", 4_200_000],
  [1210, "Medical Supplies Inventory", "asset", "inventory", 900_000],
  [1300, "Prepaid Expenses", "asset", "current_asset", 0],
  [1400, "Staff Advances & Loans Receivable", "asset", "current_asset", 0],
  [1500, "Property, Plant & Equipment", "asset", "fixed_asset", 22_000_000],
  [1510, "Medical Equipment", "asset", "fixed_asset", 9_500_000],
  [1580, "Assets Under Construction", "asset", "fixed_asset", 0],
  [1590, "Accumulated Depreciation", "asset", "contra_asset", 3_100_000],

  // ---- Liabilities 2000–2999 ----
  [2000, "Accounts Payable — Trade", "liability", "accounts_payable", 1_850_000],
  [2100, "Accrued Expenses", "liability", "current_liability", 0],
  [2110, "Staff Reimbursements Payable", "liability", "current_liability", 0],
  [2120, "Salaries & Wages Payable", "liability", "current_liability", 0],
  [2150, "Intercompany Payable", "liability", "current_liability", 0],
  [2200, "VAT Payable", "liability", "tax_payable", 0],
  [2210, "Withholding Tax Payable", "liability", "tax_payable", 0],
  [2220, "Health Levy Payable", "liability", "tax_payable", 0],
  [2300, "PAYE Payable", "liability", "tax_payable", 420_000],
  [2310, "Pension Payable", "liability", "tax_payable", 180_000],
  [2320, "NHF Payable", "liability", "tax_payable", 0],
  [2400, "Deferred Revenue", "liability", "current_liability", 0],
  [2600, "Loans Payable", "liability", "long_term_liability", 6_000_000],

  // ---- Equity 3000–3999 ----
  [3000, "Owner's Capital", "equity", "equity", 35_200_000],
  [3100, "Drawings", "equity", "equity", 0],
  [3200, "Retained Earnings", "equity", "retained_earnings", 0],
  [3300, "Revaluation Reserve", "equity", "equity", 0],
  [3900, "Opening Balance Equity", "equity", "equity", 0],

  // ---- Revenue 4000–4999 ----
  [4000, "Consultation Revenue", "revenue", "operating_revenue", 0],
  [4010, "Laboratory Revenue", "revenue", "operating_revenue", 0],
  [4020, "Pharmacy Revenue", "revenue", "operating_revenue", 0],
  [4030, "Procedure & Theatre Revenue", "revenue", "operating_revenue", 0],
  [4040, "Admission & Bed Revenue", "revenue", "operating_revenue", 0],
  [4050, "Radiology & Imaging Revenue", "revenue", "operating_revenue", 0],
  [4100, "Other Income", "revenue", "other_income", 0],
  [4110, "Foreign Exchange Gain", "revenue", "other_income", 0],
  [4900, "Discounts & Waivers", "revenue", "contra_revenue", 0],

  // ---- Cost of goods sold 5000–5099 ----
  [5000, "Cost of Drugs Dispensed", "cogs", "cost_of_goods_sold", 0],
  [5010, "Cost of Medical Supplies Used", "cogs", "cost_of_goods_sold", 0],

  // ---- Operating expenses 5100–5999 ----
  [5100, "Salaries & Wages", "expense", "payroll_expense", 0],
  [5110, "Employer Pension Contribution", "expense", "payroll_expense", 0],
  [5120, "Staff Welfare & Training", "expense", "operating_expense", 0],
  [5200, "Rent", "expense", "operating_expense", 0],
  [5210, "Utilities — Power & Water", "expense", "operating_expense", 0],
  [5220, "Diesel & Generator Running", "expense", "operating_expense", 0],
  [5230, "Repairs & Maintenance", "expense", "operating_expense", 0],
  [5240, "Cleaning & Sanitation", "expense", "operating_expense", 0],
  [5250, "Medical Waste Disposal", "expense", "operating_expense", 0],
  [5300, "Office & Admin Supplies", "expense", "operating_expense", 0],
  [5310, "Telephone & Internet", "expense", "operating_expense", 0],
  [5400, "Professional Fees", "expense", "operating_expense", 0],
  [5500, "Depreciation Expense", "expense", "depreciation_expense", 0],
  [5520, "Impairment Loss", "expense", "other_expense", 0],
  [5600, "Bank Charges", "expense", "other_expense", 0],
  [5610, "Foreign Exchange Loss", "expense", "other_expense", 0],
  [5700, "Bad Debt Expense", "expense", "other_expense", 0],
  [5900, "Miscellaneous Expense", "expense", "other_expense", 0],
];

// Control accounts posted only by their subledger, never by hand.
const CONTROL_SUBTYPES: AccountSubtype[] = ["accounts_receivable", "accounts_payable", "inventory", "contra_asset"];

export const seedAccounts: Account[] = SEED.map(([number, name, type, subtype, opening, parentNumber]) => ({
  id: `acct-${number}`,
  number,
  name,
  type,
  subtype,
  parentNumber,
  isActive: true,
  allowManualEntry: !CONTROL_SUBTYPES.includes(subtype),
  openingBalance: opening,
  currency: REPORTING_CURRENCY,
  system: true,
}));

// Well-known account numbers the posting services resolve by (mirrors the
// reference's resolveByNumber(1100) / (4000) / (1000) pattern).
export const ACCT = {
  cashOnHand: 1000,
  bank: 1010,
  undepositedFunds: 1090,
  arPatients: 1100,
  arNhis: 1110,
  arHmo: 1120,
  intercompanyReceivable: 1150,
  intercompanyPayable: 2150,
  drugInventory: 1200,
  suppliesInventory: 1210,
  prepaid: 1300,
  staffAdvances: 1400,
  ppe: 1500,
  medicalEquipment: 1510,
  assetsUnderConstruction: 1580,
  accumDepreciation: 1590,
  revaluationReserve: 3300,
  impairmentLoss: 5520,
  apTrade: 2000,
  accruals: 2100,
  reimbursementsPayable: 2110,
  salariesPayable: 2120,
  vatPayable: 2200,
  whtPayable: 2210,
  payePayable: 2300,
  pensionPayable: 2310,
  nhfPayable: 2320,
  deferredRevenue: 2400,
  loansPayable: 2600,
  ownersCapital: 3000,
  drawings: 3100,
  retainedEarnings: 3200,
  openingBalanceEquity: 3900,
  consultationRevenue: 4000,
  laboratoryRevenue: 4010,
  pharmacyRevenue: 4020,
  procedureRevenue: 4030,
  admissionRevenue: 4040,
  radiologyRevenue: 4050,
  otherIncome: 4100,
  fxGain: 4110,
  discountsWaivers: 4900,
  cogsDrugs: 5000,
  cogsSupplies: 5010,
  salaries: 5100,
  employerPension: 5110,
  depreciationExpense: 5500,
  bankCharges: 5600,
  fxLoss: 5610,
  badDebt: 5700,
  miscExpense: 5900,
} as const;
