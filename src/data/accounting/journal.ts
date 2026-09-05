// Journal entries — the formal double-entry record. Every financial event in
// Sabi Accounting (manual entry, invoice, payment, bill, expense, depreciation,
// payroll) becomes a balanced JournalEntry posted through useLedger.

export type JournalSource =
  | "Manual"
  | "Opening Balance"
  | "Invoice"
  | "Customer Payment"
  | "Credit Note"
  | "Bill"
  | "Vendor Payment"
  | "Vendor Credit"
  | "Expense"
  | "Bank Transaction"
  | "Depreciation"
  | "Payroll"
  | "Inventory"
  | "Tax"
  | "Reversal"
  | "FX Revaluation"
  | "Year-End Close";

export type JournalLine = {
  id: string;
  accountNumber: number;
  debit: number;
  credit: number;
  description?: string;
  // optional analytics dimensions
  costCenter?: string;
  customerId?: string;
  vendorId?: string;
};

export type JournalStatus = "Draft" | "Pending Approval" | "Posted" | "Reversed" | "Void";

export type JournalEntry = {
  id: string;
  number: string; // JE-YYYY-000001
  date: string; // ISO — the accounting/posting date
  source: JournalSource;
  reference?: string; // source document id / number
  memo: string;
  lines: JournalLine[];
  status: JournalStatus;
  createdBy: string; // staff id
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  reversedByEntryId?: string; // set on the original when a reversing entry is booked
  reversesEntryId?: string; // set on the reversing entry, points back to the original
  approvalRef?: string; // useApprovals reference when the entry needed sign-off
};

const line = (accountNumber: number, debit: number, credit: number, description?: string): JournalLine => ({
  id: `jl-${accountNumber}-${debit}-${credit}-${Math.random().toString(36).slice(2, 6)}`,
  accountNumber,
  debit,
  credit,
  description,
});

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

// Opening balances are represented as one real posted journal entry (Dr all
// debit-normal opening balances, Cr all credit-normal ones) so the trial balance
// ties out from a single source of truth rather than a magic per-account field.
export const OPENING_ENTRY_ID = "je-opening";

export const seedJournalEntries: JournalEntry[] = [
  {
    id: OPENING_ENTRY_ID,
    number: "JE-2026-000001",
    date: "2026-01-01T00:00:00.000Z",
    source: "Opening Balance",
    memo: "Opening balances brought forward as at 1 Jan 2026",
    status: "Posted",
    createdBy: "s1",
    createdAt: "2026-01-01T00:00:00.000Z",
    postedBy: "s1",
    postedAt: "2026-01-01T00:00:00.000Z",
    lines: [
      line(1000, 350_000, 0, "Cash on hand"),
      line(1010, 8_500_000, 0, "Bank current account"),
      line(1100, 1_300_000, 0, "Patient receivables b/f"),
      line(1200, 4_200_000, 0, "Drug inventory b/f"),
      line(1210, 900_000, 0, "Medical supplies b/f"),
      line(1500, 22_000_000, 0, "Property, plant & equipment"),
      line(1510, 9_500_000, 0, "Medical equipment"),
      line(1590, 0, 3_100_000, "Accumulated depreciation"),
      line(2000, 0, 1_850_000, "Trade payables b/f"),
      line(2300, 0, 420_000, "PAYE payable b/f"),
      line(2310, 0, 180_000, "Pension payable b/f"),
      line(2600, 0, 6_000_000, "Bank loan"),
      line(3000, 0, 35_200_000, "Owner's capital"),
    ],
  },
  {
    id: "je-seed-rent",
    number: "JE-2026-000002",
    date: daysAgo(20),
    source: "Manual",
    memo: "Quarterly rent — Q1 2026",
    status: "Posted",
    createdBy: "s1",
    createdAt: daysAgo(20),
    postedBy: "s1",
    postedAt: daysAgo(20),
    lines: [
      line(5200, 1_200_000, 0, "Facility rent"),
      line(1010, 0, 1_200_000, "Paid from current account"),
    ],
  },
  {
    id: "je-seed-cashsale",
    number: "JE-2026-000003",
    date: daysAgo(6),
    source: "Manual",
    memo: "Walk-in consultation & lab — cash takings 30 Aug",
    status: "Posted",
    createdBy: "s1",
    createdAt: daysAgo(6),
    postedBy: "s1",
    postedAt: daysAgo(6),
    lines: [
      line(1000, 185_000, 0, "Cash takings"),
      line(4000, 0, 120_000, "Consultations"),
      line(4010, 0, 65_000, "Lab tests"),
    ],
  },
];

export const seedFxRates: { code: string; name: string; symbol: string; rateToNgn: number }[] = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", rateToNgn: 1 },
  { code: "USD", name: "US Dollar", symbol: "$", rateToNgn: 1_580 },
  { code: "GBP", name: "Pound Sterling", symbol: "£", rateToNgn: 2_000 },
  { code: "EUR", name: "Euro", symbol: "€", rateToNgn: 1_700 },
];
