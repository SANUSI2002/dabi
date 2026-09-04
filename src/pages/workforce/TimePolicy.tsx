import { useState } from "react";
import { SlidersHorizontal, Plus, ShieldAlert, Power } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useWfScope } from "@/store/useWorkforceSession";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const PRECEDENCE = [
  "Employee Override", "Schedule Assignment", "Primary Timesheet Group",
  "Primary Payroll Group", "Grade", "Contract Type", "Department", "Location / Branch", "Tenant Default",
];

export default function TimePolicy() {
  const { policies, enrolments, breakRules, capabilities, attendanceRules, addPolicy, toggleCapability } = useWorkforce();
  const scope = useWfScope();
  const [open, setOpen] = useState(false);
  const [pf, setPf] = useState({
    scope: "", periodType: "Weekly" as const, captureDefault: "Hybrid" as const,
    incrementMins: 15, rounding: "Nearest 15" as const, submissionDeadlineDays: 2, approvalDeadlineDays: 3,
    lateGraceMins: 10, earlyLeaveGraceMins: 10, absenceThresholdMins: 240, maxDailyHours: 14,
    allowEditDerived: true, overtimeEnabled: true, effectiveFrom: "",
  });

  const rw = scope.canConfigure;

  function saveVersion() {
    addPolicy({
      scope: pf.scope,
      effectiveFrom: new Date(pf.effectiveFrom).toISOString(),
      periodType: pf.periodType,
      captureDefault: pf.captureDefault,
      incrementMins: pf.incrementMins,
      rounding: pf.rounding,
      submissionDeadlineDays: pf.submissionDeadlineDays,
      approvalDeadlineDays: pf.approvalDeadlineDays,
      lateGraceMins: pf.lateGraceMins,
      earlyLeaveGraceMins: pf.earlyLeaveGraceMins,
      absenceThresholdMins: pf.absenceThresholdMins,
      maxDailyHours: pf.maxDailyHours,
      allowEditDerived: pf.allowEditDerived,
      overtimeEnabled: pf.overtimeEnabled,
    });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Workforce time settings"
        subtitle="Tenant-level policy, enrolment, breaks and attendance rules with effective dates and audit history."
        actions={rw ? <Button onClick={() => setOpen(true)}><Plus size={15} /> New policy version</Button> : undefined}
      />

      {!rw && (
        <div className="card mb-5 flex items-center gap-3 text-sm text-mist-500">
          <ShieldAlert size={18} className="text-amber-500" />
          Read-only — only the Tenant HR Administrator persona can change tenant time settings.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Policy versions" value={policies.length} tone="brand" icon={<SlidersHorizontal size={18} />} />
        <StatCard label="Current" value={policies.filter((p) => p.status === "Current").length} tone="brand" delay={0.05} />
        <StatCard label="Enrolments" value={enrolments.length} tone="mist" delay={0.1} />
        <StatCard label="Employees covered" value={enrolments.reduce((n, e) => n + e.count, 0)} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Policies", "Breaks", "Attendance rules", "Enrolment", "Capabilities", "Resolution precedence"]}>
        {(t) =>
          t === "Policies" ? (
            <div className="space-y-3">
              {policies.map((p) => (
                <div key={p.id} className="card">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-mist-900">{p.scope}</p>
                      <p className="text-[11px] text-mist-400">
                        Effective {shortDate(p.effectiveFrom)}{p.effectiveTo ? ` – ${shortDate(p.effectiveTo)}` : " (open)"}
                      </p>
                    </div>
                    <Badge tone={p.status === "Current" ? "brand" : p.status === "Future" ? "amber" : "mist"}>{p.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3">
                    {[
                      ["Period", p.periodType], ["Capture default", p.captureDefault],
                      ["Increment", `${p.incrementMins} min`], ["Rounding", p.rounding],
                      ["Submission deadline", `${p.submissionDeadlineDays} d`], ["Approval deadline", `${p.approvalDeadlineDays} d`],
                      ["Late grace", `${p.lateGraceMins} min`], ["Early-leave grace", `${p.earlyLeaveGraceMins} min`],
                      ["Absence threshold", `${p.absenceThresholdMins} min`], ["Max daily hours", `${p.maxDailyHours} h`],
                      ["Edit derived time", p.allowEditDerived ? "Allowed" : "Blocked"], ["Overtime", p.overtimeEnabled ? "Enabled" : "Disabled"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-dashed border-mist-100 py-1">
                        <span className="text-mist-400">{k}</span>
                        <span className="font-medium text-mist-800">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : t === "Breaks" ? (
            <div className="space-y-3">
              <p className="text-sm text-mist-500">
                Break rules resolve by scheduled shift length — the longest matching rule applies. Unpaid auto-deduct breaks
                are removed from payable time even if the employee did not record them.
              </p>
              <Table columns={["Rule", "Applies when shift ≥", "Break", "Paid", "Auto-deduct"]}>
                {breakRules.map((b, i) => (
                  <Row key={b.id} index={i}>
                    <Cell className="font-semibold">{b.label}</Cell>
                    <Cell>{b.minShiftHours ? `${b.minShiftHours} h` : "any"}</Cell>
                    <Cell>{b.breakMins} min</Cell>
                    <Cell><Badge tone={b.paid ? "brand" : "mist"}>{b.paid ? "Paid" : "Unpaid"}</Badge></Cell>
                    <Cell><Badge tone={b.autoDeduct ? "amber" : "mist"}>{b.autoDeduct ? "Auto" : "Manual"}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </div>
          ) : t === "Attendance rules" ? (
            <Table columns={["Rule", "Value", "Detail"]}>
              {attendanceRules.map((r, i) => (
                <Row key={r.id} index={i}>
                  <Cell className="font-semibold">{r.key}</Cell>
                  <Cell><Badge tone="mist">{r.value}</Badge></Cell>
                  <Cell className="text-mist-500">{r.detail}</Cell>
                </Row>
              ))}
            </Table>
          ) : t === "Enrolment" ? (
            <Table columns={["Selector", "Capture mode", "Effective from", "Employees", "Resolved policy"]}>
              {enrolments.map((e, i) => (
                <Row key={e.id} index={i}>
                  <Cell className="font-semibold">{e.selector}</Cell>
                  <Cell><Badge tone="mist">{e.captureMode}</Badge></Cell>
                  <Cell>{shortDate(e.effectiveFrom)}</Cell>
                  <Cell>{e.count}</Cell>
                  <Cell className="text-mist-500">{e.resolvedPolicy}</Cell>
                </Row>
              ))}
            </Table>
          ) : t === "Capabilities" ? (
            <div className="space-y-3">
              <p className="text-sm text-mist-500">
                Suspending a capability hides new access across the tenant without deleting historical records.
              </p>
              {capabilities.map((c) => (
                <div key={c.key} className="card flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display font-bold text-mist-900">{c.key}</p>
                    <p className="text-xs text-mist-400">{c.note}</p>
                  </div>
                  <button
                    disabled={!rw}
                    onClick={() => toggleCapability(c.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-50",
                      c.enabled ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-mist-100 text-mist-500 ring-mist-200",
                    )}
                  >
                    <Power size={12} /> {c.enabled ? "Enabled" : "Suspended"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <p className="mb-3 text-sm text-mist-500">
                For every policy field, the resolved value is the first explicit value walking this list from most specific
                to least specific. A same-level conflict with no primary marked returns <b>Configuration Conflict</b> and
                blocks activation.
              </p>
              <ol className="space-y-1.5">
                {PRECEDENCE.map((p, i) => (
                  <li key={p} className="flex items-center gap-3 rounded-xl bg-mist-50 px-3 py-2 text-sm">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white">{i + 1}</span>
                    <span className="font-medium text-mist-700">{p}</span>
                    {i === 0 && <Badge tone="brand">highest authority</Badge>}
                    {i === PRECEDENCE.length - 1 && <Badge tone="mist">fallback</Badge>}
                  </li>
                ))}
              </ol>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New policy version"
        wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!pf.scope || !pf.effectiveFrom} onClick={saveVersion}>Save (future-dated)</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Scope"><Input value={pf.scope} onChange={(e) => setPf({ ...pf, scope: e.target.value })} placeholder="e.g. Department: Nursing" /></Field>
            <Field label="Effective from"><Input type="date" value={pf.effectiveFrom} onChange={(e) => setPf({ ...pf, effectiveFrom: e.target.value })} /></Field>
          </Grid>
          <Grid cols={3}>
            <Field label="Period type"><Select value={pf.periodType} onChange={(e) => setPf({ ...pf, periodType: e.target.value as never })} options={["Weekly", "Bi-weekly", "Monthly"]} /></Field>
            <Field label="Capture default"><Select value={pf.captureDefault} onChange={(e) => setPf({ ...pf, captureDefault: e.target.value as never })} options={["Attendance", "Manual", "Hybrid"]} /></Field>
            <Field label="Rounding"><Select value={pf.rounding} onChange={(e) => setPf({ ...pf, rounding: e.target.value as never })} options={["None", "Nearest 5", "Nearest 15"]} /></Field>
            <Field label="Increment (min)"><Input type="number" value={pf.incrementMins} onChange={(e) => setPf({ ...pf, incrementMins: +e.target.value })} /></Field>
            <Field label="Late grace (min)"><Input type="number" value={pf.lateGraceMins} onChange={(e) => setPf({ ...pf, lateGraceMins: +e.target.value })} /></Field>
            <Field label="Max daily hours"><Input type="number" value={pf.maxDailyHours} onChange={(e) => setPf({ ...pf, maxDailyHours: +e.target.value })} /></Field>
          </Grid>
          <div className="flex flex-wrap gap-6">
            <Checkbox label="Employees may edit attendance-derived time" checked={pf.allowEditDerived} onChange={(e) => setPf({ ...pf, allowEditDerived: e.target.checked })} />
            <Checkbox label="Overtime enabled" checked={pf.overtimeEnabled} onChange={(e) => setPf({ ...pf, overtimeEnabled: e.target.checked })} />
          </div>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            A policy change applies only from its effective date and never recalculates a locked period. An effective policy
            is superseded by a new version rather than overwritten.
          </p>
        </div>
      </Modal>
    </div>
  );
}
