import { useMemo, useState } from "react";
import { ClipboardList, Send, Lock, Plus, Undo2, AlertTriangle, History, Timer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useWfScope } from "@/store/useWorkforceSession";
import { useHr } from "@/store/useHr";
import { shortDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export default function Timesheets() {
  const { timesheets, periods, policies, setTimesheetStatus, recallTimesheet, addManualLine, leave, overtime, requestOvertime } = useWorkforce();
  const staff = useHr((s) => s.staff);
  const scope = useWfScope();
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const policy = policies.find((p) => p.status === "Current") ?? policies[0];

  const [periodId, setPeriodId] = useState(periods[0].id);
  const visible = useMemo(
    () => timesheets.filter((t) => t.periodId === periodId && scope.inScope(t.staffId)),
    [timesheets, periodId, scope],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [lineModal, setLineModal] = useState(false);
  const [lf, setLf] = useState({ date: "", expectedHours: 7.5, workedHours: 7.5, breakHours: 0.5, overtimeHours: 0, container: "", task: "", note: "" });
  const [otModal, setOtModal] = useState(false);
  const [ot, setOt] = useState({ date: "", hours: 1, reason: "" });

  const period = periods.find((p) => p.id === periodId)!;
  const sheet = timesheets.find((t) => t.id === openId) ?? visible[0];

  const worked = (t: typeof timesheets[number]) => sum(t.lines.map((l) => l.workedHours));
  const expected = (t: typeof timesheets[number]) => sum(t.lines.map((l) => l.expectedHours));
  const variance = (t: typeof timesheets[number]) => worked(t) - expected(t);

  // submission blockers (mirrors reference gating)
  const blockers = useMemo(() => {
    if (!sheet) return [];
    const b: string[] = [];
    if (sheet.lines.length === 0) b.push("At least one time entry is required.");
    const overCap = sheet.lines.find((l) => l.workedHours > policy.maxDailyHours);
    if (overCap) b.push(`A day exceeds the ${policy.maxDailyHours}h maximum (${shortDate(overCap.date)}).`);
    return b;
  }, [sheet, policy]);

  const isOwn = sheet && sheet.staffId === scope.staffId;
  const canEdit = sheet && ((isOwn && scope.canRecordOwnTime) || scope.canConfigure);
  const sheetOt = sheet ? overtime.filter((o) => o.staffId === sheet.staffId) : [];

  return (
    <div>
      <PageHeader
        title={scope.selfOnly ? "My timesheet" : "Employee timesheets"}
        subtitle="Attendance-derived, manual and hybrid capture resolve through one reviewable weekly period."
        actions={
          <Select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            options={periods.map((p) => ({ value: p.id, label: `${p.label} (${shortDate(p.start)}–${shortDate(p.end)})` }))}
            className="w-auto"
          />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Timesheets" value={visible.length} tone="brand" icon={<ClipboardList size={18} />} />
        <StatCard label="Awaiting approval" value={visible.filter((t) => t.status === "Submitted").length} tone="amber" delay={0.05} />
        <StatCard label="Returned" value={visible.filter((t) => t.status === "Returned").length} tone={visible.some((t) => t.status === "Returned") ? "action" : "mist"} delay={0.1} />
        <StatCard label="Period" value={period.locked ? "Locked" : "Open"} tone={period.locked ? "action" : "mist"} delay={0.15} icon={<Lock size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="card h-fit p-2">
          {visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-mist-400">No timesheets in this period for your scope.</p>}
          {visible.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className={cn("mb-1 w-full rounded-xl px-3 py-2.5 text-left transition", sheet?.id === t.id ? "bg-brand-gradient text-white shadow-glow" : "hover:bg-mist-50")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{name(t.staffId)}</span>
                <Badge tone={sheet?.id === t.id ? "mist" : statusTone(t.status)}>{t.status}</Badge>
              </div>
              <span className={cn("text-[11px]", sheet?.id === t.id ? "text-white/80" : "text-mist-400")}>
                {t.captureMode} · {worked(t).toFixed(1)}h · variance {variance(t) >= 0 ? "+" : ""}{variance(t).toFixed(1)}h
              </span>
            </button>
          ))}
        </div>

        {!sheet ? (
          <div className="card grid place-items-center py-20 text-mist-400">Select a timesheet.</div>
        ) : (
          <div className="space-y-4">
            {sheet.status === "Returned" && sheet.returnNote && (
              <div className="rounded-2xl bg-action-50 px-4 py-3 text-sm text-action-700 ring-1 ring-action-200">
                <b>Returned for correction:</b> “{sheet.returnNote}” — fix the entries and resubmit; this creates version {sheet.version + 1}.
              </div>
            )}

            {(() => {
              const lv = leave.filter(
                (l) =>
                  l.staffId === sheet.staffId &&
                  l.status === "Approved" &&
                  +new Date(l.from) <= +new Date(period.end) &&
                  +new Date(l.to) >= +new Date(period.start),
              );
              return lv.length ? (
                <div className="rounded-2xl bg-brand-50 px-4 py-2.5 text-sm text-brand-700 ring-1 ring-brand-200">
                  Approved leave in this period: {lv.map((l) => `${l.type} (${l.days}d)`).join(", ")} — those days carry zero
                  expected hours and are excluded from lateness / absence.
                </div>
              ) : null;
            })()}

            {sheetOt.length > 0 && (
              <div className="rounded-2xl bg-mist-50 px-4 py-2.5 text-sm ring-1 ring-mist-200">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-mist-700"><Timer size={14} /> Overtime requests</p>
                <ul className="space-y-0.5">
                  {sheetOt.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-2 text-mist-600">
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                      <span>{shortDate(o.date)} · {o.hours}h — {o.reason}</span>
                      {o.decidedBy && <span className="text-[11px] text-mist-400">· {o.status.toLowerCase()} by {o.decidedBy}</span>}
                    </li>
                  ))}
                </ul>
                {sheetOt.some((o) => o.status === "Approved") && (
                  <p className="mt-1 text-[11px] text-brand-600">Approved overtime is added to the matching day on this timesheet.</p>
                )}
              </div>
            )}

            <div className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-mist-900">{name(sheet.staffId)}</p>
                <p className="text-xs text-mist-400">
                  {period.label} · <Badge tone="mist">{sheet.captureMode}</Badge> <Badge tone={statusTone(sheet.status)}>{sheet.status}</Badge>{" "}
                  {sheet.version > 0 && `v${sheet.version} · `}
                  {sheet.submittedAt && `submitted ${timeAgo(sheet.submittedAt)}`}
                  {sheet.approver && ` · approved by ${sheet.approver}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && sheet.captureMode !== "Attendance" && (sheet.status === "Open" || sheet.status === "Returned") && (
                  <Button variant="soft" onClick={() => { setLf({ ...lf, date: "" }); setLineModal(true); }}><Plus size={14} /> Manual line</Button>
                )}
                {isOwn && (sheet.status === "Open" || sheet.status === "Returned") && (
                  <Button disabled={blockers.length > 0} onClick={() => setTimesheetStatus(sheet.id, "Submitted", scope.name)}>
                    <Send size={14} /> {sheet.status === "Returned" ? "Resubmit" : "Submit"}
                  </Button>
                )}
                {isOwn && sheet.status === "Submitted" && (
                  <Button variant="ghost" onClick={() => recallTimesheet(sheet.id, scope.name)}><Undo2 size={14} /> Recall</Button>
                )}
                {canEdit && (sheet.status === "Open" || sheet.status === "Returned") && (
                  <Button variant="ghost" onClick={() => { setOt({ date: "", hours: 1, reason: "" }); setOtModal(true); }}><Timer size={14} /> Request overtime</Button>
                )}
                {sheet.status === "Submitted" && scope.canApprove && !isOwn && (
                  <span className="self-center text-xs text-mist-400">Decide in the Approvals queue →</span>
                )}
              </div>
            </div>

            {blockers.length > 0 && (isOwn || scope.canConfigure) && (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <p className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Submission blocked</p>
                <ul className="list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            )}

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
              {sheet.lines.length === 0 && (
                <Row><Cell className="text-mist-400">No recognised time yet.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>
              )}
            </Table>

            <div className="card flex flex-wrap justify-between gap-4 text-sm">
              {[
                ["Expected", expected(sheet)],
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

            {sheet.history.length > 0 && (
              <div className="card">
                <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><History size={15} /> Version history</h3>
                <ol className="space-y-2">
                  {sheet.history.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Badge tone={statusTone(h.status)}>{h.status}</Badge>
                      <div>
                        <p className="text-mist-700">v{h.version} · {h.by} · <span className="text-mist-400">{timeAgo(h.at)}</span></p>
                        {h.note && <p className="text-xs text-mist-500">“{h.note}”</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
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

      <Modal
        open={otModal}
        onClose={() => setOtModal(false)}
        title="Request overtime"
        footer={<><Button variant="ghost" onClick={() => setOtModal(false)}>Cancel</Button>
          <Button
            disabled={!ot.date || ot.hours <= 0 || !ot.reason.trim() || !sheet}
            onClick={() => {
              if (sheet) requestOvertime({ staffId: sheet.staffId, date: new Date(ot.date).toISOString().slice(0, 10), hours: ot.hours, reason: ot.reason.trim() });
              setOtModal(false);
            }}
          ><Timer size={14} /> Submit request</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Date worked"><Input type="date" value={ot.date} onChange={(e) => setOt({ ...ot, date: e.target.value })} /></Field>
            <Field label="Overtime hours"><Input type="number" step="0.25" min="0" value={ot.hours} onChange={(e) => setOt({ ...ot, hours: +e.target.value })} /></Field>
          </Grid>
          <Field label="Reason"><Input value={ot.reason} onChange={(e) => setOt({ ...ot, reason: e.target.value })} placeholder="Why the extra hours were needed" /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            A {scope.canApprove ? "manager" : "line manager or HR administrator"} approves this from the Approvals queue.
            Approved hours post to the matching day on this timesheet; they do not change your recorded attendance.
          </p>
        </div>
      </Modal>
    </div>
  );
}
