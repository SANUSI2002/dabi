import { create } from "zustand";
import { accountingRequest, describeEmrError } from "@/emr-live/client";
import { uuid } from "@/workforce-live/sync";
import { loadReceivables } from "./receivables";
import { loadLedger } from "./ledger";

// Healthcare payers in live mode (GET /receivables/payers): patients' charges billed to their HMO or
// NHIA, claims and their adjudication, capitation, write-offs and the expected-credit-loss allowance.
// Every action is the server's: it checks, posts the journal entries, and the books reload after.

export type PayerTransfer = { id: string; patientInvoiceId: string; payerInvoiceId: string; patientCustomerId: string; payerCustomerId: string; amount: number; rebilledAmount: number; authorizationCode?: string; enrolleeNumber?: string; createdBy: string; createdAt: string; reversedAt?: string };
export type ClaimItem = { invoiceId: string; number: string; date: string; claimed: number; approved?: number; denied?: number; reason?: string; action?: "write-off" | "rebill" };
export type PayerClaim = { id: string; number: string; payerCustomerId: string; periodStart: string; periodEnd: string; status: "Draft" | "Submitted" | "Adjudicated" | "Cancelled"; items: ClaimItem[]; reference?: string; notes?: string; claimed: number; approved?: number; denied?: number; submittedAt?: string; adjudicatedAt?: string; createdBy: string; createdAt: string; version: number };
export type Capitation = { id: string; number: string; payerCustomerId: string; startPeriod: string; months: number; enrollees: number; ratePerEnrollee: number; amount: number; receivedDate: string; reference?: string; entries: { period: string; amount: number; recognized: boolean }[]; createdBy: string; createdAt: string };
export type WriteOff = { id: string; invoiceId: string; customerId: string; amount: number; fromAllowance: number; reason: string; recoveredAmount: number; createdBy: string; createdAt: string };
export type LossRates = { patient: number[]; payer: number[] };
export type LossBucket = { group: "patient" | "payer"; band: string; balance: number; rate: number; expected: number };
export type CreditLossRun = { id: string; asOf: string; rates: LossRates; buckets: LossBucket[]; required: number; previous: number; adjustment: number; createdBy: string; createdAt: string };
type Overview = { payers: { id: string; name: string; type: string }[]; transfers: PayerTransfer[]; claims: PayerClaim[]; capitations: Capitation[]; writeOffs: WriteOff[]; creditLossRuns: CreditLossRun[]; allowance: number; bands: string[]; defaultLossRates: LossRates };

export const usePayers = create<Overview & { loaded: boolean; error: string }>(() => ({ loaded: false, error: "", payers: [], transfers: [], claims: [], capitations: [], writeOffs: [], creditLossRuns: [], allowance: 0, bands: [], defaultLossRates: { patient: [2, 5, 15, 30, 60], payer: [1, 2, 5, 15, 35] } }));

export async function loadPayers() {
  try {
    const { data } = await accountingRequest<{ data: Overview }>("/receivables/payers");
    usePayers.setState({ ...data, loaded: true, error: "" });
  } catch (cause) {
    usePayers.setState({ loaded: true, error: describeEmrError(cause) });
  }
}

/** Runs an action, reloads everything it touches, and returns its result or the error in words. */
async function act<T>(path: string, body: unknown, method: "POST" | "PATCH" = "POST", version?: number): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const { data } = await accountingRequest<{ data: T }>(`/receivables${path}`, { method, body, ...(version !== undefined ? { version } : {}) });
    return { ok: true, data };
  } catch (cause) {
    return { ok: false, error: describeEmrError(cause) };
  } finally {
    await Promise.all([loadPayers(), loadReceivables().catch(() => undefined), loadLedger().catch(() => undefined)]);
  }
}
const clean = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

export const billToPayer = (invoiceId: string, input: { payerId: string; amount?: number; authorizationCode?: string; enrolleeNumber?: string }) =>
  act<{ id: string; payerInvoiceNumber: string }>(`/invoices/${invoiceId}/bill-payer`, clean({ id: uuid(), ...input }));
export const reverseTransfer = (id: string) => act(`/payer-transfers/${id}/reverse`, {});
export const createClaim = (input: { payerId: string; periodStart: string; periodEnd: string; notes?: string }) => act<{ id: string; number: string; claimed: number }>("/claims", clean({ id: uuid(), ...input }));
export const removeFromClaim = (claim: PayerClaim, invoiceId: string) => act(`/claims/${claim.id}`, { invoiceIds: claim.items.filter((i) => i.invoiceId !== invoiceId).map((i) => i.invoiceId) }, "PATCH", claim.version);
export const submitClaim = (id: string, reference?: string) => act(`/claims/${id}/submit`, clean({ reference }));
export const cancelClaim = (id: string) => act(`/claims/${id}/cancel`, {});
export const adjudicateClaim = (id: string, items: { invoiceId: string; approved: number; reason?: string; action?: "write-off" | "rebill" }[], date?: string) =>
  act<{ approved: number; denied: number }>(`/claims/${id}/adjudicate`, clean({ items: items.map((i) => clean(i)), date }));
export const recordCapitation = (input: { payerId: string; startPeriod: string; months: number; enrollees: number; ratePerEnrollee: number; receivedDate: string; depositAccountNumber: number; reference?: string }) =>
  act<{ number: string; amount: number; recognized: number; deferred: number }>("/capitation", clean({ id: uuid(), ...input }));
export const recognizeCapitation = (asOf: string) => act<{ months: number; amount: number }>("/capitation/recognize", { asOf });
export const writeOff = (invoiceId: string, input: { amount?: number; reason: string }) => act<{ amount: number; fromAllowance: number; toExpense: number }>(`/invoices/${invoiceId}/write-off`, clean(input));
export const recoverWriteOff = (id: string, input: { amount: number; depositAccountNumber: number; reference?: string }) => act(`/write-offs/${id}/recover`, clean(input));
export const measureCreditLoss = (input: { asOf?: string; rates: LossRates; post?: boolean }) =>
  act<{ buckets: LossBucket[]; required: number; previous: number; adjustment: number }>("/credit-loss", clean(input));
