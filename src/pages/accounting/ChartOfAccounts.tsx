import { useMemo, useState } from "react";
import { Plus, Archive, Pencil, Landmark } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { coaTemplates } from "@/data/accounting/coaTemplates";
import { money } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";
import { isDebitNormal, type Account, type AccountType, type AccountSubtype } from "@/data/accounting/coa";

const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  cogs: "Cost of Sales",
  expense: "Expenses",
};
const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "cogs", "expense"];

const SUBTYPES: Record<AccountType, AccountSubtype[]> = {
  asset: ["cash", "bank", "accounts_receivable", "inventory", "current_asset", "fixed_asset", "contra_asset", "other_asset"],
  liability: ["accounts_payable", "tax_payable", "current_liability", "long_term_liability"],
  equity: ["equity", "retained_earnings"],
  revenue: ["operating_revenue", "other_income", "contra_revenue"],
  cogs: ["cost_of_goods_sold"],
  expense: ["operating_expense", "payroll_expense", "depreciation_expense", "other_expense"],
};

const blankForm = { number: "", name: "", type: "expense" as AccountType, subtype: "operating_expense" as AccountSubtype, description: "", openingBalance: "", allowManualEntry: true };

export default function ChartOfAccounts() {
  const { accounts, balanceOf, addAccount, updateAccount, archiveAccount, applyCoaTemplate } = useLedger();
  const [tmplModal, setTmplModal] = useState(false);
  const [tmplChoice, setTmplChoice] = useState("");
  const asOf = new Date().toISOString();
  const [showArchived, setShowArchived] = useState(false);
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Account | null>(null);
  const [f, setF] = useState(blankForm);
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(
    () => accounts.filter((a) => showArchived || a.isActive).sort((a, b) => a.number - b.number),
    [accounts, showArchived],
  );
  const byType = (t: AccountType) => rows.filter((a) => a.type === t);

  const totals = useMemo(() => {
    const sum = (t: AccountType) => accounts.filter((a) => a.type === t).reduce((n, a) => n + balanceOf(a.number, asOf), 0);
    return { assets: sum("asset"), liabilities: sum("liability"), equity: sum("equity") };
  }, [accounts, balanceOf, asOf]);

  function submitCreate() {
    setErr(null);
    const res = addAccount({
      number: Number(f.number),
      name: f.name.trim(),
      type: f.type,
      subtype: f.subtype,
      description: f.description.trim() || undefined,
      openingBalance: Number(f.openingBalance) || 0,
      allowManualEntry: f.allowManualEntry,
    });
    if (!res.ok) return setErr(res.error ?? "Could not create account");
    setCreate(false);
    setF(blankForm);
  }

  function submitEdit() {
    if (!edit) return;
    updateAccount(edit.id, { name: f.name.trim(), description: f.description.trim() || undefined, subtype: f.subtype, allowManualEntry: f.allowManualEntry });
    setEdit(null);
  }

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        subtitle="The account structure every journal entry posts against — the backbone of the general ledger"
        actions={
          <>
            <Checkbox label="Show archived" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <Button variant="soft" onClick={() => setTmplModal(true)}>Apply template</Button>
            <Button onClick={() => { setF(blankForm); setErr(null); setCreate(true); }}><Plus size={15} /> New Account</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Assets" value={money(totals.assets)} tone="brand" icon={<Landmark size={18} />} />
        <StatCard label="Total Liabilities" value={money(totals.liabilities)} tone="action" delay={0.05} />
        <StatCard label="Total Equity" value={money(totals.equity)} tone="mist" delay={0.1} />
        <StatCard label="Accounts" value={rows.length} tone="mist" delay={0.15} />
      </div>

      <div className="space-y-6">
        {TYPE_ORDER.map((t) => {
          const list = byType(t);
          if (!list.length) return null;
          const groupTotal = list.reduce((n, a) => n + balanceOf(a.number, asOf), 0);
          return (
            <Card key={t}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-mist-500">{TYPE_LABEL[t]}</h3>
                <span className="text-sm font-bold text-mist-700">{money(groupTotal)}</span>
              </div>
              <Table columns={["No.", "Account", "Classification", "Manual", "Balance", ""]}>
                {list.map((a, i) => (
                  <Row key={a.id} index={i} className={!a.isActive ? "opacity-50" : ""}>
                    <Cell className="font-mono text-xs text-mist-500">{a.number}</Cell>
                    <Cell className="font-semibold">
                      {a.name}
                      {a.description && <span className="block text-xs font-normal text-mist-400">{a.description}</span>}
                    </Cell>
                    <Cell><Badge tone="mist">{a.subtype.replace(/_/g, " ")}</Badge></Cell>
                    <Cell>{a.allowManualEntry ? <span className="text-mist-400">—</span> : <Badge tone="amber">subledger only</Badge>}</Cell>
                    <Cell className="font-mono">
                      {money(balanceOf(a.number, asOf))}
                      <span className="ml-1 text-[10px] uppercase text-mist-400">{isDebitNormal(a) ? "Dr" : "Cr"}</span>
                    </Cell>
                    <Cell>
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => { setEdit(a); setF({ ...blankForm, name: a.name, type: a.type, subtype: a.subtype, description: a.description ?? "", allowManualEntry: a.allowManualEntry }); }}
                        >
                          <Pencil size={12} />
                        </button>
                        {a.isActive && !a.system && (
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => archiveAccount(a.id)}><Archive size={12} /></button>
                        )}
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          );
        })}
      </div>

      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="New Account"
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submitCreate} disabled={!f.number || !f.name.trim()}>Create Account</Button></>}
      >
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <Grid cols={2}>
            <Field label="Account number" hint="1xxx assets · 2xxx liabilities · 3xxx equity · 4xxx revenue · 5xxx expenses">
              <Input type="number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="e.g. 5320" />
            </Field>
            <Field label="Account name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Type">
              <Select
                value={f.type}
                onChange={(e) => { const type = e.target.value as AccountType; setF({ ...f, type, subtype: SUBTYPES[type][0] }); }}
                options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              />
            </Field>
            <Field label="Classification">
              <Select value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value as AccountSubtype })} options={SUBTYPES[f.type].map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} />
            </Field>
          </Grid>
          <Field label="Opening balance (optional)" hint="Posted into the Opening Balances journal in the account's normal direction">
            <Input type="number" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} placeholder="0.00" />
          </Field>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Checkbox label="Allow manual journal entries against this account" checked={f.allowManualEntry} onChange={(e) => setF({ ...f, allowManualEntry: e.target.checked })} />
        </div>
      </Modal>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Edit ${edit.number} — ${edit.name}` : ""}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={submitEdit}>Save</Button></>}
      >
        <div className="space-y-4">
          <Field label="Account name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Classification">
            <Select value={f.subtype} onChange={(e) => setF({ ...f, subtype: e.target.value as AccountSubtype })} options={SUBTYPES[f.type].map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} />
          </Field>
          <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Checkbox label="Allow manual journal entries against this account" checked={f.allowManualEntry} onChange={(e) => setF({ ...f, allowManualEntry: e.target.checked })} />
        </div>
      </Modal>

      <Modal open={tmplModal} onClose={() => setTmplModal(false)} title="Apply a Chart-of-Accounts Template"
        footer={<><Button variant="ghost" onClick={() => setTmplModal(false)}>Cancel</Button><Button disabled={!tmplChoice} onClick={() => { const r = applyCoaTemplate(tmplChoice); setTmplModal(false); alert(`${r.added} account(s) added, ${r.skipped} already present.`); }}>Apply</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-mist-500">Adds any accounts the template defines that you don't already have. Existing accounts and their balances are left untouched.</p>
          <Field label="Template"><Select value={tmplChoice} onChange={(e) => setTmplChoice(e.target.value)} options={[{ value: "", label: "— choose —" }, ...coaTemplates.map((t) => ({ value: t.id, label: `${t.name} · ${t.industry}` }))]} /></Field>
          {tmplChoice && <p className="rounded-lg bg-mist-50 p-3 text-sm text-mist-600">{coaTemplates.find((t) => t.id === tmplChoice)?.description}</p>}
        </div>
      </Modal>
    </div>
  );
}
