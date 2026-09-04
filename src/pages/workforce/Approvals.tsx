import { useMemo, useState } from "react";
import { CheckCheck, Undo2, X, ShieldAlert, History, Lock } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useWfScope } from "@/store/useWorkforceSession";
import { useHr } from "@/store/useHr";
import { shortDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export default function Approvals() {
  const { timesheets, periods, setTimesheetStatus } = useWorkforce();
  const staff = useHr((s) => s.staff);
  const scope = useWfScope();
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const queue = useMemo(
    () => timesheets.filter((t) => t.status === "Submitted" && scope.inScope(t.staffId)),
    [timesheets, scope],
  );
  const decidedThisCycle = useMemo(
    () => timesheets.filter((t) => ["Approved", "Locked", "Returned", "Rejected"].includes(t.status) && scope.inScope(t.staffId)),
    [timesheets, scope],
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");

  const sheet = timesheets.find((t) => t.id === openId) ?? queue[0];
  const period = sheet ? periods.find((p) => p.id === sheet.periodId) : undefined;

  if (!scope.canApprove) {
    return (
      <div>
        <PageHeader title="Timesheet approvals" subtitle="Review frozen submissions within your reporting scope." />
        <div className="card flex items-center gap-3 text-mist-500">
          <ShieldAlert size={20} className="text-action-500" />
          <p className="text-sm">
            The <b>{scope.role}</b> persona cannot approve timesheets. Switch to the Line Manager or Tenant HR
            Administrator persona above to use this queue.
          </p>
        </div>
      </div>
    );
  }

  const expected = (t: typeof timesheets[number]) => sum(t.lines.map((l) => l.expectedHours));
  const worked = (t: typeof timesheets[number]) => sum(t.lines.map((l) => l.workedHours));

  function decide(id: string, status: "Approved" | "Rejected") {
    setTimesheetStatus(id, status, scope.name);
    setOpenId(null);
  }
  function confirmReturn() {
    if (!returnFor) return;
    setTimesheetStatus(returnFor, "Returned", scope.name, returnNote || "Returned for correction");
    setReturnFor(null);
    setReturnNote("");
    setOpenId(null);
  }

  return (
    <div>
      <PageHeader
        title="Timesheet approvals"
        subtitle="Review frozen submissions within your reporting scope and preserve every decision."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Awaiting review" value={queue.length} tone={queue.length ? "amber" : "mist"} icon={<CheckCheck size={18} />} />
        <StatCard label="In scope" value={scope.visibleIds.length} tone="brand" delay={0.05} />
        <StatCard label="Decided" value={decidedThisCycle.length} tone="mist" delay={0.1} />
        <StatCard
          label="Oldest wait"
          value={queue.length ? timeAgo(queue.map((t) => t.submittedAt!).sort()[0]) : "—"}
          tone={queue.length ? "action" : "mist"}
          delay={0.15}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="card h-fit p-2">
          <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-mist-400">Review queue</p>
          {queue.length === 0 && <p className="px-3 py-6 text-center text-sm text-mist-400">Nothing awaiting your review.</p>}
          {queue.map((t) => {
            const active = sheet?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setOpenId(t.id)}
                className={cn(
                  "mb-1 w-full rounded-xl px-3 py-2.5 text-left transition",
                  active ? "bg-brand-gradient text-white shadow-glow" : "hover:bg-mist-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{name(t.staffId)}</span>
                  <Badge tone={active ? "mist" : "amber"}>v{t.version}</Badge>
                </div>
                <span className={cn("text-[11px]", active ? "text-white/80" : "text-mist-400")}>
                  {t.captureMode} · submitted {timeAgo(t.submittedAt!)}
                </span>
              </button>
            );
          })}
        </div>

        {!sheet ? (
          <div className="card grid place-items-center py-20 text-mist-400">Select a submission to review.</div>
        ) : (
          <div className="space-y-4">
            <div className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-mist-900">{name(sheet.staffId)}</p>
                <p className="text-xs text-mist-400">
                  {period?.label} · {period && `${shortDate(period.start)}–${shortDate(period.end)}`} ·{" "}
                  <Badge tone="mist">{sheet.captureMode}</Badge> <Badge tone={statusTone(sheet.status)}>{sheet.status}</Badge>{" "}
                  frozen v{sheet.version}
                </p>
              </div>
              {sheet.status === "Submitted" ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="action" onClick={() => decide(sheet.id, "Rejected")}><X size={14} /> Reject</Button>
                  <Button variant="soft" onClick={() => { setReturnFor(sheet.id); setReturnNote(""); }}><Undo2 size={14} /> Return</Button>
                  <Button onClick={() => decide(sheet.id, "Approved")}><CheckCheck size={14} /> Approve</Button>
                </div>
              ) : sheet.status === "Approved" && scope.canConfigure && period && !period.locked ? (
                <Button onClick={() => { setTimesheetStatus(sheet.id, "Locked", scope.name, `Period ${period.label} closed`); setOpenId(null); }}>
                  <Lock size={14} /> Lock period
                </Button>
              ) : (
                <Badge tone={statusTone(sheet.status)}>{sheet.status}</Badge>
              )}
            </div>

            <div className="card flex flex-wrap justify-between gap-4 text-sm">
              {[
                ["Expected", expected(sheet)],
                ["Recorded", worked(sheet)],
                ["Variance", worked(sheet) - expected(sheet)],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-[11px] font-bold uppercase text-mist-400">{k}</p>
                  <p className={cn(
                    "font-display text-xl font-bold",
                    k === "Variance" && (v as number) < -0.25 ? "text-action-600" : "text-mist-900",
                  )}>
                    {(v as number) >= 0 && k === "Variance" ? "+" : ""}{(v as number).toFixed(2)}h
                  </p>
                </div>
              ))}
            </div>

            <Table columns={["Date", "Source", "Expected", "Worked", "Break", "Overtime", "Work / Task", "Notes"]}>
              {sheet.lines.map((l, i) => (
                <Row key={l.id} index={i}>
                  <Cell>{shortDate(l.date)}</Cell>
                  <Cell><Badge tone={l.source === "Attendance" ? "brand" : "mist"}>{l.source}</Badge></Cell>
                  <Cell>{l.expectedHours}h</Cell>
                  <Cell className="font-semibold">{l.workedHours}h</Cell>
                  <Cell>{l.breakHours}h</Cell>
                  <Cell>{l.overtimeHours ? <Badge tone="amber">{l.overtimeHours}h</Badge> : "—"}</Cell>
                  <Cell className="text-mist-500">{l.container ? `${l.container}${l.task ? ` · ${l.task}` : ""}` : "—"}</Cell>
                  <Cell className="text-mist-500">{l.note ?? "—"}</Cell>
                </Row>
              ))}
            </Table>

            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900">
                <History size={15} /> Decision trail
              </h3>
              <ol className="space-y-2">
                {sheet.history.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Badge tone={statusTone(h.status)}>{h.status}</Badge>
                    <div>
                      <p className="text-mist-700">
                        v{h.version} · {h.by} · <span className="text-mist-400">{timeAgo(h.at)}</span>
                      </p>
                      {h.note && <p className="text-xs text-mist-500">“{h.note}”</p>}
                    </div>
                  </li>
                ))}
                {sheet.history.length === 0 && <li className="text-sm text-mist-400">No decisions recorded yet.</li>}
              </ol>
            </div>
          </div>
        )}
      </div>

      {decidedThisCycle.length > 0 && (
        <div className="card mt-5">
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900">
            <Lock size={15} /> Recently decided
          </h3>
          <Table columns={["Employee", "Status", "Version", "Decision", "When"]}>
            {decidedThisCycle.map((t, i) => {
              const last = t.history[t.history.length - 1];
              return (
                <Row key={t.id} index={i} onClick={() => setOpenId(t.id)}>
                  <Cell className="font-semibold">{name(t.staffId)}</Cell>
                  <Cell><Badge tone={statusTone(t.status)}>{t.status}</Badge></Cell>
                  <Cell>v{t.version}</Cell>
                  <Cell className="text-mist-500">{last?.by ?? "—"}</Cell>
                  <Cell className="text-mist-400">{last ? timeAgo(last.at) : "—"}</Cell>
                </Row>
              );
            })}
          </Table>
        </div>
      )}

      <Modal
        open={!!returnFor}
        onClose={() => setReturnFor(null)}
        title="Return timesheet for correction"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturnFor(null)}>Cancel</Button>
            <Button variant="soft" onClick={confirmReturn}><Undo2 size={14} /> Return to employee</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-mist-500">
            A return sends the frozen version back to the employee with your note. They correct it and resubmit as a new
            version — the original decision trail is preserved.
          </p>
          <Field label="Note to employee">
            <Input
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="e.g. Thursday is missing — add the entry or mark leave."
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
