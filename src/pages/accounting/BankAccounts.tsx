import { useState } from "react";
import { Plus, Landmark, ArrowRightLeft } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { money } from "@/lib/format";
import { useBanking } from "@/store/accounting/useBanking";
import { useLedger } from "@/store/accounting/useLedger";

const blank = { number: "", name: "", bankName: "", accountName: "", accountNo: "", currency: "NGN", subtype: "bank" as "bank" | "cash", openingBalance: 0 };

export default function BankAccounts() {
  const { accounts, addBankAccount, bookBalance, recordTransfer } = useBanking();
  const fxRates = useLedger((s) => s.fxRates);
  const [create, setCreate] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [f, setF] = useState(blank);
  const [tf, setTf] = useState({ from: accounts[0]?.accountNumber ?? 1010, to: accounts[1]?.accountNumber ?? 1000, amount: 0, date: new Date().toISOString().slice(0, 10), reference: "" });
  const [err, setErr] = useState<string | null>(null);

  const asOf = new Date().toISOString();
  const totalCash = accounts.reduce((n, a) => n + bookBalance(a.accountNumber, asOf), 0);

  function submitCreate() {
    setErr(null);
    const r = addBankAccount({ number: Number(f.number), name: f.name.trim(), bankName: f.bankName, accountName: f.accountName, accountNo: f.accountNo, currency: f.currency, subtype: f.subtype, openingBalance: f.openingBalance });
    if (!r.ok) return setErr(r.error ?? "Could not add");
    setCreate(false);
    setF(blank);
  }
  function submitTransfer() {
    setErr(null);
    const r = recordTransfer({ fromAccount: tf.from, toAccount: tf.to, amount: tf.amount, date: new Date(tf.date + "T12:00:00Z").toISOString(), reference: tf.reference || undefined });
    if (!r.ok) return setErr(r.error ?? "Could not transfer");
    setTransfer(false);
  }

  return (
    <div>
      <PageHeader title="Bank Accounts" subtitle="Cash and bank balances straight from the ledger"
        actions={<>
          <Button variant="soft" onClick={() => { setErr(null); setTransfer(true); }}><ArrowRightLeft size={15} /> Transfer</Button>
          <Button onClick={() => { setErr(null); setF(blank); setCreate(true); }}><Plus size={15} /> New Account</Button>
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Accounts" value={accounts.length} tone="brand" icon={<Landmark size={18} />} />
        <StatCard label="Total cash & bank" value={money(totalCash)} tone="brand" delay={0.05} />
        <StatCard label="Currencies" value={new Set(accounts.map((a) => a.currency)).size} tone="mist" delay={0.1} />
      </div>

      <Card className="p-0">
        <Table columns={["Account", "Bank", "Number", "GL", "Currency", "Book balance"]}>
          {accounts.map((a, i) => (
            <Row key={a.id} index={i}>
              <Cell className="font-semibold">{a.accountName}</Cell>
              <Cell>{a.bankName}</Cell>
              <Cell className="font-mono text-xs">{a.accountNo}</Cell>
              <Cell className="font-mono text-xs text-mist-500">{a.accountNumber}</Cell>
              <Cell><Badge tone="mist">{a.currency}</Badge></Cell>
              <Cell className="font-mono font-semibold">{money(bookBalance(a.accountNumber, asOf))}</Cell>
            </Row>
          ))}
        </Table>
      </Card>

      <Modal open={create} onClose={() => setCreate(false)} title="New Bank Account"
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submitCreate} disabled={!f.number || !f.name.trim()}>Add</Button></>}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <Grid cols={2}>
            <Field label="GL account number" hint="1000–1099"><Input type="number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="e.g. 1030" /></Field>
            <Field label="GL account name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Bank — Payroll Account" /></Field>
            <Field label="Bank name"><Input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></Field>
            <Field label="Account name"><Input value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} /></Field>
            <Field label="Account number"><Input value={f.accountNo} onChange={(e) => setF({ ...f, accountNo: e.target.value })} /></Field>
            <Field label="Currency"><Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} options={fxRates.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }))} /></Field>
            <Field label="Type"><Select value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value as never })} options={[{ value: "bank", label: "Bank" }, { value: "cash", label: "Cash / till" }]} /></Field>
            <Field label="Opening balance"><Input type="number" value={f.openingBalance || ""} onChange={(e) => setF({ ...f, openingBalance: +e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>

      <Modal open={transfer} onClose={() => setTransfer(false)} title="Bank Transfer"
        footer={<><Button variant="ghost" onClick={() => setTransfer(false)}>Cancel</Button><Button onClick={submitTransfer} disabled={tf.amount <= 0}>Post transfer</Button></>}>
        <div className="space-y-3">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <Grid cols={2}>
            <Field label="From"><Select value={String(tf.from)} onChange={(e) => setTf({ ...tf, from: +e.target.value })} options={accounts.map((a) => ({ value: String(a.accountNumber), label: a.accountName }))} /></Field>
            <Field label="To"><Select value={String(tf.to)} onChange={(e) => setTf({ ...tf, to: +e.target.value })} options={accounts.map((a) => ({ value: String(a.accountNumber), label: a.accountName }))} /></Field>
            <Field label="Amount"><Input type="number" value={tf.amount || ""} onChange={(e) => setTf({ ...tf, amount: +e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={tf.date} onChange={(e) => setTf({ ...tf, date: e.target.value })} /></Field>
          </Grid>
          <Field label="Reference"><Input value={tf.reference} onChange={(e) => setTf({ ...tf, reference: e.target.value })} /></Field>
          <p className="text-xs text-mist-400">Posts Dr destination / Cr source.</p>
        </div>
      </Modal>
    </div>
  );
}
