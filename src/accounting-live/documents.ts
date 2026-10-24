import { accountingDownload, accountingRequest, describeEmrError } from "@/emr-live/client";
import { useAR } from "@/store/accounting/useAR";
import { deliveryText, loadReceivables } from "./receivables";

// Finance documents in live mode: the server prints invoices, statements of account and remittance
// advice as PDF from the books, and emails invoices to customers with the PDF attached. Downloads are
// fetched with the session's credentials (never a token in a URL) and handed to the browser as a file.

/** Saves a fetched file, or opens it in a new tab to read and print. */
function hand(blob: Blob, filename: string, open: boolean) {
  const url = URL.createObjectURL(blob);
  if (open) {
    const tab = window.open(url, "_blank"); // our own blob: "noopener" would hide whether it opened
    // a blocked pop-up falls back to a download
    if (!tab) { const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); }
  } else {
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
const query = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `?${q}` : "";
};
/** Fetches a PDF and saves or opens it; returns an error sentence, or "" when it worked. */
async function getPdf(path: string, fallbackName: string, open: boolean) {
  try {
    const { blob, filename } = await accountingDownload(path);
    hand(blob, filename ?? fallbackName, open);
    return "";
  } catch (cause) {
    return describeEmrError(cause);
  }
}

export type StatementPeriod = { from?: string; to?: string };
export const invoicePdf = (invoiceId: string, number: string, open = false) => getPdf(`/receivables/invoices/${invoiceId}/pdf`, `${number}.pdf`, open);
export const customerStatementPdf = (customerId: string, period: StatementPeriod = {}, open = false) =>
  getPdf(`/receivables/customers/${customerId}/statement${query({ format: "pdf", ...period })}`, "Statement.pdf", open);
export const vendorStatementPdf = (vendorId: string, period: StatementPeriod = {}, open = false) =>
  getPdf(`/payables/vendors/${vendorId}/statement${query({ format: "pdf", ...period })}`, "Statement.pdf", open);
export const remittancePdf = (paymentId: string, number: string, open = false) => getPdf(`/payables/payments/${paymentId}/remittance`, `Remittance-${number}.pdf`, open);

export type StatementLine = { date: string; reference: string; description: string; debit: number; credit: number; balance: number };
export type PartyStatement = {
  party: { id: string; name: string; email: string }; from: string; to: string; currency: string;
  openingBalance: number; closingBalance: number; totalDebits: number; totalCredits: number; lines: StatementLine[];
  open: { id: string; number: string; date: string; dueDate?: string; currency: string; total: number; balance: number; overdue: boolean }[];
  aging: { label: string; amount: number }[];
};
/** A statement of account from the subledger, for the screen. */
export async function loadStatement(kind: "customer" | "vendor", id: string, period: StatementPeriod = {}): Promise<PartyStatement> {
  const base = kind === "customer" ? `/receivables/customers/${id}/statement` : `/payables/vendors/${id}/statement`;
  const { data } = await accountingRequest<{ data: PartyStatement }>(`${base}${query({ ...period })}`);
  return data;
}

type Delivery = { status: "QUEUED" | "NOT_SENT"; reason?: "NO_EMAIL_ADDRESS" | "EMAIL_NOT_CONFIGURED" };
/** Emails an issued invoice (with its PDF) to the customer, or to another address; says what happened. */
export async function emailInvoiceNow(invoiceId: string, to?: string) {
  try {
    const { data } = await accountingRequest<{ data: { to: string; delivery: Delivery } }>(`/receivables/invoices/${invoiceId}/email`, { method: "POST", body: to ? { to } : {} });
    const inv = useAR.getState().invoices.find((i) => i.id === invoiceId);
    return `${inv?.number ?? "Invoice"} ${deliveryText(data.delivery, data.to)}${data.delivery.status === "QUEUED" ? ", with the PDF attached" : ""}.`;
  } catch (cause) {
    return describeEmrError(cause);
  } finally {
    await loadReceivables().catch(() => undefined);
  }
}
