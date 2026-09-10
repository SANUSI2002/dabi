// Tax rates — applied per line on invoices, bills, estimates, expenses.
// Reference: TaxRate { name, rate, description, is_compound, is_active }.
// Sabi seeds a Nigerian set (VAT 7.5%, WHT bands, exempt/zero-rated).

export type TaxKind = "VAT" | "WHT" | "Exempt" | "Zero-rated";

export type TaxRate = {
  id: string;
  name: string;
  kind: TaxKind;
  rate: number; // percent
  description?: string;
  /** liability account the tax posts to (VAT Payable / WHT Payable) */
  accountNumber: number;
  isCompound: boolean;
  isActive: boolean;
};

export type TaxReturnStatus = "Open" | "Filed" | "Paid";
export type ReturnType = "VAT" | "WHT" | "PAYE";

export type TaxReturn = {
  id: string;
  reference: string; // VAT-2026-08
  kind: TaxKind;
  returnType: ReturnType;
  authority: "FIRS" | "State IRS";
  liabilityAccount: number;
  periodStart: string;
  periodEnd: string;
  outputTax: number; // collected / withheld
  inputTax: number; // reclaimable (VAT only)
  netPayable: number;
  status: TaxReturnStatus;
  submissionRef?: string; // e-filing acknowledgement
  filedVia?: string;
  filedAt?: string;
  paidAt?: string;
  journalEntryId?: string;
};

export const seedTaxRates: TaxRate[] = [
  { id: "tax-vat-standard", name: "VAT 7.5%", kind: "VAT", rate: 7.5, accountNumber: 2200, isCompound: false, isActive: true, description: "Standard Nigerian VAT" },
  { id: "tax-vat-exempt", name: "VAT Exempt", kind: "Exempt", rate: 0, accountNumber: 2200, isCompound: false, isActive: true, description: "Medical services exempt from VAT" },
  { id: "tax-vat-zero", name: "Zero-rated", kind: "Zero-rated", rate: 0, accountNumber: 2200, isCompound: false, isActive: true },
  { id: "tax-wht-5", name: "WHT 5%", kind: "WHT", rate: 5, accountNumber: 2210, isCompound: false, isActive: true, description: "Withholding tax — goods/rent" },
  { id: "tax-wht-10", name: "WHT 10%", kind: "WHT", rate: 10, accountNumber: 2210, isCompound: false, isActive: true, description: "Withholding tax — professional services" },
  { id: "tax-levy-1", name: "NHIS Levy 1%", kind: "VAT", rate: 1, accountNumber: 2220, isCompound: false, isActive: true, description: "Statutory health levy on non-exempt services — stacks on top of VAT" },
];

export const DEFAULT_SALES_TAX = "tax-vat-exempt"; // hospital services are largely exempt
export const seedTaxReturns: TaxReturn[] = [];
