import { useMemo, useState } from "react";
import { Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader, Button, Card } from "@/components/ui/primitives";
import { ExportButton } from "./_csv";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Field, Input } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate, isoDate } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";

export default function TrialBalance() {
  const { trialBalance } = useLedger();
  const [asOf, setAsOf] = useState(isoDate(new Date()));
  const [print, setPrint] = useState(false);

  const iso = new Date(asOf + "T23:59:59.999Z").toISOString();
  const rows = useMemo(() => trialBalance(iso), [trialBalance, iso]);
  const totalDr = rows.reduce((n, r) => n + r.debit, 0);
  const totalCr = rows.reduce((n, r) => n + r.credit, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div>
      <PageHeader
        title="Trial Balance"
        subtitle="Every account's net balance in its debit/credit column — proves the ledger is self-consistent"
        actions={
          <>
            <Field label="As at">
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-auto" />
            </Field>
            <ExportButton filename={`trial-balance-${asOf}`} headers={["number", "account", "debit", "credit"]} rows={rows.map((r) => [r.account.number, r.account.name, r.debit || "", r.credit || ""])} />
            <Button variant="soft" onClick={() => setPrint(true)}><Printer size={15} /> Print</Button>
          </>
        }
      />

      <div
        className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${
          balanced ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-action-50 text-action-700 ring-action-200"
        }`}
      >
        {balanced ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
        {balanced
          ? `In balance — debits and credits both total ${money(totalDr)}`
          : `Out of balance by ${money(Math.abs(totalDr - totalCr))} — investigate before closing`}
      </div>

      <Card className="p-0">
        <Table columns={["No.", "Account", "Debit", "Credit"]}>
          {rows.map((r, i) => (
            <Row key={r.account.id} index={i}>
              <Cell className="font-mono text-xs text-mist-500">{r.account.number}</Cell>
              <Cell className="font-semibold">{r.account.name}</Cell>
              <Cell className="font-mono">{r.debit > 0 ? money(r.debit) : ""}</Cell>
              <Cell className="font-mono">{r.credit > 0 ? money(r.credit) : ""}</Cell>
            </Row>
          ))}
          <Row index={rows.length} className="border-t-2 border-mist-300 font-bold">
            <Cell />
            <Cell className="text-right uppercase tracking-wide">Totals</Cell>
            <Cell className="font-mono">{money(totalDr)}</Cell>
            <Cell className="font-mono">{money(totalCr)}</Cell>
          </Row>
        </Table>
      </Card>

      {print && (
        <PrintDoc open onClose={() => setPrint(false)} docTitle="Trial Balance">
          <Section title="Trial Balance">
            <Line label="As at" value={shortDate(asOf)} />
            <Line label="Status" value={balanced ? "In balance" : `Out of balance by ${money(Math.abs(totalDr - totalCr))}`} />
          </Section>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500">
                <th className="py-2">No.</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account.id} className="border-b border-mist-100">
                  <td className="py-1.5 font-mono text-xs">{r.account.number}</td>
                  <td>{r.account.name}</td>
                  <td className="text-right font-mono">{r.debit > 0 ? money(r.debit) : ""}</td>
                  <td className="text-right font-mono">{r.credit > 0 ? money(r.credit) : ""}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-brand-600 font-bold">
                <td className="py-2" colSpan={2}>Totals</td>
                <td className="text-right font-mono">{money(totalDr)}</td>
                <td className="text-right font-mono">{money(totalCr)}</td>
              </tr>
            </tbody>
          </table>
        </PrintDoc>
      )}
    </div>
  );
}
