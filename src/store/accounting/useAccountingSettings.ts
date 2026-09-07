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
  { key: "receipt", label: "Customer Receipt", prefix: "RCT-", padding: 6, next: 2002 },
  { key: "credit-note", label: "Credit Note", prefix: "CN-", padding: 6, next: 5001 },
  { key: "requisition", label: "Purchase Requisition", prefix: "PR-", padding: 6, next: 6002 },
  { key: "po", label: "Purchase Order", prefix: "PO-", padding: 6, next: 9001 },
  { key: "goods-receipt", label: "Goods Receipt Note", prefix: "GRN-", padding: 6, next: 1 },
  { key: "bill", label: "Vendor Bill", prefix: "BILL-", padding: 6, next: 7005 },
  { key: "payment", label: "Vendor Payment", prefix: "PMT-", padding: 6, next: 8002 },
  { key: "vendor-credit", label: "Vendor Credit", prefix: "VC-", padding: 6, next: 1 },
  { key: "expense", label: "Expense Claim", prefix: "EXP-", padding: 6, next: 3 },
];

type SettingsState = {
  org: OrgSettings;
  sequences: NumberSequence[];
  updateOrg: (patch: Partial<OrgSettings>) => void;
  updateSequence: (key: string, patch: Partial<Pick<NumberSequence, "prefix" | "padding" | "next">>) => void;
  /** allocate the next document number for a sequence and advance it */
  nextDocNumber: (key: string) => string;
  peekDocNumber: (key: string) => string;
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
}));
