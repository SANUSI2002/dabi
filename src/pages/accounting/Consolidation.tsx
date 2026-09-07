import { useMemo, useState } from "react";
import { Plus, Building2, Layers, Printer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate, isoDate } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";
import { consolidate, consolidatedSummary } from "@/store/accounting/useConsolidation";

export default function Consolidation() {
  const { branches, consolidationGroups, activeBranchId, setActiveBranch, addBranch, addConsolidationGroup, trialBalance } = useLedger();
  const [groupId, setGroupId] = useState(consolidationGroups[0]?.id ?? "");
  const [asOf, setAsOf] = useState(isoDate(new Date()));
  const [newBranch, setNewBranch] = useState(false);
  const [nb, setNb] = useState({ code: "", name: "" });
  const [newGroup, setNewGroup] = useState(false);
  const [ng, setNg] = useState<{ name: string; branchIds: string[] }>({ name: "", branchIds: [] });
  const [print, setPrint] = useState(false);

  const iso = new Date(asOf + "T23:59:59Z").toISOString();
  const con = useMemo(() => consolidate(groupId, iso), [groupId, iso]);
  const summary = useMemo(() => consolidatedSummary(groupId, new Date(new Date().getUTCFullYear(), 0, 1).toISOString(), iso), [groupId, iso]);
  const group = consolidationGroups.find((g) => g.id === groupId);

  return (
    <div>
      <PageHeader title="Branches & Consolidation" subtitle="Per-entity books plus a consolidated view with intercompany balances eliminated" />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-mist-600">Posting to:</span>
          {branches.filter((b) => b.active).map((b) => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)} className={`chip ${activeBranchId === b.id ? "bg-brand-600 text-white" : "bg-mist-100 text-mist-600 ring-1 ring-mist-200"}`}>
              {b.code} · {b.name.replace("Sabi ", "")}
            </button>
          ))}
          <Button variant="soft" className="ml-auto" onClick={() => setNewBranch(true)}><Plus size={13} /> Branch</Button>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Branches" value={branches.length} tone="brand" icon={<Building2 size={18} />} />
        <StatCard label="Consolidated revenue (YTD)" value={money(summary?.revenue ?? 0)} tone="brand" delay={0.05} />
        <StatCard label="Consolidated net income" value={money(summary?.netIncome ?? 0)} tone={summary && summary.netIncome >= 0 ? "brand" : "action"} delay={0.1} />
        <StatCard label="Intercompany eliminated" value={money(con.eliminated)} tone="mist" delay={0.15} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Consolidation group"><Select value={groupId} onChange={(e) => setGroupId(e.target.value)} options={consolidationGroups.map((g) => ({ value: g.id, label: g.name }))} /></Field>
          <Field label="As at"><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
          <Button variant="soft" onClick={() => setNewGroup(true)}><Plus size={13} /> Group</Button>
          <Button variant="soft" onClick={() => setPrint(true)}><Printer size={13} /> Print</Button>
        </div>
      </Card>

      <Tabs tabs={["Consolidated Trial Balance", "Per-branch Trial Balance"]}>
        {(t) =>
          t === "Per-branch Trial Balance" ? (
            <div className="space-y-4">
              {(group?.branchIds ?? []).map((bid) => {
                const tb = trialBalance(iso, bid);
                const d = tb.reduce((n, r) => n + r.debit, 0);
                return (
                  <Card key={bid} className="p-0">
                    <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">{branches.find((b) => b.id === bid)?.name} · totals {money(d)}</p>
                    <Table columns={["No.", "Account", "Debit", "Credit"]}>
                      {tb.map((r, i) => (
                        <Row key={r.account.id} index={i}>
                          <Cell className="font-mono text-xs text-mist-500">{r.account.number}</Cell>
                          <Cell className="font-semibold">{r.account.name}</Cell>
                          <Cell className="font-mono">{r.debit > 0 ? money(r.debit) : ""}</Cell>
                          <Cell className="font-mono">{r.credit > 0 ? money(r.credit) : ""}</Cell>
                        </Row>
                      ))}
                    </Table>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-0">
              <Table columns={["Account", ...(group?.branchIds ?? []).map((b) => branches.find((x) => x.id === b)?.code ?? b), "Elim.", "Consolidated"]}>
                {con.lines.map((l, i) => (
                  <Row key={l.account.id} index={i}>
                    <Cell className="font-semibold">{l.account.number} — {l.account.name}</Cell>
                    {(group?.branchIds ?? []).map((b) => (
                      <Cell key={b} className="font-mono">{Math.abs(l.perBranch[b]) > 0.005 ? money(l.perBranch[b]) : ""}</Cell>
                    ))}
                    <Cell className="font-mono text-action-600">{Math.abs(l.eliminations) > 0.005 ? money(l.eliminations) : ""}</Cell>
                    <Cell className="font-mono font-bold">{money(l.consolidated)}</Cell>
                  </Row>
                ))}
                <Row index={con.lines.length} className="border-t-2 border-mist-300 font-bold">
                  <Cell>Totals</Cell>
                  {(group?.branchIds ?? []).map((b) => <Cell key={b} />)}
                  <Cell />
                  <Cell className="font-mono">Dr {money(con.totals.debit)} / Cr {money(con.totals.credit)}</Cell>
                </Row>
              </Table>
            </Card>
          )
        }
      </Tabs>

      <Modal open={newBranch} onClose={() => setNewBranch(false)} title="New Branch"
        footer={<><Button variant="ghost" onClick={() => setNewBranch(false)}>Cancel</Button><Button onClick={() => { addBranch(nb); setNewBranch(false); setNb({ code: "", name: "" }); }} disabled={!nb.code || !nb.name}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Code"><Input value={nb.code} onChange={(e) => setNb({ ...nb, code: e.target.value })} placeholder="e.g. AJH" /></Field>
          <Field label="Name"><Input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="Sabi Clinic — Ajah" /></Field>
        </div>
      </Modal>

      <Modal open={newGroup} onClose={() => setNewGroup(false)} title="New Consolidation Group"
        footer={<><Button variant="ghost" onClick={() => setNewGroup(false)}>Cancel</Button><Button onClick={() => { addConsolidationGroup(ng.name, ng.branchIds); setNewGroup(false); setNg({ name: "", branchIds: [] }); }} disabled={!ng.name || ng.branchIds.length < 2}>Create</Button></>}>
        <div className="space-y-3">
          <Field label="Name"><Input value={ng.name} onChange={(e) => setNg({ ...ng, name: e.target.value })} /></Field>
          <div className="space-y-1.5">
            {branches.map((b) => (
              <Checkbox key={b.id} label={b.name} checked={ng.branchIds.includes(b.id)} onChange={(e) => setNg({ ...ng, branchIds: e.target.checked ? [...ng.branchIds, b.id] : ng.branchIds.filter((x) => x !== b.id) })} />
            ))}
          </div>
        </div>
      </Modal>

      {print && (
        <PrintDoc open onClose={() => setPrint(false)} docTitle="Consolidated Trial Balance">
          <Section title={group?.name ?? "Consolidation"}>
            <Line label="As at" value={shortDate(asOf)} />
            <Line label="Entities" value={(group?.branchIds ?? []).map((b) => branches.find((x) => x.id === b)?.name).join(", ")} />
            <Line label="Intercompany eliminated" value={money(con.eliminated)} />
          </Section>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Account</th><th className="text-right">Consolidated</th></tr></thead>
            <tbody>
              {con.lines.map((l) => (
                <tr key={l.account.id} className="border-b border-mist-100"><td className="py-1.5">{l.account.number} — {l.account.name}</td><td className="text-right font-mono">{money(l.consolidated)}</td></tr>
              ))}
              <tr className="border-t-2 border-brand-600 font-bold"><td className="py-2">Totals</td><td className="text-right font-mono">Dr {money(con.totals.debit)} / Cr {money(con.totals.credit)}</td></tr>
            </tbody>
          </table>
        </PrintDoc>
      )}
    </div>
  );
}
