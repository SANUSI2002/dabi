import { useMemo, useState } from "react";
import { SlidersHorizontal, Plus, ShieldAlert, Power, Layers } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useWfScope } from "@/store/useWorkforceSession";
import { useHr } from "@/store/useHr";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const PRECEDENCE = [
  "Employee Override", "Schedule Assignment", "Primary Timesheet Group",
  "Primary Payroll Group", "Grade", "Contract Type", "Department", "Location / Branch", "Tenant Default",
];

type Layer = { level: string; selector: string | null; values: Record<string, string | number | boolean>; conflict?: boolean };
const RESOLVED_FIELDS = ["captureDefault", "periodType", "lateGraceMins", "maxDailyHours", "overtimeEnabled", "allowEditDerived"] as const;

// demonstrative per-employee policy layers for the resolver
const OVERRIDES: Record<string, { level: string; selector: string; values: Record<string, string | number | boolean>; conflict?: boolean }[]> = {
  s3: [
    { level: "Employee Override", selector: "Mary Williams — probation", values: { lateGraceMins: 5 } },
    { level: "Contract Type", selector: "Permanent", values: {} },
  ],
  s7: [
    { level: "Contract Type", selector: "Locum", values: { overtimeEnabled: false, allowEditDerived: false } },
    { level: "Department", selector: "Laboratory", values: { captureDefault: "Manual" } },
  ],
  s6: [
    { level: "Primary Timesheet Group", selector: "M&E / Reporting", values: { captureDefault: "Manual", periodType: "Monthly" } },
    { level: "Grade", selector: "GL-10", values: {} },
    { level: "Grade", selector: "GL-09 (acting)", values: { maxDailyHours: 12 }, conflict: true },
  ],
};

export default function TimePolicy() {
  const { policies, enrolments, breakRules, capabilities, attendanceRules, assignments, addPolicy, toggleCapability } = useWorkforce();
  const scope = useWfScope();
  const [open, setOpen] = useState(false);
  const [pf, setPf] = useState({
    scope: "", periodType: "Weekly" as const, captureDefault: "Hybrid" as const,
    incrementMins: 15, rounding: "Nearest 15" as const, submissionDeadlineDays: 2, approvalDeadlineDays: 3,
    lateGraceMins: 10, earlyLeaveGraceMins: 10, absenceThresholdMins: 240, maxDailyHours: 14,
    allowEditDerived: true, overtimeEnabled: true, effectiveFrom: "",
  });

  const rw = scope.canConfigure;

  const staff = useHr((s) => s.staff);
  const [resolveStaff, setResolveStaff] = useState(staff[0]?.id ?? "");
  const tenantPolicy = policies.find((p) => p.status === "Current") ?? policies[0];

  const resolution = useMemo(() => {
    const person = staff.find((s) => s.id === resolveStaff);
    const asg = assignments.find((a) => a.staffId === resolveStaff);
    const dept = person?.role?.includes("Nurse") ? "Nursing" : person?.role?.includes("Lab") ? "Laboratory" : person?.role ?? "General";
    const ov = OVERRIDES[resolveStaff] ?? [];

    const layers: Layer[] = PRECEDENCE.map((level) => {
      if (level === "Schedule Assignment") {
        return {
          level,
          selector: asg ? `Assignment (${asg.captureMode})` : null,
          values: (asg ? { captureDefault: asg.captureMode } : {}) as Record<string, string | number | boolean>,
        };
      }
      if (level === "Department") {
        const o = ov.filter((x) => x.level === level);
        return { level, selector: o[0]?.selector ?? dept, values: o[0]?.values ?? {} };
      }
      if (level === "Location / Branch") {
        return { level, selector: "Sabi Health Post", values: {} };
      }
      if (level === "Tenant Default") {
        return {
          level, selector: tenantPolicy?.scope ?? "Tenant Default",
          values: {
            captureDefault: tenantPolicy?.captureDefault, periodType: tenantPolicy?.periodType,
            lateGraceMins: tenantPolicy?.lateGraceMins, maxDailyHours: tenantPolicy?.maxDailyHours,
            overtimeEnabled: tenantPolicy?.overtimeEnabled, allowEditDerived: tenantPolicy?.allowEditDerived,
          } as Record<string, string | number | boolean>,
        };
      }
      const matches = ov.filter((x) => x.level === level);
      const conflict = matches.length > 1 && matches.some((m) => m.conflict);
      const merged = matches.reduce((acc, m) => ({ ...acc, ...m.values }), {} as Record<string, string | number | boolean>);
      return { level, selector: matches.map((m) => m.selector).join("  ·  ") || null, values: merged, conflict };
    });

    const resolved: Record<string, { value: string | number | boolean; from: string; blocked?: boolean }> = {};
    for (const f of RESOLVED_FIELDS) {
      for (const l of layers) {
        if (l.selector && f in l.values && l.values[f] !== undefined) {
          resolved[f] = { value: l.values[f], from: l.level, blocked: l.conflict };
          break;
        }
      }
    }
    return { layers, resolved, hasConflict: layers.some((l) => l.conflict) };
  }, [resolveStaff, staff, assignments, tenantPolicy]);

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

      <Tabs tabs={["Policies", "Policy resolver", "Breaks", "Attendance rules", "Enrolment", "Capabilities", "Resolution precedence"]}>
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
          ) : t === "Policy resolver" ? (
            <div className="space-y-4">
              <div className="card">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <Field label="Resolve effective policy for">
                    <Select
                      value={resolveStaff}
                      onChange={(e) => setResolveStaff(e.target.value)}
                      options={staff.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` }))}
                      className="w-auto"
                    />
                  </Field>
                  {resolution.hasConflict ? (
                    <Badge tone="action"><ShieldAlert size={12} /> Configuration Conflict — activation blocked</Badge>
                  ) : (
                    <Badge tone="brand">Resolved cleanly</Badge>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><Layers size={15} /> Precedence walk</h3>
                <Table columns={["#", "Level", "Matched selector", "Contributes"]}>
                  {resolution.layers.map((l, i) => (
                    <Row key={l.level} index={i}>
                      <Cell className="text-mist-400">{i + 1}</Cell>
                      <Cell className={cn("font-semibold", l.conflict && "text-action-600")}>
                        {l.level}
                        {l.conflict && <Badge tone="action">conflict</Badge>}
                      </Cell>
                      <Cell className="text-mist-500">{l.selector ?? <span className="text-mist-300">— no rule —</span>}</Cell>
                      <Cell className="text-mist-600">
                        {Object.keys(l.values).length
                          ? Object.entries(l.values).map(([k, v]) => `${k}=${String(v)}`).join(", ")
                          : <span className="text-mist-300">—</span>}
                      </Cell>
                    </Row>
                  ))}
                </Table>
              </div>

              <div className="card">
                <h3 className="mb-3 font-display font-bold text-mist-900">Resolved effective policy</h3>
                <div className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                  {RESOLVED_FIELDS.map((f) => {
                    const r = resolution.resolved[f];
                    return (
                      <div key={f} className="flex items-center justify-between border-b border-dashed border-mist-100 py-1.5">
                        <span className="text-mist-400">{f}</span>
                        <span className="flex items-center gap-2">
                          <span className={cn("font-semibold", r?.blocked ? "text-action-600" : "text-mist-800")}>{r ? String(r.value) : "—"}</span>
                          {r && <Badge tone={r.from === "Tenant Default" ? "mist" : "brand"}>{r.from}</Badge>}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                  Each field takes the first explicit value walking the ladder from most specific (Employee Override) to
                  least (Tenant Default). Two rules at the same level that both set a value, with none marked primary, raise
                  a Configuration Conflict and block the enrolment from activating (BL-2.1.4).
                </p>
              </div>
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
