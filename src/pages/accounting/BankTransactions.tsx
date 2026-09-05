import { useState } from "react";
import { Plus, Upload, Receipt } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useBanking } from "@/store/accounting/useBanking";
import { useLedger } from "@/store/accounting/useLedger";

export default function BankTransactions() {
  const { accounts, glMovements, recordBankLine, importStatementLines, statementLines } = useBanking();
  const allAccts = useLedger((s) => s.accounts).filter((a) => a.isActive);
  const [acctNo, setAcctNo] = useState(accounts[0]?.accountNumber ?? 1010);
  const [entry, setEntry] = useState(false);
  const [imp, setImp] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [f, setF] = useState({ direction: "out" as "in" | "out", contra: 5600, amount: 0, date: isoDate(new Date()), description: "", reference: "" });
  const [impText, setImpText] = useState("");

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
    const lines = impText.split("\n").map((row) => row.trim()).filter(Boolean).map((row) => {
      const [date, amount, ...desc] = row.split(/[,\t]/).map((s) => s.trim());
      return { date: new Date(date).toISOString(), amount: Number(amount), description: desc.join(" ") };
    }).filter((l) => !isNaN(l.amount) && l.date !== "Invalid Date");
    if (lines.length) importStatementLines(acctNo, lines);
    setImp(false);
    setImpText("");
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
        footer={<><Button variant="ghost" onClick={() => setImp(false)}>Cancel</Button><Button onClick={submitImport}>Import</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-600">Paste statement rows, one per line: <code className="text-xs">date, amount, description</code>. Negative amounts are money out.</p>
          <Textarea rows={8} value={impText} onChange={(e) => setImpText(e.target.value)} placeholder={"2026-09-01, -12500, POS terminal rental\n2026-09-03, 45000, Transfer from patient"} />
          <p className="text-xs text-mist-400">Imported lines appear in Reconciliation for matching against the ledger.</p>
        </div>
      </Modal>
    </div>
  );
}
