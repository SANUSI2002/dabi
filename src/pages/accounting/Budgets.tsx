import { useMemo, useState } from "react";
import { Plus, PiggyBank } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, Progress, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, isoDate } from "@/lib/format";
import { useBudgets } from "@/store/accounting/useBudgets";
import { useLedger } from "@/store/accounting/useLedger";
import { useForecast } from "@/store/accounting/useForecast";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Budgets() {
  const { budgets, costCentres, createBudget, setBudgetStatus, upsertLine, removeLine, addCostCentre, toggleCostCentre, budgetVsActual } = useBudgets();
  const accounts = useLedger((s) => s.accounts).filter((a) => a.type === "revenue" || a.type === "expense" || a.type === "cogs");
  const [budgetId, setBudgetId] = useState(budgets[0]?.id ?? "");
  const [through, setThrough] = useState(new Date().getUTCMonth() + 1);
  const [newBudget, setNewBudget] = useState(false);
  const [nb, setNb] = useState({ name: "", year: 2027, copyFromId: "", adjustPct: 0 });
  const { scenarios, addScenario, seedLinesFromLedger, project } = useForecast();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const [newScenario, setNewScenario] = useState(false);
  const [ns, setNs] = useState({ name: "", startPeriod: isoDate(new Date()).slice(0, 7), months: 6 });
  const [lineModal, setLineModal] = useState(false);
  const [lf, setLf] = useState({ accountNumber: 5100, costCentreId: "", annual: 0 });
  const [ccModal, setCcModal] = useState(false);
  const [cc, setCc] = useState({ code: "", name: "" });

  const budget = budgets.find((b) => b.id === budgetId);
  const bva = useMemo(() => (budget ? budgetVsActual(budget.id, through) : { rows: [], totals: { budgeted: 0, actual: 0 } }), [budget, through, budgetVsActual]);
  const favourableCount = bva.rows.filter((r) => r.favourable).length;

  return (
    <div>
      <PageHeader title="Budgets & Forecasts" subtitle="Plan by account and cost centre, roll forward year to year, and project the months ahead"
        actions={<Button onClick={() => setNewBudget(true)}><Plus size={15} /> New Budget</Button>} />

      <Tabs tabs={["Budget vs Actual", "Forecast", "Cost Centres"]}>
        {(t) => {
          if (t === "Forecast") {
            const sc = scenarios.find((x) => x.id === scenarioId);
            const proj = sc ? project(sc.id) : null;
            return (
              <div>
                <Card className="mb-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Scenario"><Select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} options={scenarios.map((x) => ({ value: x.id, label: x.name }))} /></Field>
                    <Button variant="soft" onClick={() => { setNs({ name: "", startPeriod: isoDate(new Date()).slice(0, 7), months: 6 }); setNewScenario(true); }}><Plus size={13} /> New Scenario</Button>
                  </div>
                </Card>
                {!proj || proj.rows.length === 0 ? <EmptyState title="No forecast lines" /> : (
                  <>
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <StatCard label="Projected total" value={money(proj.totals.projected)} tone="mist" />
                      <StatCard label="Actual so far" value={money(proj.totals.actual)} tone="brand" delay={0.05} />
                      <StatCard label="Horizon" value={`${sc!.months} mo`} tone="mist" delay={0.1} />
                    </div>
                    <Card className="p-0 overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">Budget forecast by account and month, with actuals and variance for closed months</caption>
                        <thead className="border-b border-mist-200 bg-mist-50/70"><tr>
                          <th scope="col" className="th text-left">Account</th>
                          {proj.periods.map((p) => <th key={p} scope="col" className="th text-right">{p.slice(2)}</th>)}
                          <th scope="col" className="th text-right">Total</th>
                        </tr></thead>
                        <tbody className="divide-y divide-mist-100">
                          {proj.rows.map((r) => (
                            <tr key={r.accountNumber}>
                              <th scope="row" className="td text-left font-semibold">{r.accountNumber} — {r.accountName}</th>
                              {r.cells.map((c, i) => (
                                <td key={i} className="td text-right font-mono">
                                  <div>{money(c.projected)}</div>
                                  {c.actual !== null && <div className={`text-[10px] ${(c.variance ?? 0) >= 0 ? "text-brand-600" : "text-action-600"}`}>act {money(c.actual)}</div>}
                                </td>
                              ))}
                              <td className="td text-right font-mono font-bold">{money(r.projectedTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                    <p className="mt-2 text-xs text-mist-400">Projected = base x (1 + growth%)^month. "act" shows the ledger actual for closed months and its variance.</p>
                  </>
                )}
              </div>
            );
          }
          return (<>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <Field label="Budget"><Select value={budgetId} onChange={(e) => setBudgetId(e.target.value)} options={budgets.map((b) => ({ value: b.id, label: `${b.name} · FY${b.fiscalYear} (${b.status})` }))} /></Field>
          <Field label="Through month"><Select value={String(through)} onChange={(e) => setThrough(+e.target.value)} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} /></Field>
          {budget && <div className="flex items-end gap-2">
            <Button variant="soft" onClick={() => { setLf({ accountNumber: 5100, costCentreId: "", annual: 0 }); setLineModal(true); }}><Plus size={13} /> Line</Button>
            {budget.status === "Draft" && <Button variant="soft" onClick={() => setBudgetStatus(budget.id, "Active")}>Activate</Button>}
          </div>}
        </div>
      </Card>
      {t === "Cost Centres" ? (
            <Card className="p-0">
              <div className="flex justify-end p-3"><Button variant="soft" onClick={() => setCcModal(true)}><Plus size={13} /> Cost Centre</Button></div>
              <Table columns={["Code", "Name", "Active"]}>
                {costCentres.map((c, i) => (
                  <Row key={c.id} index={i}>
                    <Cell className="font-mono text-xs">{c.code}</Cell>
                    <Cell className="font-semibold">{c.name}</Cell>
                    <Cell><button onClick={() => toggleCostCentre(c.id)}><Badge tone={c.active ? "brand" : "mist"}>{c.active ? "Active" : "Off"}</Badge></button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          ) : !budget || bva.rows.length === 0 ? (
            <EmptyState title="No budget lines" hint="Add lines by account and cost centre." />
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Budgeted (YTD)" value={money(bva.totals.budgeted)} tone="mist" icon={<PiggyBank size={18} />} />
                <StatCard label="Actual (YTD)" value={money(bva.totals.actual)} tone="brand" delay={0.05} />
                <StatCard label="Lines on target" value={`${favourableCount}/${bva.rows.length}`} tone="brand" delay={0.1} />
                <StatCard label="Cost centres" value={costCentres.filter((c) => c.active).length} tone="mist" delay={0.15} />
              </div>
              <Card className="p-0">
                <Table columns={["Account", "Cost centre", "Budget (YTD)", "Actual (YTD)", "Variance", "Use", ""]}>
                  {bva.rows.map((r, i) => {
                    const line = budget.lines.find((l) => l.accountNumber === r.accountNumber && l.costCentreId === r.costCentreId);
                    return (
                      <Row key={`${r.accountNumber}-${r.costCentreId}`} index={i}>
                        <Cell className="font-semibold">{r.accountNumber} — {r.accountName}</Cell>
                        <Cell>{costCentres.find((c) => c.id === r.costCentreId)?.code ?? "—"}</Cell>
                        <Cell className="font-mono">{money(r.budgeted)}</Cell>
                        <Cell className="font-mono">{money(r.actual)}</Cell>
                        <Cell className={`font-mono font-semibold ${r.favourable ? "text-brand-700" : "text-action-600"}`}>{r.favourable ? "" : "-"}{money(Math.abs(r.variance))}</Cell>
                        <Cell className="w-28"><Progress value={r.actual} target={r.budgeted} tone={r.favourable ? "brand" : "action"} /></Cell>
                        <Cell>{line && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => removeLine(budget.id, line.id)}>×</button>}</Cell>
                      </Row>
                    );
                  })}
                </Table>
              </Card>
            </>
          )}
          </>);
        }}
      </Tabs>

      <Modal open={newBudget} onClose={() => setNewBudget(false)} title="New Budget"
        footer={<><Button variant="ghost" onClick={() => setNewBudget(false)}>Cancel</Button><Button onClick={() => { const id = createBudget(nb.name || "Untitled Budget", nb.year, nb.copyFromId ? { copyFromId: nb.copyFromId, adjustPct: nb.adjustPct } : undefined); setBudgetId(id); setNewBudget(false); }} disabled={!nb.name}>Create</Button></>}>
        <div className="space-y-3">
          <Field label="Name"><Input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="FY2027 Operating Budget" /></Field>
          <Field label="Fiscal year"><Input type="number" value={nb.year} onChange={(e) => setNb({ ...nb, year: +e.target.value })} /></Field>
          <Field label="Copy lines from"><Select value={nb.copyFromId} onChange={(e) => setNb({ ...nb, copyFromId: e.target.value })} options={[{ value: "", label: "Start blank" }, ...budgets.map((b) => ({ value: b.id, label: `${b.name} · FY${b.fiscalYear}` }))]} /></Field>
          {nb.copyFromId && <Field label="Adjust every line by %" hint="e.g. 8 for +8% inflation"><Input type="number" value={nb.adjustPct || ""} onChange={(e) => setNb({ ...nb, adjustPct: +e.target.value })} /></Field>}
        </div>
      </Modal>

      <Modal open={newScenario} onClose={() => setNewScenario(false)} title="New Forecast Scenario"
        footer={<><Button variant="ghost" onClick={() => setNewScenario(false)}>Cancel</Button><Button disabled={!ns.name} onClick={() => { const id = addScenario({ name: ns.name, basis: "Last 3 months average", startPeriod: ns.startPeriod, months: ns.months, lines: seedLinesFromLedger(ns.startPeriod) }); setScenarioId(id); setNewScenario(false); }}>Create</Button></>}>
        <div className="space-y-3">
          <Field label="Name"><Input value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="FY2027 — aggressive growth" /></Field>
          <Field label="Start month"><Input type="month" value={ns.startPeriod} onChange={(e) => setNs({ ...ns, startPeriod: e.target.value })} /></Field>
          <Field label="Horizon (months)"><Input type="number" value={ns.months} onChange={(e) => setNs({ ...ns, months: +e.target.value })} /></Field>
          <p className="text-xs text-mist-400">Lines are seeded from the last 3 months' actual activity per revenue/expense account; set growth rates and per-month overrides after.</p>
        </div>
      </Modal>

      <Modal open={lineModal} onClose={() => setLineModal(false)} title="Add Budget Line"
        footer={<><Button variant="ghost" onClick={() => setLineModal(false)}>Cancel</Button><Button onClick={() => { if (budget) upsertLine(budget.id, { accountNumber: lf.accountNumber, costCentreId: lf.costCentreId || undefined, monthly: Array.from({ length: 12 }, () => Math.round(lf.annual / 12)) }); setLineModal(false); }}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Account"><Select value={String(lf.accountNumber)} onChange={(e) => setLf({ ...lf, accountNumber: +e.target.value })} options={accounts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          <Field label="Cost centre"><Select value={lf.costCentreId} onChange={(e) => setLf({ ...lf, costCentreId: e.target.value })} options={[{ value: "", label: "None" }, ...costCentres.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          <Field label="Annual amount" hint="Spread evenly across 12 months"><Input type="number" value={lf.annual || ""} onChange={(e) => setLf({ ...lf, annual: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={ccModal} onClose={() => setCcModal(false)} title="New Cost Centre"
        footer={<><Button variant="ghost" onClick={() => setCcModal(false)}>Cancel</Button><Button onClick={() => { addCostCentre(cc.code, cc.name); setCcModal(false); setCc({ code: "", name: "" }); }} disabled={!cc.code || !cc.name}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Code"><Input value={cc.code} onChange={(e) => setCc({ ...cc, code: e.target.value })} placeholder="e.g. THT" /></Field>
          <Field label="Name"><Input value={cc.name} onChange={(e) => setCc({ ...cc, name: e.target.value })} placeholder="Theatre" /></Field>
        </div>
      </Modal>
    </div>
  );
}
