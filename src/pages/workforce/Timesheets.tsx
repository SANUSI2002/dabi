import { useState } from "react";
import { ClipboardList, Send, CheckCheck, Lock, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { CURRENT_USER } from "@/data/mock";
import { useHr } from "@/store/useHr";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const name = (id: string) => useHr.getState().byId(id)?.name ?? id;
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export default function Timesheets() {
  const { timesheets, periods, setTimesheetStatus, addManualLine } = useWorkforce();
  const [periodId, setPeriodId] = useState(periods[0].id);
  const [openId, setOpenId] = useState<string | null>(timesheets[0]?.id ?? null);
  const [lineModal, setLineModal] = useState(false);
  const [lf, setLf] = useState({ date: "", expectedHours: 7.5, workedHours: 7.5, breakHours: 0.5, overtimeHours: 0, container: "", task: "", note: "" });

  const list = timesheets.filter((t) => t.periodId === periodId);
  const period = periods.find((p) => p.id === periodId)!;
  const sheet = timesheets.find((t) => t.id === openId);

  const worked = (t: (typeof timesheets)[number]) => sum(t.lines.map((l) => l.workedHours));
  const variance = (t: (typeof timesheets)[number]) => worked(t) - sum(t.lines.map((l) => l.expectedHours));

  const submitted = list.filter((t) => t.status === "Submitted");

  function bulkApprove() {
    submitted.forEach((t) => setTimesheetStatus(t.id, "Approved", CURRENT_USER.name));
  }

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Attendance-derived, manual & hybrid capture · submit → approve → lock"
        actions={
          <div className="flex items-center gap-2">
            <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)} options={periods.map((p) => ({ value: p.id, label: `${p.label} (${shortDate(p.start)}–${shortDate(p.end)})` }))} className="w-auto" />
            <Button variant="ghost" disabled={!submitted.length} onClick={bulkApprove}><CheckCheck size={15} /> Bulk approve ({submitted.length})</Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Timesheets" value={list.length} tone="brand" icon={<ClipboardList size={18} />} />
        <StatCard label="Awaiting approval" value={submitted.length} tone="amber" delay={0.05} />
        <StatCard label="Approved / Locked" value={list.filter((t) => ["Approved", "Locked"].includes(t.status)).length} tone="brand" delay={0.1} />
        <StatCard label="Period" value={period.locked ? "Locked" : "Open"} tone={period.locked ? "action" : "mist"} delay={0.15} icon={<Lock size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="card h-fit p-2">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className={cn("mb-1 w-full rounded-xl px-3 py-2.5 text-left transition", openId === t.id ? "bg-brand-gradient text-white shadow-glow" : "hover:bg-mist-50")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{name(t.staffId)}</span>
                <Badge tone={openId === t.id ? "mist" : statusTone(t.status)}>{t.status}</Badge>
              </div>
              <span className={cn("text-[11px]", openId === t.id ? "text-white/80" : "text-mist-400")}>
                {t.captureMode} · {worked(t).toFixed(1)}h worked · variance {variance(t) >= 0 ? "+" : ""}{variance(t).toFixed(1)}h
              </span>
            </button>
          ))}
        </div>

        {!sheet ? (
          <div className="card grid place-items-center py-20 text-mist-400">Select a timesheet.</div>
        ) : (
          <div className="space-y-4">
            <div className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-mist-900">{name(sheet.staffId)}</p>
                <p className="text-xs text-mist-400">
                  {period.label} · <Badge tone="mist">{sheet.captureMode}</Badge>{" "}
                  {sheet.submittedAt && `submitted ${shortDate(sheet.submittedAt)}`}
                  {sheet.approver && ` · approved by ${sheet.approver}`}
                </p>
              </div>
              <div className="flex gap-2">
                {sheet.captureMode !== "Attendance" && sheet.status === "Open" && (
                  <Button variant="soft" onClick={() => { setLf({ ...lf, date: "" }); setLineModal(true); }}><Plus size={14} /> Manual line</Button>
                )}
                {sheet.status === "Open" && (
                  <Button onClick={() => setTimesheetStatus(sheet.id, "Submitted")}><Send size={14} /> Submit</Button>
                )}
                {sheet.status === "Submitted" && (
                  <>
                    <Button variant="action" onClick={() => setTimesheetStatus(sheet.id, "Rejected")}>Reject</Button>
                    <Button onClick={() => setTimesheetStatus(sheet.id, "Approved", CURRENT_USER.name)}><CheckCheck size={14} /> Approve</Button>
                  </>
                )}
                {sheet.status === "Approved" && (
                  <Button onClick={() => setTimesheetStatus(sheet.id, "Locked", CURRENT_USER.name)}><Lock size={14} /> Lock period</Button>
                )}
              </div>
            </div>

            <Table columns={["Date", "Source", "Expected", "Worked", "Break", "Overtime", "Variance", "Work / Task"]}>
              {sheet.lines.map((l, i) => {
                const v = l.workedHours - l.expectedHours;
                return (
                  <Row key={l.id} index={i}>
                    <Cell>{shortDate(l.date)}</Cell>
                    <Cell><Badge tone={l.source === "Attendance" ? "brand" : "mist"}>{l.source}</Badge></Cell>
                    <Cell>{l.expectedHours}h</Cell>
                    <Cell className="font-semibold">{l.workedHours}h</Cell>
                    <Cell>{l.breakHours}h</Cell>
                    <Cell>{l.overtimeHours ? <Badge tone="amber">{l.overtimeHours}h</Badge> : "—"}</Cell>
                    <Cell className={v < -0.25 ? "font-semibold text-action-600" : v > 0.25 ? "text-brand-600" : "text-mist-400"}>
                      {v >= 0 ? "+" : ""}{v.toFixed(2)}h
                    </Cell>
                    <Cell className="text-mist-500">{l.container ? `${l.container}${l.task ? ` · ${l.task}` : ""}` : "—"}</Cell>
                  </Row>
                );
              })}
            </Table>

            <div className="card flex flex-wrap justify-between gap-4 text-sm">
              {[
                ["Expected", sum(sheet.lines.map((l) => l.expectedHours))],
                ["Worked", worked(sheet)],
                ["Break", sum(sheet.lines.map((l) => l.breakHours))],
                ["Overtime", sum(sheet.lines.map((l) => l.overtimeHours))],
                ["Variance", variance(sheet)],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-[11px] font-bold uppercase text-mist-400">{k}</p>
                  <p className="font-display text-xl font-bold text-mist-900">{(v as number).toFixed(2)}h</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={lineModal}
        onClose={() => setLineModal(false)}
        title="Add Manual Timesheet Line"
        wide
        footer={<><Button variant="ghost" onClick={() => setLineModal(false)}>Cancel</Button>
          <Button disabled={!lf.date || !sheet} onClick={() => { if (sheet) addManualLine(sheet.id, { ...lf, date: new Date(lf.date).toISOString().slice(0, 10), source: "Manual" }); setLineModal(false); }}>Add Line</Button></>}
      >
        <Grid cols={3}>
          <Field label="Date"><Input type="date" value={lf.date} onChange={(e) => setLf({ ...lf, date: e.target.value })} /></Field>
          <Field label="Expected hours"><Input type="number" step="0.25" value={lf.expectedHours} onChange={(e) => setLf({ ...lf, expectedHours: +e.target.value })} /></Field>
          <Field label="Worked hours"><Input type="number" step="0.25" value={lf.workedHours} onChange={(e) => setLf({ ...lf, workedHours: +e.target.value })} /></Field>
          <Field label="Break hours"><Input type="number" step="0.25" value={lf.breakHours} onChange={(e) => setLf({ ...lf, breakHours: +e.target.value })} /></Field>
          <Field label="Overtime hours"><Input type="number" step="0.25" value={lf.overtimeHours} onChange={(e) => setLf({ ...lf, overtimeHours: +e.target.value })} /></Field>
          <Field label="Work container"><Input value={lf.container} onChange={(e) => setLf({ ...lf, container: e.target.value })} placeholder="e.g. Maternity Programme" /></Field>
          <Field label="Task"><Input value={lf.task} onChange={(e) => setLf({ ...lf, task: e.target.value })} /></Field>
          <Field label="Note"><Input value={lf.note} onChange={(e) => setLf({ ...lf, note: e.target.value })} /></Field>
        </Grid>
      </Modal>
    </div>
  );
}
