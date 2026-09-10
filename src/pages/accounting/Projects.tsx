import { useState } from "react";
import { Plus, FolderKanban, Clock, FileText, TrendingUp } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState, Progress, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useProjects } from "@/store/accounting/useProjects";
import { useAR } from "@/store/accounting/useAR";
import { useHr } from "@/store/useHr";
import { useLedger } from "@/store/accounting/useLedger";
import type { ProjectStatus } from "@/data/accounting/projects";

const STATUSES: ProjectStatus[] = ["Active", "On Hold", "Completed", "Cancelled"];

export default function Projects() {
  const { projects, timeEntries, addProject, updateProject, addTimeEntry, unbilledTimeOf, projectPnl } = useProjects();
  const { customers, createInvoice, issueInvoice } = useAR();
  const staff = useHr((s) => s.staff);
  const revenueAccts = useLedger((s) => s.accounts).filter((a) => a.isActive && a.type === "revenue");
  const [detail, setDetail] = useState<string | null>(null);
  const [projModal, setProjModal] = useState(false);
  const [timeModal, setTimeModal] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [pf, setPf] = useState({ code: "", name: "", customerId: "", billable: true, startDate: isoDate(new Date()), budgetAmount: 0, description: "" });
  const [tf, setTf] = useState({ staffId: staff[0]?.id ?? "", date: isoDate(new Date()), hours: 1, description: "", billable: true, rate: 15000, revenueAccount: 4000 });

  const active = projects.filter((p) => p.status === "Active");
  const totalMargin = projects.reduce((n, p) => n + projectPnl(p.id).margin, 0);
  const totalUnbilled = projects.reduce((n, p) => n + projectPnl(p.id).unbilledTime, 0);

  function billTime(projectId: string) {
    const project = projects.find((p) => p.id === projectId)!;
    if (!project.customerId) { setMsg("Attach a customer to the project before billing time."); return; }
    const ids = unbilledTimeOf(projectId).map((t) => t.id);
    if (!ids.length) { setMsg("No unbilled time on this project."); return; }
    const invId = createInvoice({ customerId: project.customerId, date: new Date().toISOString(), lines: [], projectId, timeEntryIds: ids, notes: `Time & materials — ${project.name}` });
    issueInvoice(invId);
    setMsg(`Invoiced ${ids.length} time entr${ids.length === 1 ? "y" : "ies"} against ${project.name}.`);
  }

  const dp = detail ? projects.find((p) => p.id === detail) : null;
  const pnl = detail ? projectPnl(detail) : null;

  return (
    <div>
      <PageHeader title="Projects & Job Costing" subtitle="Tag revenue and cost to a project, log billable time, and read profitability straight from the ledger"
        actions={<Button onClick={() => setProjModal(true)}><Plus size={15} /> New Project</Button>} />

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active projects" value={active.length} tone="brand" icon={<FolderKanban size={18} />} />
        <StatCard label="Total margin" value={money(totalMargin)} tone={totalMargin >= 0 ? "brand" : "action"} delay={0.05} />
        <StatCard label="Unbilled time" value={money(totalUnbilled)} tone="amber" delay={0.1} />
        <StatCard label="Time entries" value={timeEntries.length} tone="mist" delay={0.15} />
      </div>

      {projects.length === 0 ? <EmptyState title="No projects" /> : (
        <Card className="p-0">
          <Table columns={["Code", "Project", "Customer", "Status", "Revenue", "Cost", "Margin", "Budget used", ""]}>
            {projects.map((p, i) => {
              const pl = projectPnl(p.id);
              return (
                <Row key={p.id} index={i} onClick={() => setDetail(p.id)}>
                  <Cell className="font-mono text-xs">{p.code}</Cell>
                  <Cell className="font-semibold">{p.name} {!p.billable && <Badge tone="mist">non-billable</Badge>}</Cell>
                  <Cell>{customers.find((c) => c.id === p.customerId)?.name ?? "—"}</Cell>
                  <Cell><Badge tone={statusTone(p.status)}>{p.status}</Badge></Cell>
                  <Cell className="font-mono">{money(pl.revenue)}</Cell>
                  <Cell className="font-mono">{money(pl.cost)}</Cell>
                  <Cell className={`font-mono font-semibold ${pl.margin < 0 ? "text-action-600" : ""}`}>{money(pl.margin)}{pl.revenue > 0 && <span className="block text-[10px] font-normal text-mist-400">{pl.marginPct}%</span>}</Cell>
                  <Cell className="w-28">{p.budgetAmount ? <div><Progress value={pl.cost} target={p.budgetAmount} tone={pl.budgetUsedPct > 100 ? "action" : "brand"} /><span className="text-[10px] text-mist-400">{pl.budgetUsedPct}%</span></div> : "—"}</Cell>
                  <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); setTimeModal(p.id); }}><Clock size={11} /> Log time</button></Cell>
                </Row>
              );
            })}
          </Table>
        </Card>
      )}

      {/* detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={dp ? `${dp.code} — ${dp.name}` : ""} wide
        footer={dp && <>
          <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
          <Select value={dp.status} onChange={(e) => updateProject(dp.id, { status: e.target.value as ProjectStatus })} options={STATUSES} />
          {dp.billable && unbilledTimeOf(dp.id).length > 0 && <Button onClick={() => { billTime(dp.id); }}><FileText size={14} /> Bill {unbilledTimeOf(dp.id).length} time entr(ies)</Button>}
        </>}>
        {dp && pnl && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-mist-50 p-3"><div className="text-mist-400">Revenue</div><div className="font-mono font-bold">{money(pnl.revenue)}</div></div>
              <div className="rounded-lg bg-mist-50 p-3"><div className="text-mist-400">Cost</div><div className="font-mono font-bold">{money(pnl.cost)}</div></div>
              <div className="rounded-lg bg-mist-50 p-3"><div className="text-mist-400">Margin</div><div className={`font-mono font-bold ${pnl.margin < 0 ? "text-action-600" : "text-brand-700"}`}>{money(pnl.margin)} {pnl.revenue > 0 && `(${pnl.marginPct}%)`}</div></div>
            </div>
            {pnl.byAccount.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">Ledger activity tagged to this project</h4>
                <Table columns={["Account", "Type", "Amount"]}>
                  {pnl.byAccount.map((a, i) => (
                    <Row key={i} index={i}><Cell className="font-mono text-xs">{a.accountNumber}</Cell><Cell>{a.name} <Badge tone={a.kind === "revenue" ? "brand" : "mist"}>{a.kind}</Badge></Cell><Cell className="font-mono">{money(a.amount)}</Cell></Row>
                  ))}
                </Table>
              </div>
            )}
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">Time entries</h4>
              <Table columns={["Date", "Who", "Hours", "Description", "Rate", "Value", "Status"]}>
                {timeEntries.filter((t) => t.projectId === dp.id).map((t, i) => (
                  <Row key={t.id} index={i}>
                    <Cell className="whitespace-nowrap text-mist-500">{shortDate(t.date)}</Cell>
                    <Cell>{staff.find((s) => s.id === t.staffId)?.name ?? t.staffId}</Cell>
                    <Cell className="font-mono">{t.hours}</Cell>
                    <Cell className="max-w-[220px] truncate">{t.description}</Cell>
                    <Cell className="font-mono">{t.rate ? money(t.rate) : "—"}</Cell>
                    <Cell className="font-mono">{t.billable ? money(t.hours * (t.rate ?? 0)) : "—"}</Cell>
                    <Cell><Badge tone={t.status === "Invoiced" ? "brand" : t.status === "Unbilled" ? "amber" : "mist"}>{t.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </div>
          </div>
        )}
      </Modal>

      {/* new project */}
      <Modal open={projModal} onClose={() => setProjModal(false)} title="New Project"
        footer={<><Button variant="ghost" onClick={() => setProjModal(false)}>Cancel</Button><Button disabled={!pf.code || !pf.name} onClick={() => { addProject({ code: pf.code, name: pf.name, customerId: pf.customerId || undefined, billable: pf.billable, startDate: new Date(pf.startDate).toISOString(), budgetAmount: pf.budgetAmount || undefined, description: pf.description || undefined }); setProjModal(false); setPf({ ...pf, code: "", name: "", description: "" }); }}>Create</Button></>}>
        <div className="space-y-3">
          <Grid cols={2}>
            <Field label="Code"><Input value={pf.code} onChange={(e) => setPf({ ...pf, code: e.target.value })} placeholder="PRJ-003" /></Field>
            <Field label="Start date"><Input type="date" value={pf.startDate} onChange={(e) => setPf({ ...pf, startDate: e.target.value })} /></Field>
          </Grid>
          <Field label="Name"><Input value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} /></Field>
          <Grid cols={2}>
            <Field label="Customer (billable)"><Select value={pf.customerId} onChange={(e) => setPf({ ...pf, customerId: e.target.value, billable: !!e.target.value })} options={[{ value: "", label: "Internal — no customer" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Cost budget"><Input type="number" value={pf.budgetAmount || ""} onChange={(e) => setPf({ ...pf, budgetAmount: +e.target.value })} /></Field>
          </Grid>
          <Field label="Description"><Textarea value={pf.description} onChange={(e) => setPf({ ...pf, description: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* log time */}
      <Modal open={!!timeModal} onClose={() => setTimeModal(null)} title="Log Time"
        footer={<><Button variant="ghost" onClick={() => setTimeModal(null)}>Cancel</Button><Button disabled={!tf.description || tf.hours <= 0} onClick={() => { addTimeEntry({ projectId: timeModal!, staffId: tf.staffId, date: new Date(tf.date).toISOString(), hours: tf.hours, description: tf.description, billable: tf.billable, rate: tf.billable ? tf.rate : undefined, revenueAccount: tf.revenueAccount }); setTimeModal(null); setTf({ ...tf, description: "", hours: 1 }); }}>Log</Button></>}>
        <div className="space-y-3">
          <Grid cols={2}>
            <Field label="Staff"><Select value={tf.staffId} onChange={(e) => setTf({ ...tf, staffId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <Field label="Date"><Input type="date" value={tf.date} onChange={(e) => setTf({ ...tf, date: e.target.value })} /></Field>
            <Field label="Hours"><Input type="number" value={tf.hours || ""} onChange={(e) => setTf({ ...tf, hours: +e.target.value })} /></Field>
            <Field label="Billable"><Select value={tf.billable ? "yes" : "no"} onChange={(e) => setTf({ ...tf, billable: e.target.value === "yes" })} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></Field>
            {tf.billable && <Field label="Charge-out rate / hr"><Input type="number" value={tf.rate || ""} onChange={(e) => setTf({ ...tf, rate: +e.target.value })} /></Field>}
            {tf.billable && <Field label="Revenue account"><Select value={String(tf.revenueAccount)} onChange={(e) => setTf({ ...tf, revenueAccount: +e.target.value })} options={revenueAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>}
          </Grid>
          <Field label="Description"><Input value={tf.description} onChange={(e) => setTf({ ...tf, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
