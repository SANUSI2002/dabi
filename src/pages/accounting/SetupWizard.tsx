import { useState } from "react";
import { Check, ChevronRight, Building, CalendarRange, ListTree, Scale, Landmark } from "lucide-react";
import { PageHeader, Button, Card, Badge } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { money } from "@/lib/format";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { useLedger } from "@/store/accounting/useLedger";
import { coaTemplates } from "@/data/accounting/coaTemplates";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STEPS = [
  { key: "company", label: "Company", icon: Building },
  { key: "fiscal", label: "Fiscal calendar", icon: CalendarRange },
  { key: "chart", label: "Chart of accounts", icon: ListTree },
  { key: "opening", label: "Opening balances", icon: Landmark },
  { key: "tax", label: "Tax registration", icon: Scale },
];

export default function SetupWizard() {
  const { org, updateOrg, taxRegistration, updateTaxRegistration, setup, markSetupStep } = useAccountingSettings();
  const { accounts, booksLockedBefore, setBooksLockedBefore, applyCoaTemplate, postJournal } = useLedger();
  const [step, setStep] = useState(0);
  const [orgForm, setOrgForm] = useState(org);
  const [taxForm, setTaxForm] = useState(taxRegistration);
  const [tmpl, setTmpl] = useState("");
  const [lock, setLock] = useState(booksLockedBefore ? booksLockedBefore.slice(0, 10) : "2026-01-01");
  const [ob, setOb] = useState<{ accountNumber: number; amount: number }[]>([{ accountNumber: 1010, amount: 0 }]);
  const [msg, setMsg] = useState<string | null>(null);

  const cur = STEPS[step];
  const done = setup.steps;
  const completeCount = STEPS.filter((s) => done[s.key]).length;

  function finishStep(extra?: () => void) {
    extra?.();
    markSetupStep(cur.key, true);
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  return (
    <div>
      <PageHeader title="Accounting Setup" subtitle={`Guided first-run configuration — ${completeCount} of ${STEPS.length} steps done`} />

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-max p-2">
          {STEPS.map((s, i) => (
            <button key={s.key} onClick={() => setStep(i)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === step ? "bg-brand-50 font-semibold text-brand-700" : "text-mist-600 hover:bg-mist-50"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${done[s.key] ? "bg-brand-600 text-white" : "bg-mist-200 text-mist-500"}`}>{done[s.key] ? <Check size={12} /> : i + 1}</span>
              {s.label}
            </button>
          ))}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2"><cur.icon size={18} className="text-brand-600" /><h3 className="font-display text-lg font-bold">{cur.label}</h3>{done[cur.key] && <Badge tone="brand">done</Badge>}</div>

          {cur.key === "company" && (
            <div className="space-y-3">
              <Grid cols={2}>
                <Field label="Legal name"><Input value={orgForm.legalName} onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })} /></Field>
                <Field label="Trading name"><Input value={orgForm.tradingName} onChange={(e) => setOrgForm({ ...orgForm, tradingName: e.target.value })} /></Field>
                <Field label="Tax ID (TIN)"><Input value={orgForm.tin} onChange={(e) => setOrgForm({ ...orgForm, tin: e.target.value })} /></Field>
                <Field label="RC number"><Input value={orgForm.rcNumber} onChange={(e) => setOrgForm({ ...orgForm, rcNumber: e.target.value })} /></Field>
              </Grid>
              <Field label="Registered address"><Textarea value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} /></Field>
              <div className="flex justify-end"><Button onClick={() => finishStep(() => updateOrg(orgForm))}>Save & continue <ChevronRight size={14} /></Button></div>
            </div>
          )}

          {cur.key === "fiscal" && (
            <div className="space-y-3">
              <Field label="Fiscal year starts in"><Select value={String(orgForm.fiscalYearStartMonth)} onChange={(e) => setOrgForm({ ...orgForm, fiscalYearStartMonth: +e.target.value })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} /></Field>
              <Field label="Lock the books before" hint="Nothing can be posted or edited on a date earlier than this"><Input type="date" value={lock} onChange={(e) => setLock(e.target.value)} /></Field>
              <div className="flex justify-end"><Button onClick={() => finishStep(() => { updateOrg({ fiscalYearStartMonth: orgForm.fiscalYearStartMonth }); setBooksLockedBefore(new Date(lock + "T00:00:00Z").toISOString()); })}>Save & continue <ChevronRight size={14} /></Button></div>
            </div>
          )}

          {cur.key === "chart" && (
            <div className="space-y-3">
              <p className="text-sm text-mist-500">Your ledger has {accounts.length} accounts. Apply an industry template to add any it's missing — existing accounts and balances are untouched.</p>
              <Field label="Template"><Select value={tmpl} onChange={(e) => setTmpl(e.target.value)} options={[{ value: "", label: "— choose —" }, ...coaTemplates.map((t) => ({ value: t.id, label: `${t.name} · ${t.industry}` }))]} /></Field>
              {tmpl && <p className="rounded-lg bg-mist-50 p-3 text-sm text-mist-600">{coaTemplates.find((t) => t.id === tmpl)?.description}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="soft" onClick={() => finishStep()}>Keep current chart</Button>
                <Button disabled={!tmpl} onClick={() => { const r = applyCoaTemplate(tmpl); setMsg(`${r.added} account(s) added, ${r.skipped} already present.`); finishStep(); }}>Apply template <ChevronRight size={14} /></Button>
              </div>
            </div>
          )}

          {cur.key === "opening" && (
            <div className="space-y-3">
              <p className="text-sm text-mist-500">Enter balances as at the lock date. The other side of every line goes to Opening Balance Equity (3900); post once the totals look right.</p>
              {ob.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_28px] items-end gap-2">
                  <Field label="Account"><Select value={String(row.accountNumber)} onChange={(e) => setOb(ob.map((r, j) => (j === i ? { ...r, accountNumber: +e.target.value } : r)))} options={accounts.filter((a) => a.allowManualEntry).map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
                  <Field label="Balance"><Input type="number" value={row.amount || ""} onChange={(e) => setOb(ob.map((r, j) => (j === i ? { ...r, amount: +e.target.value } : r)))} /></Field>
                  <button className="mb-2 text-action-500" onClick={() => setOb(ob.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <Button variant="soft" onClick={() => setOb([...ob, { accountNumber: 1000, amount: 0 }])}>Add line</Button>
              <div className="flex items-center justify-between border-t border-mist-200 pt-2 text-sm">
                <span className="text-mist-500">Total to Opening Balance Equity</span>
                <span className="font-mono font-bold">{money(ob.reduce((n, r) => n + r.amount, 0))}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="soft" onClick={() => finishStep()}>Skip — balances already loaded</Button>
                <Button disabled={ob.every((r) => r.amount === 0)} onClick={() => {
                  const lines = ob.filter((r) => r.amount !== 0).flatMap((r) => {
                    const acct = accounts.find((a) => a.number === r.accountNumber);
                    const debitNormal = acct?.type === "asset" || acct?.type === "expense" || acct?.type === "cogs";
                    return debitNormal
                      ? [{ accountNumber: r.accountNumber, debit: r.amount, credit: 0 }, { accountNumber: 3900, debit: 0, credit: r.amount }]
                      : [{ accountNumber: 3900, debit: r.amount, credit: 0 }, { accountNumber: r.accountNumber, debit: 0, credit: r.amount }];
                  });
                  const res = postJournal({ date: new Date(lock + "T00:00:00Z").toISOString(), source: "Opening Balance", memo: "Opening balances — setup wizard", lines });
                  setMsg(res.ok ? "Opening balance journal posted." : (res.error ?? "Could not post."));
                  if (res.ok) finishStep();
                }}>Post opening balances <ChevronRight size={14} /></Button>
              </div>
            </div>
          )}

          {cur.key === "tax" && (
            <div className="space-y-3">
              <Grid cols={2}>
                <Field label="VAT registered"><Select value={taxForm.vatRegistered ? "yes" : "no"} onChange={(e) => setTaxForm({ ...taxForm, vatRegistered: e.target.value === "yes" })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></Field>
                <Field label="VAT TIN"><Input value={taxForm.vatTin} onChange={(e) => setTaxForm({ ...taxForm, vatTin: e.target.value })} /></Field>
                <Field label="Operate WHT"><Select value={taxForm.wht ? "yes" : "no"} onChange={(e) => setTaxForm({ ...taxForm, wht: e.target.value === "yes" })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></Field>
                <Field label="State PAYE ID"><Input value={taxForm.payeStateId} onChange={(e) => setTaxForm({ ...taxForm, payeStateId: e.target.value })} /></Field>
              </Grid>
              <div className="flex justify-end"><Button onClick={() => finishStep(() => { updateTaxRegistration(taxForm); setMsg("Setup complete — the Accounting module is ready."); })}>Finish setup <Check size={14} /></Button></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
