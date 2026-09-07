// Banking — bank account metadata, statement lines, reconciliation, transfers.
//
// Reference: BankAccount is an Account row of type 'bank'; BankStatement +
// BankFeedTransaction feed a reconciliation against Transaction.reconciled, with
// ReconciliationRule for auto-matching. Sabi keeps the GL bank account as the
// source of truth and layers statement lines + a reconciliation record on top.

export type BankAccountMeta = {
  id: string;
  accountNumber: number; // links to the GL account (subtype bank/cash)
  bankName: string;
  accountName: string;
  accountNo: string; // masked
  currency: string;
  sortCode?: string;
  active: boolean;
};

export type BankStatementLine = {
  id: string;
  accountNumber: number;
  date: string;
  description: string;
  amount: number; // signed: + money in, - money out
  reference?: string;
  reconciled: boolean;
  matchedJournalEntryId?: string;
  importedAt: string;
  origin?: "import" | "feed";
  ruleApplied?: string; // reconciliation rule id that auto-cleared it
};

export type BankConnection = {
  id: string;
  accountNumber: number;
  provider: "Mono" | "Okra" | "Stitch" | "Manual";
  institution: string;
  status: "Connected" | "Disconnected" | "Error";
  connectedAt: string;
  lastSyncAt?: string;
  cursor: number; // how many synthetic feed rows already delivered
};

export type ReconciliationRule = {
  id: string;
  accountNumber: number;
  name: string;
  descriptionContains?: string;
  direction?: "in" | "out";
  contraAccount: number; // where the auto-posted contra lands
  memo?: string;
  active: boolean;
};

export type BankReconciliation = {
  id: string;
  accountNumber: number;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  status: "In Progress" | "Reconciled";
  reconciledLineIds: string[];
  completedAt?: string;
  completedBy?: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const seedBankAccounts: BankAccountMeta[] = [
  { id: "bank-current", accountNumber: 1010, bankName: "GTBank", accountName: "Sabi Health Post — Current", accountNo: "••••4471", currency: "NGN", sortCode: "058", active: true },
  { id: "bank-domiciliary", accountNumber: 1020, bankName: "GTBank", accountName: "Sabi Health Post — USD Dom", accountNo: "••••9902", currency: "USD", sortCode: "058", active: true },
  { id: "bank-cash", accountNumber: 1000, bankName: "Cash", accountName: "Petty Cash & Front Desk Till", accountNo: "—", currency: "NGN", active: true },
];

// A few unreconciled statement lines on the current account: some match GL
// activity (patient receipt, vendor payment), one is bank-only (charges).
export const seedStatementLines: BankStatementLine[] = [
  { id: "stmt-1", accountNumber: 1010, date: daysAgo(10), description: "TRF FRM HYGEIA HMO — HYG/REMIT/0782", amount: 800_000, reference: "HYG/REMIT/0782", reconciled: false, importedAt: daysAgo(2) },
  { id: "stmt-2", accountNumber: 1010, date: daysAgo(20), description: "NIP TRF TO MEDREED DIAGNOSTIC — NIP/883201", amount: -200_000, reference: "NIP/883201", reconciled: false, importedAt: daysAgo(2) },
  { id: "stmt-3", accountNumber: 1010, date: daysAgo(20), description: "QUARTERLY RENT — CHEQUE 100231", amount: -1_200_000, reconciled: false, importedAt: daysAgo(2) },
  { id: "stmt-4", accountNumber: 1010, date: daysAgo(3), description: "COMMISSION ON TURNOVER & VAT", amount: -8_750, reconciled: false, importedAt: daysAgo(2) },
];

export const seedReconciliations: BankReconciliation[] = [];

export const seedBankConnections: BankConnection[] = [
  { id: "conn-gtb", accountNumber: 1010, provider: "Mono", institution: "GTBank", status: "Connected", connectedAt: daysAgo(35), lastSyncAt: daysAgo(2), cursor: 0 },
];

export const seedReconciliationRules: ReconciliationRule[] = [
  { id: "rr-charges", accountNumber: 1010, name: "Bank charges & COT", descriptionContains: "COMMISSION", direction: "out", contraAccount: 5600, memo: "Bank charges (auto)", active: true },
  { id: "rr-pos", accountNumber: 1010, name: "POS settlement", descriptionContains: "POS SETTLEMENT", direction: "in", contraAccount: 4000, memo: "Card takings settled to bank", active: true },
  { id: "rr-airtime", accountNumber: 1010, name: "Airtime / data", descriptionContains: "AIRTIME", direction: "out", contraAccount: 5310, memo: "Telephone & internet (auto)", active: true },
];
