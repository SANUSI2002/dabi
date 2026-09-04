import { useState } from "react";
import { CalendarRange, Plus, Clock } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useHr } from "@/store/useHr";
import { WEEKDAYS, type Classification } from "@/data/workforce";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function Schedules() {
  const { timeBlocks, schedules, assignments, addTimeBlock, assignSchedule } = useWorkforce();
  const staff = useHr((s) => s.staff);
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const [blockModal, setBlockModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [tb, setTb] = useState({ name: "", code: "", start: "08:00", end: "16:00", overnight: false, paidHours: 7.5, breakMins: 30, lateGraceMins: 10, classification: "Working" as Classification, colour: "#0fc06d" });
  const [af, setAf] = useState({ staffId: "s1", scheduleId: "sc1", effectiveFrom: "", captureMode: "Hybrid" as const });

  return (
    <div>
      <PageHeader
        title="Schedule Manager"
        subtitle="Time blocks, weekly schedules, rotations & assignments"
        actions={
          <>
            <Button variant="ghost" onClick={() => setBlockModal(true)}><Clock size={15} /> New Time Block</Button>
            <Button onClick={() => setAssignModal(true)}><Plus size={15} /> Assign Schedule</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Time Blocks" value={timeBlocks.length} tone="brand" icon={<Clock size={18} />} />
        <StatCard label="Schedules" value={schedules.length} tone="mist" delay={0.05} icon={<CalendarRange size={18} />} />
        <StatCard label="Rotations" value={schedules.filter((s) => s.rotation).length} tone="mist" delay={0.1} />
        <StatCard label="Assignments" value={assignments.length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Weekly Schedules", "Time Blocks", "Assignments", "Coverage Grid"]}>
        {(t) =>
          t === "Weekly Schedules" ? (
            <div className="space-y-3">
              {schedules.map((sc) => (
                <div key={sc.id} className="card">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-display font-bold text-mist-900">{sc.name}</p>
                      <p className="text-[11px] text-mist-400">{sc.description} · from {shortDate(sc.startDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sc.rotation && <Badge tone="amber">{sc.rotationLength}-day rotation</Badge>}
                      <Badge tone={sc.status === "Active" ? "brand" : "mist"}>{sc.status}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const bId = sc.days[d];
                      const b = timeBlocks.find((x) => x.id === bId);
                      return (
                        <div key={d} className="rounded-lg p-2 text-center text-[11px] ring-1 ring-mist-200" style={b ? { background: b.colour + "1a" } : {}}>
                          <p className="font-bold text-mist-600">{d}</p>
                          <p className="text-mist-500">{b ? b.code : "Off"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : t === "Time Blocks" ? (
            <Table columns={["Block", "Code", "Window", "Paid hrs", "Break", "Late grace", "Type"]}>
              {timeBlocks.map((b, i) => (
                <Row key={b.id} index={i}>
                  <Cell>
                    <span className="inline-flex items-center gap-2 font-semibold text-mist-900">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.colour }} /> {b.name}
                    </span>
                  </Cell>
                  <Cell className="font-mono text-xs">{b.code}</Cell>
                  <Cell>{b.start}–{b.end}{b.overnight && " ⁺¹"}</Cell>
                  <Cell>{b.paidHours}h</Cell>
                  <Cell>{b.breakMins}m</Cell>
                  <Cell>{b.lateGraceMins}m</Cell>
                  <Cell><Badge tone={b.classification === "Working" ? "brand" : b.classification === "Off" ? "mist" : "amber"}>{b.classification}</Badge></Cell>
                </Row>
              ))}
            </Table>
          ) : t === "Assignments" ? (
            <Table columns={["Employee", "Schedule", "Capture mode", "Effective from"]}>
              {assignments.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{staffName(a.staffId)}</Cell>
                  <Cell>{schedules.find((s) => s.id === a.scheduleId)?.name ?? a.scheduleId}</Cell>
                  <Cell><Badge tone="mist">{a.captureMode}</Badge></Cell>
                  <Cell>{shortDate(a.effectiveFrom)}</Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-mist-200 bg-mist-50/60">
                  <tr><th className="th">Employee</th>{WEEKDAYS.map((d) => <th key={d} className="th text-center">{d}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {assignments.map((a) => {
                    const sc = schedules.find((s) => s.id === a.scheduleId);
                    return (
                      <tr key={a.id}>
                        <td className="td font-semibold">{staffName(a.staffId)}</td>
                        {WEEKDAYS.map((d) => {
                          const b = timeBlocks.find((x) => x.id === sc?.days[d]);
                          return (
                            <td key={d} className="td text-center">
                              {b ? (
                                <span className={cn("chip", "text-white")} style={{ background: b.colour }}>{b.code}</span>
                              ) : (
                                <span className="text-mist-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={blockModal}
        onClose={() => setBlockModal(false)}
        title="Create Time Block"
        wide
        footer={<><Button variant="ghost" onClick={() => setBlockModal(false)}>Cancel</Button>
          <Button disabled={!tb.name || !tb.code} onClick={() => { addTimeBlock(tb); setBlockModal(false); }}>Add Block</Button></>}
      >
        <Grid cols={3}>
          <Field label="Name"><Input value={tb.name} onChange={(e) => setTb({ ...tb, name: e.target.value })} /></Field>
          <Field label="Code"><Input value={tb.code} onChange={(e) => setTb({ ...tb, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Classification"><Select value={tb.classification} onChange={(e) => setTb({ ...tb, classification: e.target.value as Classification })} options={["Working", "Off", "On-call", "Flexible"]} /></Field>
          <Field label="Start"><Input type="time" value={tb.start} onChange={(e) => setTb({ ...tb, start: e.target.value })} /></Field>
          <Field label="End"><Input type="time" value={tb.end} onChange={(e) => setTb({ ...tb, end: e.target.value })} /></Field>
          <Field label="Paid hours"><Input type="number" step="0.5" value={tb.paidHours} onChange={(e) => setTb({ ...tb, paidHours: +e.target.value })} /></Field>
          <Field label="Break (mins)"><Input type="number" value={tb.breakMins} onChange={(e) => setTb({ ...tb, breakMins: +e.target.value })} /></Field>
          <Field label="Late grace (mins)"><Input type="number" value={tb.lateGraceMins} onChange={(e) => setTb({ ...tb, lateGraceMins: +e.target.value })} /></Field>
          <Field label="Colour"><Input type="color" value={tb.colour} onChange={(e) => setTb({ ...tb, colour: e.target.value })} /></Field>
        </Grid>
        <div className="mt-3">
          <Checkbox label="Overnight / crosses midnight" checked={tb.overnight} onChange={(e) => setTb({ ...tb, overnight: e.target.checked })} />
        </div>
      </Modal>

      <Modal
        open={assignModal}
        onClose={() => setAssignModal(false)}
        title="Assign Schedule"
        footer={<><Button variant="ghost" onClick={() => setAssignModal(false)}>Cancel</Button>
          <Button disabled={!af.effectiveFrom} onClick={() => { assignSchedule({ ...af, effectiveFrom: new Date(af.effectiveFrom).toISOString() }); setAssignModal(false); }}>Assign</Button></>}
      >
        <div className="space-y-4">
          <Field label="Employee"><Select value={af.staffId} onChange={(e) => setAf({ ...af, staffId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Schedule"><Select value={af.scheduleId} onChange={(e) => setAf({ ...af, scheduleId: e.target.value })} options={schedules.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Grid cols={2}>
            <Field label="Capture mode"><Select value={af.captureMode} onChange={(e) => setAf({ ...af, captureMode: e.target.value as never })} options={["Attendance", "Manual", "Hybrid"]} /></Field>
            <Field label="Effective from"><Input type="date" value={af.effectiveFrom} onChange={(e) => setAf({ ...af, effectiveFrom: e.target.value })} /></Field>
          </Grid>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Conflicting same-level assignments for overlapping dates are blocked until one is marked primary (BL-2.1.4).
          </p>
        </div>
      </Modal>
    </div>
  );
}
