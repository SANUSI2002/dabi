import { useEffect, useMemo, useState } from "react";
import { Fingerprint, LogIn, LogOut, AlertTriangle, ShieldCheck, MapPin, Coffee, Play, CheckCircle2 } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useWfScope } from "@/store/useWorkforceSession";
import { useHr } from "@/store/useHr";
import { shortDate, timeAgo } from "@/lib/format";
import type { WorkLocation, ExceptionResolution } from "@/data/workforce";
import { cn } from "@/lib/cn";

const WORK_LOCATIONS: WorkLocation[] = ["WFO", "WFH", "Client Site"];

function workedHours(a: { clockIn: string; clockOut?: string; breakMins: number }) {
  if (!a.clockOut) return null;
  const [h1, m1] = a.clockIn.split(":").map(Number);
  const [h2, m2] = a.clockOut.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // overnight
  return Math.max(0, mins - a.breakMins) / 60;
}

const breakElapsed = (since?: string) =>
  since ? Math.max(0, Math.round((Date.now() - +new Date(since)) / 60000)) : 0;

export default function Attendance() {
  const { attendance, clockIn, clockOut, startBreak, endBreak, correctInterval, resolveException } = useWorkforce();
  const staff = useHr((s) => s.staff);
  const scope = useWfScope();
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  // tick every 30s so break timers stay live
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const scoped = useMemo(() => attendance.filter((a) => scope.inScope(a.staffId)), [attendance, scope]);
  const inScopeStaff = staff.filter((s) => scope.inScope(s.id));

  const [who, setWho] = useState(scope.staffId);
  const [workLocation, setWorkLocation] = useState<WorkLocation>("WFO");
  const [consented, setConsented] = useState(false);
  const [correct, setCorrect] = useState<string | null>(null);
  const [cf, setCf] = useState({ clockIn: "", clockOut: "", breakMins: 30 });
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const [rf, setRf] = useState<{ action: ExceptionResolution["action"]; note: string }>({ action: "Acknowledged", note: "" });

  const today = new Date().toISOString().slice(0, 10);
  const open = scoped.filter((a) => !a.clockOut);
  const exceptions = scoped.filter((a) => a.flags.some((f) => ["Late", "Missing checkout", "Auto-checkout"].includes(f)));
  const openExceptions = exceptions.filter((a) => !a.exceptionResolution);
  const canResolve = scope.canApprove || scope.canConfigure;
  const totalWorked = scoped.reduce((n, a) => n + (workedHours(a) ?? 0), 0);

  // self view state
  const mine = scoped.filter((a) => a.staffId === scope.staffId);
  const myToday = mine.filter((a) => a.date === today);
  const myOpen = myToday.find((a) => !a.clockOut);
  const myPayable = myToday.reduce((n, a) => n + (workedHours(a) ?? 0), 0);
  const myBreak = myToday.reduce((n, a) => n + a.breakMins, 0);

  function doClockIn(staffId: string) {
    clockIn(staffId, { workLocation });
    setConsented(false);
  }

  const selfView = scope.selfOnly;

  return (
    <div>
      <PageHeader
        title={selfView ? "My attendance" : "Attendance management"}
        subtitle="Schedule-aware check-in, multiple work intervals, breaks, corrections and exceptions."
        actions={
          !selfView && !scope.readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={who} onChange={(e) => setWho(e.target.value)} options={inScopeStaff.map((s) => ({ value: s.id, label: s.name }))} className="w-auto" />
              <Select value={workLocation} onChange={(e) => setWorkLocation(e.target.value as WorkLocation)} options={WORK_LOCATIONS.map((w) => ({ value: w, label: w }))} className="w-auto" />
              <Button onClick={() => doClockIn(who)}><LogIn size={15} /> Clock in</Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Intervals today" value={scoped.filter((a) => a.date === today).length} tone="brand" icon={<Fingerprint size={18} />} />
        <StatCard label="Currently clocked in" value={open.length} tone="mist" delay={0.05} />
        <StatCard label="Open exceptions" value={openExceptions.length} tone={openExceptions.length ? "action" : "mist"} delay={0.1} icon={<AlertTriangle size={18} />} />
        <StatCard label="Payable hours (period)" value={totalWorked.toFixed(1)} tone="brand" delay={0.15} />
      </div>

      {selfView && (
        <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-mist-900">
                {new Date().toLocaleDateString("en", { weekday: "long", day: "2-digit", month: "short" })}
              </h3>
              <Badge tone={myOpen ? "brand" : myPayable ? "mist" : "amber"}>
                {myOpen ? "Clocked in" : myPayable ? "Complete" : "Not started"}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-mist-50 py-2">
                <p className="text-[11px] font-bold uppercase text-mist-400">Schedule</p>
                <p className="text-sm font-semibold text-mist-800">08:00–17:00</p>
              </div>
              <div className="rounded-xl bg-mist-50 py-2">
                <p className="text-[11px] font-bold uppercase text-mist-400">Payable</p>
                <p className="text-sm font-semibold text-mist-800">{myPayable.toFixed(2)}h</p>
              </div>
              <div className="rounded-xl bg-mist-50 py-2">
                <p className="text-[11px] font-bold uppercase text-mist-400">Break</p>
                <p className="text-sm font-semibold text-mist-800">{myBreak}m</p>
              </div>
            </div>

            <Field label="Work location">
              <Select value={workLocation} onChange={(e) => setWorkLocation(e.target.value as WorkLocation)} options={WORK_LOCATIONS.map((w) => ({ value: w, label: w }))} />
            </Field>

            <label className="flex items-start gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-xs text-brand-800 ring-1 ring-brand-100">
              <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5" />
              <span>
                <b>Attendance evidence notice 1.1</b> — time, work location and device source are recorded and retained
                for 365 days to support time review. I understand and agree.
              </span>
            </label>

            {myOpen ? (
              <div className="space-y-2">
                {myOpen.onBreakSince && (
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      On break — {breakElapsed(myOpen.onBreakSince)}m
                    </span>
                    <span className="font-normal text-amber-500">since {new Date(myOpen.onBreakSince).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {myOpen.onBreakSince ? (
                    <Button variant="soft" className="flex-1" onClick={() => endBreak(myOpen.id)}>
                      <Play size={15} /> End break
                    </Button>
                  ) : (
                    <Button variant="ghost" className="flex-1" onClick={() => startBreak(myOpen.id)}>
                      <Coffee size={15} /> Start break
                    </Button>
                  )}
                  <Button variant="action" className="flex-1" disabled={!!myOpen.onBreakSince} onClick={() => clockOut(myOpen.id)}>
                    <LogOut size={15} /> Clock out
                  </Button>
                </div>
                {myOpen.onBreakSince && <p className="text-center text-[11px] text-mist-400">End your break before clocking out.</p>}
              </div>
            ) : (
              <Button className="w-full" disabled={!consented} onClick={() => doClockIn(scope.staffId)}>
                <LogIn size={15} /> Check in
              </Button>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3 font-display font-bold text-mist-900">Today’s calculation</h3>
            <p className="mb-3 text-xs text-mist-400">Multiple intervals are merged so overlapping time is not counted twice.</p>
            <div className="space-y-2">
              {myToday.length === 0 && <p className="text-sm text-mist-400">No intervals recorded today.</p>}
              {myToday.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <MapPin size={13} className="text-mist-400" />
                    {a.clockIn}{a.clockOut ? `–${a.clockOut}` : " · open"}
                    <Badge tone="mist">{a.workLocation ?? "WFO"}</Badge>
                  </span>
                  <span className="font-semibold text-mist-800">{workedHours(a) != null ? `${workedHours(a)!.toFixed(2)}h` : "—"}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-mist-100 pt-2 text-sm font-bold text-mist-900">
                <span>Payable attendance</span>
                <span>{myPayable.toFixed(2)}h</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs tabs={["All Intervals", `Exceptions (${openExceptions.length})`, "Currently In", "Corrections"]}>
        {(t) => {
          const rows =
            t === "All Intervals" ? scoped
            : t.startsWith("Exceptions") ? exceptions
            : t === "Currently In" ? open
            : scoped.filter((a) => a.flags.includes("Corrected"));
          return (
            <Table columns={["Employee", "Date", "In", "Out", "Break", "Worked", "Location", "Source", "Flags", ""]}>
              {rows.map((a, i) => {
                const w = workedHours(a);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{name(a.staffId)}</Cell>
                    <Cell>{shortDate(a.date)}</Cell>
                    <Cell>{a.clockIn}</Cell>
                    <Cell>{a.clockOut ?? <Badge tone="amber">open</Badge>}</Cell>
                    <Cell>
                      {a.breakMins}m
                      {a.onBreakSince && <span className="ml-1 text-amber-600">+{breakElapsed(a.onBreakSince)}m…</span>}
                    </Cell>
                    <Cell className="font-semibold">{w != null ? `${w.toFixed(1)}h` : "—"}</Cell>
                    <Cell><Badge tone="mist">{a.workLocation ?? "WFO"}</Badge></Cell>
                    <Cell>{a.source}</Cell>
                    <Cell>
                      <div className="flex flex-wrap gap-1">
                        {a.flags.length ? a.flags.map((f) => <Badge key={f} tone={["Corrected", "Reviewed"].includes(f) ? "brand" : f === "On break" ? "amber" : "action"}>{f}</Badge>) : <span className="text-mist-300">—</span>}
                        {a.exceptionResolution && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-200" title={`${a.exceptionResolution.by} · ${timeAgo(a.exceptionResolution.at)}${a.exceptionResolution.note ? ` — ${a.exceptionResolution.note}` : ""}`}>
                            <CheckCircle2 size={10} /> {a.exceptionResolution.action}
                          </span>
                        )}
                      </div>
                    </Cell>
                    <Cell>
                      <div className="flex justify-end gap-1.5">
                        {!a.clockOut && !scope.readOnly && (
                          a.onBreakSince ? (
                            <button onClick={() => endBreak(a.id)} className="btn-soft px-2.5 py-1 text-xs"><Play size={12} /> Resume</button>
                          ) : (
                            <button onClick={() => startBreak(a.id)} className="btn-ghost px-2 py-1 text-xs"><Coffee size={12} /> Break</button>
                          )
                        )}
                        {!a.clockOut && !scope.readOnly && !a.onBreakSince && (
                          <button onClick={() => clockOut(a.id)} className="btn-primary px-2.5 py-1 text-xs"><LogOut size={12} /> Out</button>
                        )}
                        {!scope.readOnly && (scope.canConfigure || scope.canApprove || a.staffId === scope.staffId) && (
                          <button onClick={() => { setCorrect(a.id); setCf({ clockIn: a.clockIn, clockOut: a.clockOut ?? "", breakMins: a.breakMins }); }} className="btn-ghost px-2 py-1 text-xs">Correct</button>
                        )}
                        {t.startsWith("Exceptions") && canResolve && !a.exceptionResolution && (
                          <button onClick={() => { setResolveFor(a.id); setRf({ action: "Acknowledged", note: "" }); }} className="btn-primary px-2.5 py-1 text-xs"><CheckCircle2 size={12} /> Resolve</button>
                        )}
                      </div>
                    </Cell>
                  </Row>
                );
              })}
              {rows.length === 0 && <Row><Cell className="text-mist-400">Nothing here.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
            </Table>
          );
        }}
      </Tabs>

      <p className={cn("mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-mist-300")}>
        <ShieldCheck size={12} /> Evidence notice acknowledged on every check-in · retained 365 days · corrections keep the original record
      </p>

      <Modal
        open={!!correct}
        onClose={() => setCorrect(null)}
        title="Correct Attendance Interval"
        footer={<><Button variant="ghost" onClick={() => setCorrect(null)}>Cancel</Button>
          <Button onClick={() => { if (correct) correctInterval(correct, { clockIn: cf.clockIn, clockOut: cf.clockOut || undefined, breakMins: cf.breakMins }); setCorrect(null); }}>Save Correction</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Clock in"><Input type="time" value={cf.clockIn} onChange={(e) => setCf({ ...cf, clockIn: e.target.value })} /></Field>
            <Field label="Clock out"><Input type="time" value={cf.clockOut} onChange={(e) => setCf({ ...cf, clockOut: e.target.value })} /></Field>
            <Field label="Break (mins)"><Input type="number" value={cf.breakMins} onChange={(e) => setCf({ ...cf, breakMins: +e.target.value })} /></Field>
          </div>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Corrections before period lock trigger revalidation. After lock, this becomes a proposed amendment and never
            rewrites the locked record.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!resolveFor}
        onClose={() => setResolveFor(null)}
        title="Resolve attendance exception"
        footer={<><Button variant="ghost" onClick={() => setResolveFor(null)}>Cancel</Button>
          <Button
            disabled={rf.action === "Escalated" && !rf.note.trim()}
            onClick={() => { if (resolveFor) resolveException(resolveFor, rf.action, rf.note, scope.selfName); setResolveFor(null); }}
          ><CheckCircle2 size={14} /> Record resolution</Button></>}
      >
        {(() => {
          const a = resolveFor ? attendance.find((x) => x.id === resolveFor) : undefined;
          return (
            <div className="space-y-4">
              {a && (
                <div className="rounded-xl bg-action-50/60 px-3 py-2 text-sm text-action-800 ring-1 ring-action-100">
                  <b>{name(a.staffId)}</b> · {shortDate(a.date)} · in {a.clockIn}{a.clockOut ? `–${a.clockOut}` : " (no checkout)"} ·{" "}
                  {a.flags.filter((f) => ["Late", "Missing checkout", "Auto-checkout"].includes(f)).join(", ")}
                </div>
              )}
              <Field label="Resolution">
                <Select
                  value={rf.action}
                  onChange={(e) => setRf({ ...rf, action: e.target.value as ExceptionResolution["action"] })}
                  options={[
                    { value: "Acknowledged", label: "Acknowledged — noted, no adjustment" },
                    { value: "Corrected", label: "Corrected — interval was fixed" },
                    { value: "Excused", label: "Excused — approved reason (traffic, emergency)" },
                    { value: "Escalated", label: "Escalated — needs HR / disciplinary review" },
                  ]}
                />
              </Field>
              <Field label={rf.action === "Escalated" ? "Escalation note (required)" : "Note (optional)"}>
                <Input value={rf.note} onChange={(e) => setRf({ ...rf, note: e.target.value })} placeholder="Context for the record…" />
              </Field>
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                The resolution is written to the audit log with your name and stays attached to the interval. It does not
                rewrite the recorded times — use <b>Correct</b> for that.
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
