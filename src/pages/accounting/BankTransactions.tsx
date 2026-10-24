import { useMemo, useState } from "react";
import { Plus, Upload, Receipt } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useBanking } from "@/store/accounting/useBanking";
import { useLedger } from "@/store/accounting/useLedger";
import { parseStatement } from "@/lib/bankStatement";

export default function BankTransactions() {
  const { accounts, glMovements, recordBankLine, importStatementLines, statementLines } = useBanking();
  const allAccts = useLedger((s) => s.accounts).filter((a) => a.isActive);
  // opens on the first bank account (not petty cash, which sorts first)
  const [acctNo, setAcctNo] = useState((accounts.find((a) => a.bankName !== "Cash") ?? accounts[0])?.accountNumber ?? 1010);
  const [entry, setEntry] = useState(false);
  const [imp, setImp] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [f, setF] = useState({ direction: "out" as "in" | "out", contra: 5600, amount: 0, date: isoDate(new Date()), description: "", reference: "" });
  const [impText, setImpText] = useState("");
  const [impFile, setImpFile] = useState("");
  const parsed = useMemo(() => (impText.trim() ? parseStatement(impText) : null), [impText]);

  const moves = glMovements(acctNo);
  const moneyIn = moves.filter((m) => m.amount > 0).reduce((n, m) => n + m.amount, 0);
  const moneyOut = moves.filter((m) => m.amount < 0).reduce((n, m) => n + Math.abs(m.amount), 0);

  function submitEntry() {
    setErr(null);
    const r = recordBankLine({ accountNumber: acctNo, contraAccount: f.contra, direction: f.direction, amount: f.amount, date: new Date(f.date + "T12:00:00Z").toISOString(), description: f.description || "Bank transaction", reference: f.reference || undefined });
    if (!r.ok) return setErr(r.error ?? "Could not post");
    setEntry(false);
    setF({ ...f, amount: 0, description: "", reference: "" });
  }
  function submitImport() {
    if (parsed?.lines.length) importStatementLines(acctNo, parsed.lines);
    setImp(false);
    setImpText("");
    setImpFile("");
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    setImpFile(file.name);
    setImpText(file.size > 5_000_000 ? "" : await file.text());
    if (file.size > 5_000_000) setImpFile(`${file.name} is over 5 MB — export a shorter period`);
  }

  return (
    <div>
      <PageHeader title="Bank Transactions" subtitle="Every posted movement on a bank account, plus quick entry for charges, interest and adjustments"
        actions={<>
          <Button variant="soft" onClick={() => setImp(true)}><Upload size={15} /> Import statement</Button>
          <Button onClick={() => { setErr(null); setEntry(true); }}><Plus size={15} /> Bank Entry</Button>
        </>} />

      <Card className="mb-4">
        <Field label="Account"><Select value={String(acctNo)} onChange={(e) => setAcctNo(+e.target.value)} options={accounts.map((a) => ({ value: String(a.accountNumber), label: `${a.accountName} (${a.accountNo})` }))} /></Field>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Movements" value={moves.length} tone="brand" icon={<Receipt size={18} />} />
        <StatCard label="Money in" value={money(moneyIn)} tone="brand" delay={0.05} />
        <StatCard label="Money out" value={money(moneyOut)} tone="action" delay={0.1} />
        <StatCard label="Uncleared statement lines" value={statementLines.filter((l) => l.accountNumber === acctNo && !l.reconciled).length} tone="amber" delay={0.15} />
      </div>

      {moves.length === 0 ? <EmptyState title="No movements on this account" /> : (
        <Card className="p-0">
          <Table columns={["Date", "Source", "Memo", "In", "Out"]}>
            {moves.map((m, i) => (
              <Row key={m.key} index={i}>
                <Cell className="whitespace-nowrap text-mist-500">{shortDate(m.date)}</Cell>
                <Cell><Badge tone="mist">{m.source}</Badge></Cell>
                <Cell className="max-w-[340px] truncate">{m.description || m.memo}</Cell>
                <Cell className="font-mono">{m.amount > 0 ? money(m.amount) : ""}</Cell>
                <Cell className="font-mono">{m.amount < 0 ? money(Math.abs(m.amount)) : ""}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={entry} onClose={() => setEntry(false)} title="Bank Entry"
        footer={<><Button variant="ghost" onClick={() => setEntry(false)}>Cancel</Button><Button onClick={submitEntry} disabled={f.amount <= 0}>Post</Button></>}>
        <div className="space-y-3">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Direction"><Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as never, contra: e.target.value === "in" ? 4100 : 5600 })} options={[{ value: "out", label: "Money out" }, { value: "in", label: "Money in" }]} /></Field>
            <Field label="Contra account"><Select value={String(f.contra)} onChange={(e) => setF({ ...f, contra: +e.target.value })} options={allAccts.filter((a) => a.number !== acctNo).map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            <Field label="Amount"><Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Monthly account maintenance fee" /></Field>
          <Field label="Reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={imp} onClose={() => setImp(false)} title="Import Bank Statement"
        footer={<><Button variant="ghost" onClick={() => setImp(false)}>Cancel</Button><Button disabled={!parsed?.lines.length} onClick={submitImport}>Import{parsed?.lines.length ? ` ${parsed.lines.length} line${parsed.lines.length === 1 ? "" : "s"}` : ""}</Button></>}>
        <div className="space-y-3">
          <Field label="Statement file from your bank (CSV or OFX)">
            <input type="file" accept=".csv,.txt,.ofx,.qfx,text/csv" aria-label="Statement file" onChange={(e) => void readFile(e.target.files?.[0])}
              className="block w-full text-sm text-mist-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700" />
          </Field>
          <p className="text-sm text-mist-600">Or paste statement rows, one per line: <code className="text-xs">date, amount, description</code>. Negative amounts are money out; dates are read day first (03/09/2026 is 3 September).</p>
          <Textarea rows={8} value={impText} onChange={(e) => { setImpFile(""); setImpText(e.target.value); }} placeholder={"2026-09-01, -12500, POS terminal rental\n2026-09-03, 45000, Transfer from patient"} />
          {!parsed && impFile && <p className="rounded-lg bg-action-50 px-3 py-2 text-xs text-action-700 ring-1 ring-action-200">{impFile}</p>}
          {parsed && (parsed.error ? <p className="rounded-lg bg-action-50 px-3 py-2 text-xs text-action-700 ring-1 ring-action-200">{parsed.error}</p> : (
            <div className="rounded-lg bg-mist-50 px-3 py-2 text-xs text-mist-600 ring-1 ring-mist-200">
              <p className="font-semibold text-mist-700">
                {impFile || "Pasted rows"}: {parsed.lines.length} transaction{parsed.lines.length === 1 ? "" : "s"} — in {money(parsed.lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0))}, out {money(Math.abs(parsed.lines.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0)))}
                {parsed.skipped ? ` · ${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} left out (balances, totals or no amount)` : ""}
              </p>
              <ul className="mt-1 space-y-0.5">
                {parsed.lines.slice(0, 5).map((l, i) => <li key={i} className="flex justify-between gap-3"><span className="truncate">{shortDate(l.date)} · {l.description}</span><span className="font-mono">{money(l.amount)}</span></li>)}
                {parsed.lines.length > 5 && <li className="text-mist-400">…and {parsed.lines.length - 5} more</li>}
              </ul>
            </div>
          ))}
          <p className="text-xs text-mist-400">Imported lines appear in Reconciliation for matching against the ledger. Lines already imported for this account are skipped, so an overlapping statement is safe to import.</p>
        </div>
      </Modal>
    </div>
  );
}
