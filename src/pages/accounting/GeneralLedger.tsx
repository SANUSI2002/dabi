import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader, Button, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Field, Input, Select } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate, isoDate } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";
import { isDebitNormal } from "@/data/accounting/coa";

export default function GeneralLedger() {
  const { accounts, entries, balanceOf } = useLedger();
  const active = accounts.filter((a) => a.isActive).sort((a, b) => a.number - b.number);
  const [acctNo, setAcctNo] = useState<number>(active[0]?.number ?? 1000);
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 90 * 864e5)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [print, setPrint] = useState(false);

  const account = accounts.find((a) => a.number === acctNo);
  const debitNormal = account ? isDebitNormal(account) : true;
  const fromT = new Date(from + "T00:00:00.000Z").getTime();
  const toT = new Date(to + "T23:59:59.999Z").getTime();

  const { opening, rows, closing } = useMemo(() => {
    const openingBal = balanceOf(acctNo, new Date(fromT - 1).toISOString());
    const movements = entries
      .filter((e) => e.status === "Posted")
      .flatMap((e) => e.lines.filter((l) => l.accountNumber === acctNo).map((l) => ({ e, l })))
      .filter(({ e }) => {
        const t = new Date(e.date).getTime();
        return t >= fromT && t <= toT;
      })
      .sort((a, b) => new Date(a.e.date).getTime() - new Date(b.e.date).getTime() || a.e.number.localeCompare(b.e.number));

    const out = movements.reduce<Array<{ entry: (typeof movements)[number]["e"]; line: (typeof movements)[number]["l"]; running: number }>>((rows, { e, l }) => {
      const previous = rows.at(-1)?.running ?? openingBal;
      const running = previous + (debitNormal ? l.debit - l.credit : l.credit - l.debit);
      return [...rows, { entry: e, line: l, running }];
    }, []);
    return { opening: openingBal, rows: out, closing: out.at(-1)?.running ?? openingBal };
  }, [acctNo, entries, balanceOf, fromT, toT, debitNormal]);

  const periodDr = rows.reduce((n, r) => n + r.line.debit, 0);
  const periodCr = rows.reduce((n, r) => n + r.line.credit, 0);

  return (
    <div>
      <PageHeader
        title="General Ledger"
        subtitle="Every posted movement against an account, with a running balance"
        actions={<Button variant="soft" onClick={() => setPrint(true)}><Printer size={15} /> Print</Button>}
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
          <Field label="Account">
            <Select
              value={String(acctNo)}
              onChange={(e) => setAcctNo(Number(e.target.value))}
              options={active.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))}
            />
          </Field>
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3"><p className="text-[11px] font-bold uppercase text-mist-400">Opening</p><p className="mt-1 font-mono text-lg font-bold">{money(opening)}</p></Card>
        <Card className="p-3"><p className="text-[11px] font-bold uppercase text-mist-400">Period debits</p><p className="mt-1 font-mono text-lg font-bold">{money(periodDr)}</p></Card>
        <Card className="p-3"><p className="text-[11px] font-bold uppercase text-mist-400">Period credits</p><p className="mt-1 font-mono text-lg font-bold">{money(periodCr)}</p></Card>
        <Card className="p-3"><p className="text-[11px] font-bold uppercase text-mist-400">Closing</p><p className="mt-1 font-mono text-lg font-bold">{money(closing)}</p></Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No postings in this period" hint="Widen the date range or pick another account." />
      ) : (
        <Card className="p-0">
          <Table columns={["Date", "Entry", "Source", "Memo", "Debit", "Credit", "Balance"]}>
            {rows.map((r, i) => (
              <Row key={r.line.id} index={i}>
                <Cell className="whitespace-nowrap text-mist-500">{shortDate(r.entry.date)}</Cell>
                <Cell className="font-mono text-xs">{r.entry.number}</Cell>
                <Cell><Badge tone="mist">{r.entry.source}</Badge></Cell>
                <Cell className="max-w-[280px] truncate text-mist-600">{r.line.description || r.entry.memo}</Cell>
                <Cell className="font-mono">{r.line.debit > 0 ? money(r.line.debit) : ""}</Cell>
                <Cell className="font-mono">{r.line.credit > 0 ? money(r.line.credit) : ""}</Cell>
                <Cell className="font-mono font-semibold">{money(r.running)}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      {print && account && (
        <PrintDoc open onClose={() => setPrint(false)} docTitle="General Ledger">
          <Section title={`${account.number} — ${account.name}`}>
            <Line label="Period" value={`${shortDate(from)} to ${shortDate(to)}`} />
            <Line label="Opening balance" value={money(opening)} />
            <Line label="Closing balance" value={money(closing)} />
          </Section>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500">
                <th className="py-2">Date</th><th>Entry</th><th>Memo</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line.id} className="border-b border-mist-100">
                  <td className="py-1.5">{shortDate(r.entry.date)}</td>
                  <td className="font-mono text-xs">{r.entry.number}</td>
                  <td>{r.line.description || r.entry.memo}</td>
                  <td className="text-right font-mono">{r.line.debit > 0 ? money(r.line.debit) : ""}</td>
                  <td className="text-right font-mono">{r.line.credit > 0 ? money(r.line.credit) : ""}</td>
                  <td className="text-right font-mono">{money(r.running)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintDoc>
      )}
    </div>
  );
}
