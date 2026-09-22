import { useState } from "react";
import { CheckCircle2, AlertTriangle, Play, Link2 } from "lucide-react";
import { PageHeader, Button, Badge, Card, StatCard, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useBanking } from "@/store/accounting/useBanking";
import { useLedger } from "@/store/accounting/useLedger";

export default function BankReconciliation() {
  const { accounts, reconciliations, glMovements, startReconciliation, toggleCleared, reconciliationProgress, completeReconciliation, statementLines, clearStatementLine, addStatementLineToBooks } = useBanking();
  const allAccts = useLedger((s) => s.accounts).filter((a) => a.isActive);
  const [acctNo, setAcctNo] = useState(accounts[0]?.accountNumber ?? 1010);
  const [start, setStart] = useState(false);
  const [addBooks, setAddBooks] = useState<string | null>(null);
  const [contra, setContra] = useState(5600);
  const [sf, setSf] = useState({ date: isoDate(new Date()), closing: 0 });

  const active = reconciliations.find((r) => r.accountNumber === acctNo && r.status === "In Progress");
  const progress = active ? reconciliationProgress(active.id) : null;
  const movements = active ? glMovements(acctNo, active.statementDate) : [];
  const stmtLines = statementLines.filter((l) => l.accountNumber === acctNo);

  function matchStatementLine(lineId: string) {
    const line = stmtLines.find((l) => l.id === lineId);
    if (!line || !active) return;
    // find an uncleared GL movement with the same signed amount
    const m = movements.find((mv) => Math.abs(mv.amount - line.amount) < 0.01 && !active.reconciledLineIds.includes(mv.key));
    if (m) {
      toggleCleared(active.id, m.key);
      clearStatementLine(lineId, m.entryId);
    } else {
      setAddBooks(lineId);
    }
  }

  return (
    <div>
      <PageHeader title="Bank Reconciliation" subtitle="Tick off ledger movements against the bank statement until book and bank agree" />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Account"><Select value={String(acctNo)} onChange={(e) => setAcctNo(+e.target.value)} options={accounts.map((a) => ({ value: String(a.accountNumber), label: `${a.accountName} (${a.accountNo})` }))} /></Field>
          {!active && <div className="flex items-end"><Button onClick={() => { setSf({ date: isoDate(new Date()), closing: 0 }); setStart(true); }}><Play size={15} /> Start Reconciliation</Button></div>}
        </div>
      </Card>

      {!active ? (
        reconciliations.filter((r) => r.accountNumber === acctNo).length === 0 ? (
          <EmptyState title="No reconciliation in progress" hint="Start one with the bank's statement closing balance." />
        ) : (
          <Card className="p-0">
            <Table columns={["Statement date", "Closing balance", "Status", "Completed"]}>
              {reconciliations.filter((r) => r.accountNumber === acctNo).map((r, i) => (
                <Row key={r.id} index={i}>
                  <Cell>{shortDate(r.statementDate)}</Cell>
                  <Cell className="font-mono">{money(r.closingBalance)}</Cell>
                  <Cell><Badge tone={r.status === "Reconciled" ? "brand" : "amber"}>{r.status}</Badge></Cell>
                  <Cell>{r.completedAt ? shortDate(r.completedAt) : "—"}</Cell>
                </Row>
              ))}
            </Table>
          </Card>
        )
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Statement closing" value={money(progress!.statementTarget)} tone="mist" />
            <StatCard label="Cleared per books" value={money(progress!.clearedTotal)} tone="brand" delay={0.05} />
            <StatCard label="Difference" value={money(progress!.difference)} tone={Math.abs(progress!.difference) < 0.01 ? "brand" : "action"} delay={0.1} />
            <div className="flex items-center">
              <Button className="w-full" disabled={Math.abs(progress!.difference) > 0.01} onClick={() => { const r = completeReconciliation(active.id); if (!r.ok) alert(r.error); }}>
                {Math.abs(progress!.difference) < 0.01 ? <><CheckCircle2 size={15} /> Finish</> : <><AlertTriangle size={15} /> {money(Math.abs(progress!.difference))} out</>}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-0">
              <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Ledger movements — tick when on the statement</p>
              <Table columns={["Date", "Detail", "Amount", "Cleared"]}>
                {movements.map((m, i) => (
                  <Row key={m.key} index={i}>
                    <Cell className="whitespace-nowrap text-mist-500">{shortDate(m.date)}</Cell>
                    <Cell className="max-w-[220px] truncate">{m.description || m.memo}</Cell>
                    <Cell className={`font-mono ${m.amount < 0 ? "text-action-600" : ""}`}>{money(m.amount)}</Cell>
                    <Cell><input type="checkbox" className="h-4 w-4" checked={active.reconciledLineIds.includes(m.key)} onChange={() => toggleCleared(active.id, m.key)} /></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
            <Card className="p-0">
              <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-600">Bank statement lines</p>
              {stmtLines.length === 0 ? <p className="p-4 text-sm text-mist-400">Import a statement from Bank Transactions to match line by line.</p> : (
                <Table columns={["Date", "Description", "Amount", ""]}>
                  {stmtLines.map((l, i) => (
                    <Row key={l.id} index={i} className={l.reconciled ? "opacity-50" : ""}>
                      <Cell className="whitespace-nowrap text-mist-500">{shortDate(l.date)}</Cell>
                      <Cell className="max-w-[200px] truncate">{l.description}</Cell>
                      <Cell className={`font-mono ${l.amount < 0 ? "text-action-600" : ""}`}>{money(l.amount)}</Cell>
                      <Cell>{l.reconciled ? <Badge tone="brand">matched</Badge> : <button className="btn-soft px-2 py-1 text-xs" onClick={() => matchStatementLine(l.id)}><Link2 size={11} /> Match</button>}</Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </Card>
          </div>
        </>
      )}

      <Modal open={start} onClose={() => setStart(false)} title="Start Reconciliation"
        footer={<><Button variant="ghost" onClick={() => setStart(false)}>Cancel</Button><Button onClick={() => { startReconciliation(acctNo, new Date(sf.date + "T23:59:59Z").toISOString(), sf.closing); setStart(false); }}>Begin</Button></>}>
        <div className="space-y-3">
          <Field label="Statement date"><Input type="date" value={sf.date} onChange={(e) => setSf({ ...sf, date: e.target.value })} /></Field>
          <Field label="Statement closing balance" hint="The balance the bank shows on that date"><Input type="number" value={sf.closing || ""} onChange={(e) => setSf({ ...sf, closing: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!addBooks} onClose={() => setAddBooks(null)} title="Add to books"
        footer={<><Button variant="ghost" onClick={() => setAddBooks(null)}>Cancel</Button><Button onClick={() => { if (addBooks) { const r = addStatementLineToBooks(addBooks, contra); if (!r.ok) alert(r.error); setAddBooks(null); } }}>Post & match</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-600">This statement line has no matching ledger entry. Post one now.</p>
          <Field label="Contra account"><Select value={String(contra)} onChange={(e) => setContra(+e.target.value)} options={allAccts.filter((a) => a.number !== acctNo).map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
