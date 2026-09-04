import { useState } from "react";
import { CalendarOff, Plus, Palmtree } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Textarea, Checkbox } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useHr } from "@/store/useHr";
import { shortDate } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";

export default function HolidayLeave() {
  const { holidays, leave, holidayWork, addHoliday, requestLeave, setLeaveStatus, setHolidayWorkStatus } = useWorkforce();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const [hOpen, setHOpen] = useState(false);
  const [lOpen, setLOpen] = useState(false);
  const [hf, setHf] = useState({ name: "", date: "", scope: "Organisation" as const, scopeValue: "All facilities", paid: true, workRequiresApproval: true });
  const [lf, setLf] = useState({ staffId: staff[0]?.id ?? "", type: "Annual" as const, from: "", to: "", paid: true, note: "" });

  const pendingLeave = leave.filter((l) => l.status === "Pending");
  const onLeaveNow = leave.filter((l) => {
    const now = Date.now();
    return l.status === "Approved" && +new Date(l.to) <= now && +new Date(l.from) >= now - 30 * 864e5;
  });

  return (
    <div>
      <PageHeader
        title="Holiday & Leave"
        subtitle="Holiday applicability, approved leave and work-on-holiday approvals — applied to expected and worked time"
        actions={
          <>
            <Button variant="ghost" onClick={() => setHOpen(true)}><Plus size={15} /> Add Holiday</Button>
            <Button onClick={() => setLOpen(true)}><Plus size={15} /> Request Leave</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Holidays configured" value={holidays.length} tone="brand" icon={<Palmtree size={18} />} />
        <StatCard label="Leave requests" value={leave.length} tone="mist" delay={0.05} />
        <StatCard label="Pending approval" value={pendingLeave.length} tone="amber" delay={0.1} />
        <StatCard label="Work-on-holiday" value={holidayWork.length} tone="mist" delay={0.15} icon={<CalendarOff size={18} />} />
      </div>

      <Tabs tabs={[`Leave (${leave.length})`, "Holiday Calendar", `Work on Holiday (${holidayWork.length})`]}>
        {(t) =>
          t.startsWith("Leave") ? (
            <Table columns={["Employee", "Type", "From", "To", "Days", "Paid", "Status", ""]}>
              {leave.map((l, i) => (
                <Row key={l.id} index={i}>
                  <Cell className="font-semibold">{name(l.staffId)}</Cell>
                  <Cell><Badge tone="mist">{l.type}</Badge></Cell>
                  <Cell>{shortDate(l.from)}</Cell>
                  <Cell>{shortDate(l.to)}</Cell>
                  <Cell>{l.days}</Cell>
                  <Cell>{l.paid ? "✓" : "Unpaid"}</Cell>
                  <Cell><Badge tone={statusTone(l.status)}>{l.status}</Badge></Cell>
                  <Cell>
                    {l.status === "Pending" && (
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setLeaveStatus(l.id, "Approved")} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
                        <button onClick={() => setLeaveStatus(l.id, "Rejected")} className="btn-action px-2.5 py-1 text-xs">Reject</button>
                      </div>
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
          ) : t === "Holiday Calendar" ? (
            <Table columns={["Holiday", "Date", "Applicability", "Paid", "Work needs approval"]}>
              {[...holidays].sort((a, b) => +new Date(a.date) - +new Date(b.date)).map((h, i) => (
                <Row key={h.id} index={i}>
                  <Cell className="font-semibold">{h.name}</Cell>
                  <Cell>{shortDate(h.date)}</Cell>
                  <Cell><Badge tone="mist">{h.scope}: {h.scopeValue}</Badge></Cell>
                  <Cell>{h.paid ? "Paid" : "Unpaid"}</Cell>
                  <Cell>{h.workRequiresApproval ? <Badge tone="amber">Yes</Badge> : "No"}</Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Table columns={["Employee", "Holiday", "Reason", "Hours", "Status", ""]}>
              {holidayWork.map((w, i) => {
                const h = holidays.find((x) => x.id === w.holidayId);
                return (
                  <Row key={w.id} index={i}>
                    <Cell className="font-semibold">{name(w.staffId)}</Cell>
                    <Cell>{h?.name ?? w.holidayId}</Cell>
                    <Cell className="max-w-[260px] text-mist-600">{w.reason}</Cell>
                    <Cell>{w.hours}h</Cell>
                    <Cell><Badge tone={statusTone(w.status)}>{w.status}</Badge></Cell>
                    <Cell>
                      {w.status === "Pending" && (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => setHolidayWorkStatus(w.id, "Approved")} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
                          <button onClick={() => setHolidayWorkStatus(w.id, "Rejected")} className="btn-action px-2.5 py-1 text-xs">Reject</button>
                        </div>
                      )}
                    </Cell>
                  </Row>
                );
              })}
              {holidayWork.length === 0 && <Row><Cell className="text-mist-400">No work-on-holiday requests.</Cell></Row>}
            </Table>
          )
        }
      </Tabs>

      {onLeaveNow.length > 0 && (
        <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          On approved leave in this window: {onLeaveNow.map((l) => name(l.staffId)).join(", ")} — expected hours are zeroed and not counted as absence.
        </div>
      )}

      <Modal
        open={hOpen}
        onClose={() => setHOpen(false)}
        title="Add Holiday"
        footer={<><Button variant="ghost" onClick={() => setHOpen(false)}>Cancel</Button>
          <Button disabled={!hf.name || !hf.date} onClick={() => { addHoliday({ ...hf, date: hf.date }); setHOpen(false); }}>Add</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Name"><Input value={hf.name} onChange={(e) => setHf({ ...hf, name: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={hf.date} onChange={(e) => setHf({ ...hf, date: e.target.value })} /></Field>
            <Field label="Applicability scope"><Select value={hf.scope} onChange={(e) => setHf({ ...hf, scope: e.target.value as never })} options={["Organisation", "Location", "Group", "Schedule"]} /></Field>
            <Field label="Scope value"><Input value={hf.scopeValue} onChange={(e) => setHf({ ...hf, scopeValue: e.target.value })} /></Field>
          </Grid>
          <div className="flex gap-6">
            <Checkbox label="Paid holiday" checked={hf.paid} onChange={(e) => setHf({ ...hf, paid: e.target.checked })} />
            <Checkbox label="Work on this holiday needs approval" checked={hf.workRequiresApproval} onChange={(e) => setHf({ ...hf, workRequiresApproval: e.target.checked })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={lOpen}
        onClose={() => setLOpen(false)}
        title="Request Leave"
        footer={<><Button variant="ghost" onClick={() => setLOpen(false)}>Cancel</Button>
          <Button
            disabled={!lf.staffId || !lf.from || !lf.to}
            onClick={() => {
              const days = Math.abs(differenceInCalendarDays(new Date(lf.to), new Date(lf.from))) + 1;
              requestLeave({ ...lf, from: new Date(lf.from).toISOString(), to: new Date(lf.to).toISOString(), days });
              setLOpen(false);
            }}
          >Submit</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Employee"><Select value={lf.staffId} onChange={(e) => setLf({ ...lf, staffId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <Field label="Leave type"><Select value={lf.type} onChange={(e) => setLf({ ...lf, type: e.target.value as never })} options={["Annual", "Sick", "Maternity", "Compassionate", "Study", "Unpaid"]} /></Field>
            <Field label="From"><Input type="date" value={lf.from} onChange={(e) => setLf({ ...lf, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={lf.to} onChange={(e) => setLf({ ...lf, to: e.target.value })} /></Field>
          </Grid>
          <Checkbox label="Paid leave" checked={lf.paid} onChange={(e) => setLf({ ...lf, paid: e.target.checked })} />
          <Field label="Note"><Textarea value={lf.note} onChange={(e) => setLf({ ...lf, note: e.target.value })} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Approved leave sets expected working time to zero for the covered dates and is never counted as lateness or absence during timesheet reconciliation.
          </p>
        </div>
      </Modal>
    </div>
  );
}
