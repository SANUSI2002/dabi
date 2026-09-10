// B15 — Chart-of-accounts templates. The reference ships one starter chart via
// TenantProvisioningService; Sabi offers a few industry templates that the
// Setup Wizard (B14) or Chart of Accounts page can apply — any account in the
// template that isn't already in the ledger is added (existing accounts and
// their balances are left alone).

import type { AccountType, AccountSubtype } from "./coa";

export type TemplateAccount = { number: number; name: string; type: AccountType; subtype: AccountSubtype; parentNumber?: number };

export type CoaTemplate = {
  id: string;
  name: string;
  industry: string;
  description: string;
  accounts: TemplateAccount[];
};

const a = (number: number, name: string, type: AccountType, subtype: AccountSubtype, parentNumber?: number): TemplateAccount => ({ number, name, type, subtype, parentNumber });

export const coaTemplates: CoaTemplate[] = [
  {
    id: "tmpl-hospital-ng",
    name: "Hospital / Clinic (Nigeria)",
    industry: "Healthcare",
    description: "Payer-mix receivables (NHIS / HMO / patient), pharmacy & consumables inventory, clinical service revenue lines, WHT/PAYE/pension payables. This is the chart Sabi ships with.",
    accounts: [
      a(1100, "Accounts Receivable — Patients", "asset", "accounts_receivable"),
      a(1110, "Accounts Receivable — NHIS", "asset", "accounts_receivable"),
      a(1120, "Accounts Receivable — HMO", "asset", "accounts_receivable"),
      a(1200, "Drug Inventory", "asset", "inventory"),
      a(1210, "Medical Supplies Inventory", "asset", "inventory"),
      a(2300, "PAYE Payable", "liability", "tax_payable"),
      a(2310, "Pension Payable", "liability", "current_liability"),
      a(4000, "Consultation Revenue", "revenue", "operating_revenue"),
      a(4010, "Laboratory Revenue", "revenue", "operating_revenue"),
      a(4020, "Pharmacy Revenue", "revenue", "operating_revenue"),
      a(5000, "Cost of Drugs Dispensed", "cogs", "cost_of_goods_sold"),
    ],
  },
  {
    id: "tmpl-general",
    name: "General Business",
    industry: "General trade & services",
    description: "A plain services/trading chart — trade debtors and creditors, sales and purchases, standard overhead expense lines.",
    accounts: [
      a(1000, "Cash on Hand", "asset", "cash"),
      a(1010, "Bank — Current Account", "asset", "bank"),
      a(1100, "Trade Debtors", "asset", "accounts_receivable"),
      a(1200, "Stock / Inventory", "asset", "inventory"),
      a(1500, "Property, Plant & Equipment", "asset", "fixed_asset"),
      a(1590, "Accumulated Depreciation", "asset", "contra_asset"),
      a(2000, "Trade Creditors", "liability", "accounts_payable"),
      a(2200, "VAT Payable", "liability", "tax_payable"),
      a(2600, "Bank Loan", "liability", "long_term_liability"),
      a(3000, "Owner's Capital", "equity", "equity"),
      a(3200, "Retained Earnings", "equity", "retained_earnings"),
      a(4000, "Sales Revenue", "revenue", "operating_revenue"),
      a(4100, "Other Income", "revenue", "other_income"),
      a(5000, "Cost of Sales", "cogs", "cost_of_goods_sold"),
      a(5100, "Salaries & Wages", "expense", "payroll_expense"),
      a(5200, "Rent", "expense", "operating_expense"),
      a(5300, "Utilities", "expense", "operating_expense"),
      a(5500, "Depreciation Expense", "expense", "depreciation_expense"),
    ],
  },
  {
    id: "tmpl-ngo",
    name: "NGO / Non-profit",
    industry: "Non-profit",
    description: "Fund-accounting flavour — grant & donation income, restricted vs unrestricted funds, programme vs support-cost expense lines.",
    accounts: [
      a(1000, "Cash on Hand", "asset", "cash"),
      a(1010, "Bank — Operating", "asset", "bank"),
      a(1030, "Bank — Restricted Grants", "asset", "bank"),
      a(1100, "Grants Receivable", "asset", "accounts_receivable"),
      a(2000, "Accounts Payable", "liability", "accounts_payable"),
      a(2500, "Deferred Grant Income", "liability", "current_liability"),
      a(3100, "Unrestricted Funds", "equity", "equity"),
      a(3110, "Restricted Funds", "equity", "equity"),
      a(4200, "Grant Income", "revenue", "operating_revenue"),
      a(4210, "Donations & Appeals", "revenue", "operating_revenue"),
      a(4220, "Fundraising Events", "revenue", "other_income"),
      a(5600, "Programme Costs", "expense", "operating_expense"),
      a(5610, "Support & Governance Costs", "expense", "operating_expense"),
      a(5620, "Fundraising Costs", "expense", "operating_expense"),
    ],
  },
];
