import { create } from "zustand";
import { audit } from "@/store/useAudit";

export type OrgSettings = {
  legalName: string;
  tradingName: string;
  tin: string;
  rcNumber: string;
  address: string;
  reportingCurrency: string;
  fiscalYearStartMonth: number; // 1 = January
};

export type NumberSequence = {
  key: string;
  label: string;
  prefix: string;
  padding: number;
  next: number;
  example: string;
};

const buildExample = (s: Omit<NumberSequence, "example">) => `${s.prefix}${new Date().getUTCFullYear()}-${String(s.next).padStart(s.padding, "0")}`;

const seqSeed: Omit<NumberSequence, "example">[] = [
  { key: "journal", label: "Journal Entry", prefix: "JE-", padding: 6, next: 1 },
  { key: "estimate", label: "Quotation / Estimate", prefix: "EST-", padding: 6, next: 3002 },
  { key: "sales-order", label: "Sales Order", prefix: "SO-", padding: 6, next: 4001 },
  { key: "invoice", label: "Sales Invoice", prefix: "INV-", padding: 6, next: 1004 },
  { key: "sales-receipt", label: "Sales Receipt (cash sale)", prefix: "SR-", padding: 6, next: 9002 },
  { key: "receipt", label: "Customer Receipt", prefix: "RCT-", padding: 6, next: 2002 },
  { key: "refund-receipt", label: "Refund Receipt", prefix: "REF-", padding: 6, next: 1 },
  { key: "credit-note", label: "Credit Note", prefix: "CN-", padding: 6, next: 5001 },
  { key: "requisition", label: "Purchase Requisition", prefix: "PR-", padding: 6, next: 6002 },
  { key: "po", label: "Purchase Order", prefix: "PO-", padding: 6, next: 9001 },
  { key: "goods-receipt", label: "Goods Receipt Note", prefix: "GRN-", padding: 6, next: 1 },
  { key: "bill", label: "Vendor Bill", prefix: "BILL-", padding: 6, next: 7005 },
  { key: "payment", label: "Vendor Payment", prefix: "PMT-", padding: 6, next: 8002 },
  { key: "vendor-credit", label: "Vendor Credit", prefix: "VC-", padding: 6, next: 1 },
  { key: "expense", label: "Expense Claim", prefix: "EXP-", padding: 6, next: 3 },
];

// B4 — managed payment terms (shared by AR and AP)
export type PaymentTerm = {
  id: string;
  name: string;
  netDays: number;
  eom: boolean; // due end-of-month of (invoice month + netDays)
  discountPercent?: number; // early-payment discount
  discountDays?: number; // paid within this many days earns the discount
  active: boolean;
};

const termSeed: PaymentTerm[] = [
  { id: "pt-receipt", name: "Due on receipt", netDays: 0, eom: false, active: true },
  { id: "pt-net15", name: "Net 15", netDays: 15, eom: false, active: true },
  { id: "pt-net30", name: "Net 30", netDays: 30, eom: false, active: true },
  { id: "pt-net45", name: "Net 45", netDays: 45, eom: false, active: true },
  { id: "pt-net60", name: "Net 60", netDays: 60, eom: false, active: true },
  { id: "pt-2-10-30", name: "2/10 Net 30", netDays: 30, eom: false, discountPercent: 2, discountDays: 10, active: true },
  { id: "pt-eom", name: "Net 30 EOM", netDays: 30, eom: true, active: true },
];

// B6 — configurable dunning ladder
export type ReminderRule = {
  id: string;
  level: number;
  daysOverdue: number;
  tone: string;
  subject: string;
  body: string;
  active: boolean;
};

const reminderSeed: ReminderRule[] = [
  { id: "rr-1", level: 1, daysOverdue: 3, tone: "Friendly", subject: "Gentle reminder — invoice {number}", body: "We noticed invoice {number} for {amount} became due on {dueDate}. If payment is already on its way, thank you. Otherwise a prompt settlement would be appreciated.", active: true },
  { id: "rr-2", level: 2, daysOverdue: 14, tone: "Firm", subject: "Overdue — invoice {number} ({daysOverdue} days)", body: "Invoice {number} for {amount} is now {daysOverdue} days overdue. Please arrange payment within 5 working days to keep the account in good standing.", active: true },
  { id: "rr-3", level: 3, daysOverdue: 30, tone: "Final Notice", subject: "FINAL NOTICE — invoice {number}", body: "Invoice {number} for {amount} is {daysOverdue} days overdue. Unless settled within 7 days the account will be placed on credit hold and referred for collection.", active: true },
];

type SettingsState = {
  org: OrgSettings;
  sequences: NumberSequence[];
  paymentTerms: PaymentTerm[];
  reminderRules: ReminderRule[];
  updateOrg: (patch: Partial<OrgSettings>) => void;
  updateSequence: (key: string, patch: Partial<Pick<NumberSequence, "prefix" | "padding" | "next">>) => void;
  /** allocate the next document number for a sequence and advance it */
  nextDocNumber: (key: string) => string;
  peekDocNumber: (key: string) => string;

  addPaymentTerm: (t: Omit<PaymentTerm, "id" | "active">) => void;
  updatePaymentTerm: (id: string, patch: Partial<PaymentTerm>) => void;
  termById: (id?: string) => PaymentTerm | undefined;
  /** due date for an invoice/bill dated `date` under term `termId` */
  dueDateFor: (date: string, termId?: string, fallbackDays?: number) => string;

  addReminderRule: (r: Omit<ReminderRule, "id" | "active">) => void;
  updateReminderRule: (id: string, patch: Partial<ReminderRule>) => void;
  removeReminderRule: (id: string) => void;
};

export const useAccountingSettings = create<SettingsState>((set, get) => ({
  org: {
    legalName: "Sabi Health Post Limited",
    tradingName: "Sabi Health Post",
    tin: "20489317-0001",
    rcNumber: "RC 1847220",
    address: "14 Awolowo Way, Amuwo-Odofin, Lagos State",
    reportingCurrency: "NGN",
    fiscalYearStartMonth: 1,
  },
  sequences: seqSeed.map((s) => ({ ...s, example: buildExample(s) })),
  paymentTerms: termSeed,
  reminderRules: reminderSeed,

  updateOrg: (patch) => {
    set((st) => ({ org: { ...st.org, ...patch } }));
    audit("updated accounting organisation settings", "accounting/settings/organisation");
  },
  updateSequence: (key, patch) => {
    set((st) => ({
      sequences: st.sequences.map((s) => {
        if (s.key !== key) return s;
        const merged = { ...s, ...patch };
        return { ...merged, example: buildExample(merged) };
      }),
    }));
    audit(`updated ${key} numbering`, "accounting/settings/numbering");
  },

  peekDocNumber: (key) => {
    const s = get().sequences.find((x) => x.key === key);
    if (!s) return key.toUpperCase();
    return `${s.prefix}${new Date().getUTCFullYear()}-${String(s.next).padStart(s.padding, "0")}`;
  },

  nextDocNumber: (key) => {
    const s = get().sequences.find((x) => x.key === key);
    if (!s) return `${key.toUpperCase()}-${Date.now()}`;
    const num = `${s.prefix}${new Date().getUTCFullYear()}-${String(s.next).padStart(s.padding, "0")}`;
    set((st) => ({ sequences: st.sequences.map((x) => (x.key === key ? { ...x, next: x.next + 1, example: buildExample({ ...x, next: x.next + 1 }) } : x)) }));
    return num;
  },

  addPaymentTerm: (t) => {
    set((s) => ({ paymentTerms: [...s.paymentTerms, { ...t, id: `pt-${Math.random().toString(36).slice(2, 8)}`, active: true }] }));
    audit(`created payment term ${t.name}`, "accounting/settings/payment-terms");
  },
  updatePaymentTerm: (id, patch) => set((s) => ({ paymentTerms: s.paymentTerms.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  termById: (id) => get().paymentTerms.find((t) => t.id === id),
  dueDateFor: (date, termId, fallbackDays = 30) => {
    const term = get().paymentTerms.find((t) => t.id === termId);
    const base = new Date(date);
    const days = term ? term.netDays : fallbackDays;
    const d = new Date(base.getTime() + days * 864e5);
    if (term?.eom) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).toISOString();
    return d.toISOString();
  },

  addReminderRule: (r) => {
    set((s) => ({ reminderRules: [...s.reminderRules, { ...r, id: `rr-${Math.random().toString(36).slice(2, 8)}`, active: true }].sort((a, b) => a.level - b.level) }));
    audit(`added dunning rule level ${r.level}`, "accounting/settings/dunning");
  },
  updateReminderRule: (id, patch) => set((s) => ({ reminderRules: s.reminderRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeReminderRule: (id) => set((s) => ({ reminderRules: s.reminderRules.filter((r) => r.id !== id) })),
}));
