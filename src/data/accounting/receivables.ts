// Accounts Receivable domain — Customers and the sales document chain:
//   Estimate → Sales Order → Invoice → Customer Receipt (with allocations)
//   Credit Notes (apply to an invoice, or refund)
//
// Mirrors the reference's Customer / Estimate / SalesOrder / Invoice / Payment /
// CreditMemo(+Application) models, adapted for a hospital's payer mix.

export type CustomerType = "Patient" | "NHIS" | "HMO" | "Corporate" | "Walk-in";

export type Customer = {
  id: string;
  name: string;
  type: CustomerType;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  arAccountNumber: number; // 1100 patients / 1110 NHIS / 1120 HMO
  currency?: string; // default invoicing currency (ISO); NGN when unset
  paymentTermsDays: number; // net days (fallback when no paymentTermId)
  paymentTermId?: string; // B4 — managed payment term
  creditLimit: number;
  creditHold: boolean;
  openingBalance: number;
  createdAt: string;
  patientId?: string; // link back to an EMR patient when created from the bridge
};

export type SalesLine = {
  id: string;
  accountNumber: number; // revenue account
  description: string;
  qty: number;
  unitPrice: number;
  taxRateId?: string;
};

export type SalesDocStatus =
  | "Draft"
  | "Sent"
  | "Accepted"
  | "Declined"
  | "Expired"
  | "Converted"
  | "Confirmed"
  | "Cancelled"
  | "Open"
  | "Partially Paid"
  | "Paid"
  | "Overdue"
  | "Void";

export type Estimate = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  expiryDate: string;
  lines: SalesLine[];
  notes?: string;
  status: Extract<SalesDocStatus, "Draft" | "Sent" | "Accepted" | "Declined" | "Expired" | "Converted">;
  convertedToOrderId?: string;
  convertedToInvoiceId?: string;
  createdBy: string;
  createdAt: string;
};

export type SalesOrder = {
  id: string;
  number: string;
  customerId: string;
  estimateId?: string;
  date: string;
  lines: SalesLine[];
  notes?: string;
  status: Extract<SalesDocStatus, "Draft" | "Confirmed" | "Cancelled" | "Converted">;
  invoiceId?: string;
  createdBy: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  salesOrderId?: string;
  date: string;
  dueDate: string;
  lines: SalesLine[];
  notes?: string;
  status: Extract<SalesDocStatus, "Draft" | "Open" | "Partially Paid" | "Paid" | "Overdue" | "Void">;
  journalEntryId?: string;
  amountPaid: number; // in the invoice's currency — cash receipts + credit-note applications
  currency: string; // ISO — the currency the document is denominated in
  exchangeRate: number; // NGN per unit of currency, at booking (revalued in place by an FX revaluation)
  createdBy: string;
  createdAt: string;
  issuedAt?: string;
  source?: "Manual" | "EMR Billing";
  emrInvoiceId?: string;
  isRecurring?: boolean;
  recurrenceEveryMonths?: number;
  recurrenceNextDate?: string;
  recurrenceEndDate?: string;
  recurringTemplate?: boolean; // this row is a template, not a live invoice
  revenueScheduleId?: string;
};

export type RevenueScheduleEntry = { id: string; period: string; amount: number; recognized: boolean; recognizedAt?: string; journalEntryId?: string };

export type RevenueSchedule = {
  id: string;
  invoiceId: string;
  customerId: string;
  totalAmount: number; // NGN
  method: "Straight Line";
  startPeriod: string; // YYYY-MM
  months: number;
  deferredAccountNumber: number; // 2400
  revenueAccountNumber: number;
  entries: RevenueScheduleEntry[];
  createdAt: string;
};

export type ReceiptAllocation = { invoiceId: string; amount: number; discount?: number };

export type CustomerReceipt = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  method: "Cash" | "Bank Transfer" | "POS" | "Cheque" | "NHIS Remittance";
  depositAccountNumber: number; // 1000 cash / 1010 bank / 1090 undeposited
  amount: number; // NGN reaching the bank
  allocations: ReceiptAllocation[]; // amounts in each invoice's own currency
  settlementRate?: number; // NGN per FX unit on the day of settlement (foreign receipts)
  reference?: string;
  notes?: string;
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
};

export type CreditNoteApplication = { invoiceId: string; amount: number; date: string };

export type CreditNote = {
  id: string;
  number: string;
  customerId: string;
  invoiceId?: string; // originating invoice, optional
  date: string;
  lines: SalesLine[];
  reason: string;
  notes?: string;
  status: "Open" | "Partially Applied" | "Applied" | "Refunded" | "Void";
  applications: CreditNoteApplication[];
  refundedAmount: number;
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
};

// ---- B1 Sales Receipt: over-the-counter sale, settled immediately, no invoice/AR ----
export type SalesReceipt = {
  id: string;
  number: string;
  customerId?: string; // optional — walk-in cash sales need no customer
  customerName?: string; // free-text when no customer record
  date: string;
  method: "Cash" | "Bank Transfer" | "POS" | "Cheque";
  depositAccountNumber: number;
  lines: SalesLine[];
  notes?: string;
  status: "Completed" | "Void";
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
};

// ---- B2 Refund Receipt: money paid back to a customer for returned services / overpayment ----
export type RefundReceipt = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  method: "Cash" | "Bank Transfer" | "POS" | "Cheque";
  fromAccountNumber: number; // cash/bank the refund is paid from
  lines: SalesLine[]; // what is being refunded (revenue accounts get debited)
  reason: string;
  notes?: string;
  status: "Completed" | "Void";
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
};

// ---- B3 Delayed Charge: billable item parked against a customer, no GL until invoiced ----
export type DelayedCharge = {
  id: string;
  customerId: string;
  date: string;
  accountNumber: number;
  description: string;
  qty: number;
  unitPrice: number;
  taxRateId?: string;
  status: "Unbilled" | "Invoiced";
  invoiceId?: string;
  createdBy: string;
  createdAt: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5).toISOString();

export const seedCustomers: Customer[] = [
  { id: "cust-hygeia", name: "Hygeia HMO", type: "HMO", email: "claims@hygeia.example", phone: "+234 1 462 0000", city: "Lagos", arAccountNumber: 1120, paymentTermsDays: 45, paymentTermId: "pt-net45", creditLimit: 20_000_000, creditHold: false, openingBalance: 0, createdAt: daysAgo(300) },
  { id: "cust-avon", name: "Avon HMO", type: "HMO", email: "providers@avonhealthcare.example", city: "Lagos", arAccountNumber: 1120, paymentTermsDays: 45, paymentTermId: "pt-net45", creditLimit: 15_000_000, creditHold: false, openingBalance: 0, createdAt: daysAgo(280) },
  { id: "cust-nhis", name: "NHIS — National Scheme", type: "NHIS", email: "capitation@nhis.example", city: "Abuja", arAccountNumber: 1110, paymentTermsDays: 60, paymentTermId: "pt-net60", creditLimit: 50_000_000, creditHold: false, openingBalance: 0, createdAt: daysAgo(365) },
  { id: "cust-dangote", name: "Dangote Cement Plc (Staff Scheme)", type: "Corporate", email: "hr.medicals@dangote.example", city: "Lagos", arAccountNumber: 1100, paymentTermsDays: 30, paymentTermId: "pt-2-10-30", creditLimit: 8_000_000, creditHold: false, openingBalance: 1_300_000, createdAt: daysAgo(200) },
  { id: "cust-walkin", name: "Walk-in Patients", type: "Walk-in", arAccountNumber: 1100, paymentTermsDays: 0, creditLimit: 0, creditHold: false, openingBalance: 0, createdAt: daysAgo(365) },
  { id: "cust-mercy", name: "Mercy Ships (Referral Partner)", type: "Corporate", email: "referrals@mercyships.example", city: "Cotonou", arAccountNumber: 1100, currency: "USD", paymentTermsDays: 30, creditLimit: 60_000, creditHold: false, openingBalance: 0, createdAt: daysAgo(120) },
];

const svc = (accountNumber: number, description: string, qty: number, unitPrice: number, taxRateId = "tax-vat-exempt"): SalesLine => ({
  id: `sl-${Math.random().toString(36).slice(2, 7)}`,
  accountNumber,
  description,
  qty,
  unitPrice,
  taxRateId,
});

export const seedInvoices: Invoice[] = [
  {
    id: "inv-1001",
    number: "INV-2026-001001",
    customerId: "cust-hygeia",
    date: daysAgo(38),
    dueDate: daysAgo(-7),
    lines: [svc(4000, "Consultations — July enrollees", 42, 15_000), svc(4010, "Laboratory investigations", 1, 640_000), svc(4020, "Pharmacy dispensing", 1, 380_000)],
    status: "Partially Paid",
    journalEntryId: undefined,
    amountPaid: 800_000,
    currency: "NGN",
    exchangeRate: 1,
    createdBy: "s1",
    createdAt: daysAgo(38),
    issuedAt: daysAgo(38),
    source: "Manual",
  },
  {
    id: "inv-1002",
    number: "INV-2026-001002",
    customerId: "cust-dangote",
    date: daysAgo(15),
    dueDate: daysAhead(15),
    lines: [svc(4000, "Executive medicals — 12 staff", 12, 45_000), svc(4050, "Chest X-ray & ECG", 12, 18_000)],
    status: "Open",
    amountPaid: 0,
    currency: "NGN",
    exchangeRate: 1,
    createdBy: "s1",
    createdAt: daysAgo(15),
    issuedAt: daysAgo(15),
    source: "Manual",
  },
  {
    id: "inv-1003",
    number: "INV-2026-001003",
    customerId: "cust-avon",
    date: daysAgo(72),
    dueDate: daysAgo(27),
    lines: [svc(4040, "Admission & bed — 3 enrollees", 1, 520_000), svc(4030, "Minor procedures", 1, 240_000)],
    status: "Overdue",
    amountPaid: 0,
    currency: "NGN",
    exchangeRate: 1,
    createdBy: "s1",
    createdAt: daysAgo(72),
    issuedAt: daysAgo(72),
    source: "Manual",
  },
  {
    id: "inv-1005",
    number: "INV-2026-001005",
    customerId: "cust-mercy",
    date: daysAgo(18),
    dueDate: daysAhead(12),
    lines: [svc(4030, "Reconstructive surgery — referral package", 1, 8_000, "tax-vat-exempt"), svc(4040, "Post-op admission (5 nights)", 5, 400, "tax-vat-exempt")],
    status: "Open",
    amountPaid: 0,
    currency: "USD",
    exchangeRate: 1_540, // booked when USD was 1,540
    createdBy: "s1",
    createdAt: daysAgo(18),
    issuedAt: daysAgo(18),
    source: "Manual",
  },
];

export const seedReceipts: CustomerReceipt[] = [
  {
    id: "rcpt-2001",
    number: "RCT-2026-002001",
    customerId: "cust-hygeia",
    date: daysAgo(10),
    method: "Bank Transfer",
    depositAccountNumber: 1010,
    amount: 800_000,
    allocations: [{ invoiceId: "inv-1001", amount: 800_000 }],
    reference: "HYG/REMIT/0782",
    createdBy: "s1",
    createdAt: daysAgo(10),
  },
];

export const seedEstimates: Estimate[] = [
  {
    id: "est-3001",
    number: "EST-2026-003001",
    customerId: "cust-dangote",
    date: daysAgo(5),
    expiryDate: daysAhead(25),
    lines: [svc(4000, "Annual staff medicals — 60 staff", 60, 42_000), svc(4010, "Baseline lab panel", 60, 12_000)],
    notes: "Volume rate agreed with HR.",
    status: "Sent",
    createdBy: "s1",
    createdAt: daysAgo(5),
  },
];

export const seedSalesOrders: SalesOrder[] = [];
export const seedCreditNotes: CreditNote[] = [];
export const seedRevenueSchedules: RevenueSchedule[] = [];

export const seedSalesReceipts: SalesReceipt[] = [
  {
    id: "srct-9001",
    number: "SR-2026-009001",
    customerName: "Walk-in — Mrs Adebayo",
    date: daysAgo(4),
    method: "POS",
    depositAccountNumber: 1010,
    lines: [svc(4000, "GP consultation", 1, 15_000), svc(4020, "Amoxicillin + Paracetamol", 1, 4_500)],
    status: "Completed",
    createdBy: "s1",
    createdAt: daysAgo(4),
  },
];

export const seedRefundReceipts: RefundReceipt[] = [];

export const seedDelayedCharges: DelayedCharge[] = [
  { id: "dc-8001", customerId: "cust-dangote", date: daysAgo(6), accountNumber: 4050, description: "Ad-hoc ECG — night shift supervisor", qty: 1, unitPrice: 18_000, taxRateId: "tax-vat-exempt", status: "Unbilled", createdBy: "s1", createdAt: daysAgo(6) },
  { id: "dc-8002", customerId: "cust-dangote", date: daysAgo(3), accountNumber: 4010, description: "Urgent malaria RDT x2", qty: 2, unitPrice: 3_500, taxRateId: "tax-vat-exempt", status: "Unbilled", createdBy: "s1", createdAt: daysAgo(3) },
];

// dunning ladder now lives in useAccountingSettings.reminderRules (B6, editable)
export type InvoiceReminder = { invoiceId: string; level: number; tone: string; sentAt: string; sentBy: string };
export const seedReminders: InvoiceReminder[] = [];
