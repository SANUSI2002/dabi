import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CircleAlert, FileText, Receipt, Search, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, PageHeader, StatCard, statusTone } from "@/components/ui/primitives";
import { EmptyRow, Table, Cell } from "@/components/ui/Table";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { minorMoney, useRevenueCycle } from "@/billing/useRevenueCycle";
import { getRevenueCycleApi } from "@/billing/runtime";
import { stableBillingIdempotencyKey } from "@/billing/idempotency";
import { dateTime } from "@/lib/format";

const filters = ["All", "Open", "Ready to bill", "Uninvoiced", "Unpaid", "Partial", "Paid", "Insurance", "Inpatient"] as const;

export default function Billing() {
  const navigate = useNavigate();
  const patients = useEmr((state) => state.patients);
  const legacyInvoices = useEmr((state) => state.invoices);
  const accounts = useRevenueCycle((state) => state.accounts);
  const charges = useRevenueCycle((state) => state.charges);
  const invoices = useRevenueCycle((state) => state.invoices);
  const payments = useRevenueCycle((state) => state.payments);
  const exceptions = useRevenueCycle((state) => state.exceptions);
  const bootstrapLegacy = useRevenueCycle((state) => state.bootstrapLegacy);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [issuingAccountId, setIssuingAccountId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");

  useEffect(() => {
    bootstrapLegacy(legacyInvoices.map((invoice) => ({ invoice, patient: patients.find((patient) => patient.id === invoice.patientId) })));
  }, [bootstrapLegacy, legacyInvoices, patients]);

  const rows = useMemo(() => accounts.map((account) => {
    const patient = patients.find((item) => item.id === account.patientId);
    const accountCharges = charges.filter((charge) => charge.accountId === account.id && !["VOIDED", "REVERSED"].includes(charge.status));
    const accountInvoices = invoices.filter((invoice) => invoice.accountId === account.id && !["VOIDED", "CANCELLED"].includes(invoice.status));
    const accountPayments = payments.filter((payment) => payment.accountId === account.id && payment.status === "SUCCEEDED");
    const chargeTotal = accountCharges.reduce((sum, charge) => sum + charge.netAmountMinor, 0);
    const paid = accountPayments.reduce((sum, payment) => sum + payment.amountMinor, 0);
    const balance = accountInvoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0)
      + accountCharges.filter((charge) => charge.status === "BILLABLE").reduce((sum, charge) => sum + charge.netAmountMinor, 0);
    return { account, patient, accountCharges, accountInvoices, chargeTotal, paid, balance };
  }), [accounts, charges, invoices, patients, payments]);

  const visible = rows.filter((row) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [row.patient?.firstName, row.patient?.lastName, row.patient?.mrn, row.patient?.phone, row.account.encounterId, row.account.number,
      ...row.accountInvoices.map((invoice) => invoice.number)].filter(Boolean).join(" ").toLowerCase().includes(search);
    if (!matchesSearch) return false;
    if (filter === "Open") return !["PAID", "FINANCIALLY_CLOSED"].includes(row.account.financialStatus);
    if (filter === "Ready to bill" || filter === "Uninvoiced") return row.accountCharges.some((charge) => charge.status === "BILLABLE");
    if (filter === "Unpaid") return row.accountInvoices.some((invoice) => invoice.status === "ISSUED" || invoice.status === "OVERDUE");
    if (filter === "Partial") return row.accountInvoices.some((invoice) => invoice.status === "PARTIALLY_PAID");
    if (filter === "Paid") return row.accountInvoices.length > 0 && row.accountInvoices.every((invoice) => ["PAID", "CREDITED"].includes(invoice.status));
    if (filter === "Insurance") return row.account.payer !== "Out of Pocket";
    if (filter === "Inpatient") return row.account.visitType.toLowerCase().includes("inpatient");
    return true;
  });

  const collected = payments.filter((payment) => payment.status === "SUCCEEDED").reduce((sum, payment) => sum + payment.amountMinor, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.balance, 0);
  const uninvoiced = charges.filter((charge) => charge.status === "BILLABLE").reduce((sum, charge) => sum + charge.netAmountMinor, 0);

  async function issue(accountId: string, chargeIds: string[]) {
    setMutationError("");
    setIssuingAccountId(accountId);
    try {
      const idempotencyKey = await stableBillingIdempotencyKey("invoice", `${accountId}:${[...chargeIds].sort().join(",")}`);
      const invoice = await getRevenueCycleApi().issueInvoice({ accountId, chargeIds, idempotencyKey });
      navigate(`/billing/invoices/${invoice.id}`);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "The invoice could not be generated.");
    } finally {
      setIssuingAccountId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Patient billing" subtitle="Open encounters, captured charges, invoices and collections" />

      {mutationError && <div role="alert" className="mb-4 rounded-xl border border-action-200 bg-action-50 px-4 py-3 text-sm font-semibold text-action-700">{mutationError}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Collected" value={minorMoney(collected)} tone="brand" icon={<Receipt size={18} />} />
        <StatCard label="Outstanding" value={minorMoney(outstanding)} tone="action" icon={<WalletCards size={18} />} delay={0.04} />
        <StatCard label="Uninvoiced charges" value={minorMoney(uninvoiced)} tone="amber" icon={<FileText size={18} />} delay={0.08} />
        <StatCard label="Charge exceptions" value={exceptions.filter((item) => item.status === "NEEDS_REVIEW").length} tone={exceptions.some((item) => item.status === "NEEDS_REVIEW") ? "action" : "mist"} icon={<CircleAlert size={18} />} delay={0.12} />
      </div>

      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
            <input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, MRN, encounter, invoice, phone…" />
          </label>
          <div className="flex flex-wrap gap-1" aria-label="Billing filters">
            {filters.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${filter === item ? "bg-brand-600 text-white" : "bg-mist-50 text-mist-600 hover:bg-mist-100"}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Table columns={["", "Patient", "Encounter / account", "Visit", <span key="charges" className="block text-right">Charges</span>, <span key="paid" className="block text-right">Paid</span>, <span key="balance" className="block text-right">Balance</span>, "Status", ""]} caption="Patient billing worklist">
        {visible.length === 0 && <EmptyRow colSpan={9}>No patient accounts match this view.</EmptyRow>}
        {visible.map((row) => {
          const open = expanded === row.account.id;
          const uninvoicedCharges = row.accountCharges.filter((charge) => charge.status === "BILLABLE");
          return (
            <Fragment key={row.account.id}>
              <tr className="transition hover:bg-mist-50/60">
                <Cell><button className="rounded-lg p-1 text-mist-500 hover:bg-mist-100" onClick={() => setExpanded(open ? null : row.account.id)} aria-label={open ? "Collapse patient account" : "Expand patient account"}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></Cell>
                <Cell className="font-semibold text-mist-900">
                  {row.patient ? (
                    <PatientLink patient={row.patient} sub={row.patient.mrn} />
                  ) : (
                    <>Unknown patient<span className="block text-[11px] font-normal text-mist-400">{row.account.patientId}</span></>
                  )}
                </Cell>
                <Cell><span className="block font-mono text-xs text-mist-700">{row.account.encounterId}</span><span className="block text-[11px] text-mist-400">{row.account.number}</span></Cell>
                <Cell>{row.account.visitType}<span className="block text-[11px] text-mist-400">{row.account.payer}</span></Cell>
                <Cell className="text-right font-semibold tabular-nums">{minorMoney(row.chargeTotal, row.account.currency)}</Cell>
                <Cell className="text-right tabular-nums text-brand-700">{minorMoney(row.paid, row.account.currency)}</Cell>
                <Cell className="text-right font-bold tabular-nums text-mist-900">{minorMoney(row.balance, row.account.currency)}</Cell>
                <Cell><Badge tone={statusTone(row.account.financialStatus.replaceAll("_", " "))}>{row.account.financialStatus.replaceAll("_", " ")}</Badge></Cell>
                <Cell><div className="flex justify-end gap-1.5">{uninvoicedCharges.length > 0 && <Button className="px-2.5 py-1 text-xs" disabled={issuingAccountId === row.account.id || row.account.readinessReasons.length > 0} title={row.account.readinessReasons.length ? `Waiting for ${row.account.readinessReasons.join("; ")}` : undefined} onClick={() => issue(row.account.id, uninvoicedCharges.map((charge) => charge.id))}>{issuingAccountId === row.account.id ? "Generating…" : "Generate invoice"}</Button>}{row.accountInvoices[0] && <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => navigate(`/billing/invoices/${row.accountInvoices[0].id}`)}>View invoice</Button>}</div></Cell>
              </tr>
              {open && (
                <tr>
                  <td colSpan={9} className="bg-mist-50/50 px-5 py-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-mist-400">Care journey charges</p>
                        <p className="text-xs text-mist-500">Every item retains its clinical source and price snapshot.</p>
                        {row.account.readinessReasons.length > 0
                          ? <p className="mt-1 text-xs font-semibold text-amber-700">Waiting for: {row.account.readinessReasons.join(" · ")}</p>
                          : <p className="mt-1 text-xs font-semibold text-brand-700">No pending billable clinical events.</p>}
                      </div>
                      {uninvoicedCharges.length > 0 && <Button disabled={issuingAccountId === row.account.id || row.account.readinessReasons.length > 0} title={row.account.readinessReasons.length ? `Waiting for ${row.account.readinessReasons.join("; ")}` : undefined} onClick={() => issue(row.account.id, uninvoicedCharges.map((charge) => charge.id))}><FileText size={14} /> {issuingAccountId === row.account.id ? "Generating invoice…" : `Generate invoice for ${minorMoney(uninvoicedCharges.reduce((sum, charge) => sum + charge.netAmountMinor, 0), row.account.currency)}`}</Button>}
                    </div>
                    <div className="overflow-hidden rounded-xl border border-mist-200 bg-white">
                      {row.accountCharges.length === 0 && <p className="p-5 text-sm text-mist-400">No charge items have been captured for this encounter.</p>}
                      {row.accountCharges.map((charge) => (
                        <div key={charge.id} className="grid gap-2 border-b border-mist-100 px-4 py-3 last:border-0 md:grid-cols-[130px_1fr_90px_120px_120px] md:items-center">
                          <div><Badge tone="mist">{charge.department}</Badge></div>
                          <div><p className="text-sm font-semibold text-mist-800">{charge.description}</p><p className="text-[11px] text-mist-400">{charge.sourceType.replaceAll("_", " ")} · {charge.sourceId} · {charge.performedBy}</p></div>
                          <div className="text-xs text-mist-500">Qty {charge.quantity}</div>
                          <div className="text-xs text-mist-400">{dateTime(charge.performedAt)}</div>
                          <div className="text-right"><p className="font-semibold tabular-nums">{minorMoney(charge.netAmountMinor, charge.currency)}</p><Badge tone={statusTone(charge.status)}>{charge.status}</Badge></div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end gap-8 text-sm"><span className="text-mist-500">Gross charges <b className="ml-2 text-mist-900">{minorMoney(row.chargeTotal, row.account.currency)}</b></span><span className="text-mist-500">Paid <b className="ml-2 text-brand-700">{minorMoney(row.paid, row.account.currency)}</b></span><span className="text-mist-500">Outstanding <b className="ml-2 text-action-700">{minorMoney(row.balance, row.account.currency)}</b></span></div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>

      {exceptions.some((item) => item.status === "NEEDS_REVIEW") && (
        <div className="mt-5 card border-l-4 border-l-action-500">
          <div className="mb-3 flex items-center gap-2"><CircleAlert size={18} className="text-action-600" /><div><h2 className="font-display font-bold text-mist-900">Charge review</h2><p className="text-xs text-mist-500">Events requiring revenue-integrity attention are retained here, never silently discarded.</p></div></div>
          <div className="divide-y divide-mist-100">{exceptions.filter((item) => item.status === "NEEDS_REVIEW").slice(0, 8).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div><b>{item.reason.replaceAll("_", " ")}</b><span className="ml-2 text-mist-500">{item.detail}</span></div><span className="font-mono text-[11px] text-mist-400">{item.sourceEventId}</span></div>)}</div>
        </div>
      )}
    </div>
  );
}
