// Accounts Payable domain — Vendors and the procurement/purchase chain:
//   Purchase Requisition → Purchase Order → Goods Receipt → Bill → Vendor Payment
//   Vendor Credits (apply to a bill)
//
// Mirrors the reference's Supplier/Vendor, PurchaseRequest(+Item),
// PurchaseOrder(+Item), Bill(+Item), BillPayment, VendorCredit(+Application).
// Only the Bill posts to the GL; the PR and PO are commitments, not transactions.

import type { DocApproval } from "@/data/accounting/control";

export type Vendor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  category: "Pharmaceuticals" | "Medical Supplies" | "Equipment" | "Utilities" | "Services" | "Facilities" | "Other";
  paymentTermsDays: number;
  apAccountNumber: number; // 2000
  openingBalance: number;
  active: boolean;
  createdAt: string;
};

export type PurchaseLine = {
  id: string;
  accountNumber: number; // expense / inventory / asset account the cost lands in
  description: string;
  qty: number;
  unitPrice: number;
  taxRateId?: string;
};

export type PRStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Ordered" | "Cancelled";
export type POStatus = "Draft" | "Sent" | "Partially Received" | "Received" | "Billed" | "Cancelled";
export type BillStatus = "Draft" | "Pending Approval" | "Awaiting Payment" | "Partially Paid" | "Paid" | "Overdue" | "Void";

export type PurchaseRequisition = {
  id: string;
  number: string;
  vendorId?: string;
  requestedBy: string;
  department?: string;
  date: string;
  needBy?: string;
  lines: PurchaseLine[];
  justification: string;
  status: PRStatus;
  approval: DocApproval;
  purchaseOrderId?: string;
  createdAt: string;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  vendorId: string;
  requisitionId?: string;
  date: string;
  expectedDate?: string;
  lines: PurchaseLine[];
  notes?: string;
  status: POStatus;
  billId?: string;
  createdBy: string;
  createdAt: string;
};

export type GoodsReceiptLine = { poLineId: string; description: string; qtyOrdered: number; qtyReceived: number };

export type GoodsReceipt = {
  id: string;
  number: string;
  purchaseOrderId: string;
  vendorId: string;
  date: string;
  receivedBy: string;
  lines: GoodsReceiptLine[];
  notes?: string;
  createdAt: string;
};

export type Bill = {
  id: string;
  number: string; // internal
  vendorInvoiceNumber?: string;
  vendorId: string;
  purchaseOrderId?: string;
  date: string;
  dueDate: string;
  lines: PurchaseLine[];
  notes?: string;
  status: BillStatus;
  approval: DocApproval;
  amountPaid: number;
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
  postedAt?: string;
};

export type BillPaymentAllocation = { billId: string; amount: number };

export type VendorPayment = {
  id: string;
  number: string;
  vendorId: string;
  date: string;
  method: "Bank Transfer" | "Cheque" | "Cash";
  fromAccountNumber: number;
  amount: number;
  allocations: BillPaymentAllocation[];
  reference?: string;
  withheldTax?: number;
  journalEntryId?: string;
  approval: DocApproval;
  createdBy: string;
  createdAt: string;
};

export type VendorCreditApplication = { billId: string; amount: number; date: string };

export type VendorCredit = {
  id: string;
  number: string;
  vendorId: string;
  billId?: string;
  date: string;
  lines: PurchaseLine[];
  reason: string;
  status: "Open" | "Partially Applied" | "Applied";
  applications: VendorCreditApplication[];
  journalEntryId?: string;
  createdBy: string;
  createdAt: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
const noAppr: DocApproval = { status: "Not Required", currentLevel: 0, steps: [] };

export const seedVendors: Vendor[] = [
  { id: "ven-emzor", name: "Emzor Pharmaceutical Industries", email: "sales@emzorpharma.example", phone: "+234 1 271 6000", taxId: "01234567-0001", category: "Pharmaceuticals", paymentTermsDays: 30, apAccountNumber: 2000, openingBalance: 1_100_000, active: true, createdAt: daysAgo(400) },
  { id: "ven-fidson", name: "Fidson Healthcare Plc", email: "trade@fidson.example", category: "Pharmaceuticals", paymentTermsDays: 30, apAccountNumber: 2000, openingBalance: 750_000, active: true, createdAt: daysAgo(380) },
  { id: "ven-medred", name: "MedReed Diagnostics Supplies", email: "orders@medreed.example", category: "Medical Supplies", paymentTermsDays: 21, apAccountNumber: 2000, openingBalance: 0, active: true, createdAt: daysAgo(200) },
  { id: "ven-ikeja", name: "Ikeja Electric", email: "business@ikejaelectric.example", category: "Utilities", paymentTermsDays: 7, apAccountNumber: 2000, openingBalance: 0, active: true, createdAt: daysAgo(365) },
  { id: "ven-total", name: "TotalEnergies (Diesel Supply)", category: "Facilities", paymentTermsDays: 14, apAccountNumber: 2000, openingBalance: 0, active: true, createdAt: daysAgo(365) },
];

const pl = (accountNumber: number, description: string, qty: number, unitPrice: number, taxRateId?: string): PurchaseLine => ({
  id: `pl-${Math.random().toString(36).slice(2, 7)}`,
  accountNumber,
  description,
  qty,
  unitPrice,
  taxRateId,
});

export const seedBills: Bill[] = [
  {
    id: "bill-7001",
    number: "BILL-2026-007001",
    vendorInvoiceNumber: "EMZ/INV/55210",
    vendorId: "ven-emzor",
    date: daysAgo(24),
    dueDate: daysAhead(6),
    lines: [pl(1200, "Antimalarials, antibiotics — restock", 1, 1_450_000), pl(1200, "IV fluids & giving sets", 1, 380_000)],
    status: "Awaiting Payment",
    approval: noAppr,
    amountPaid: 0,
    createdBy: "s6",
    createdAt: daysAgo(24),
    postedAt: daysAgo(24),
  },
  {
    id: "bill-7002",
    number: "BILL-2026-007002",
    vendorInvoiceNumber: "IE/APR/0091",
    vendorId: "ven-ikeja",
    date: daysAgo(9),
    dueDate: daysAgo(-2),
    lines: [pl(5210, "Electricity — August consumption", 1, 640_000)],
    status: "Awaiting Payment",
    approval: noAppr,
    amountPaid: 0,
    createdBy: "s6",
    createdAt: daysAgo(9),
    postedAt: daysAgo(9),
  },
  {
    id: "bill-7003",
    number: "BILL-2026-007003",
    vendorInvoiceNumber: "MR-2231",
    vendorId: "ven-medred",
    date: daysAgo(50),
    dueDate: daysAgo(29),
    lines: [pl(1210, "Gloves, syringes, swabs", 1, 520_000), pl(5010, "Reagent — direct use", 1, 180_000)],
    status: "Overdue",
    approval: noAppr,
    amountPaid: 200_000,
    createdBy: "s6",
    createdAt: daysAgo(50),
    postedAt: daysAgo(50),
  },
];

export const seedVendorPayments: VendorPayment[] = [
  {
    id: "vp-8001",
    number: "PMT-2026-008001",
    vendorId: "ven-medred",
    date: daysAgo(20),
    method: "Bank Transfer",
    fromAccountNumber: 1010,
    amount: 200_000,
    allocations: [{ billId: "bill-7003", amount: 200_000 }],
    reference: "NIP/883201",
    approval: noAppr,
    createdBy: "s1",
    createdAt: daysAgo(20),
  },
];

export const seedRequisitions: PurchaseRequisition[] = [
  {
    id: "pr-6001",
    number: "PR-2026-006001",
    vendorId: "ven-fidson",
    requestedBy: "s7",
    department: "Laboratory",
    date: daysAgo(3),
    needBy: daysAhead(10),
    lines: [pl(1200, "Rapid test kits (malaria, HIV, HBsAg)", 40, 12_500), pl(5010, "Haematology reagent pack", 4, 85_000)],
    justification: "Lab consumables at reorder level; screening clinic next week.",
    status: "Pending Approval",
    approval: {
      status: "Pending",
      currentLevel: 1,
      submittedBy: "s7",
      submittedAt: daysAgo(3),
      steps: [{ level: 1, approverRole: "Approver", decision: "Pending" }],
    },
    createdAt: daysAgo(3),
  },
];

export const seedPurchaseOrders: PurchaseOrder[] = [];
export const seedGoodsReceipts: GoodsReceipt[] = [];
export const seedVendorCredits: VendorCredit[] = [];
