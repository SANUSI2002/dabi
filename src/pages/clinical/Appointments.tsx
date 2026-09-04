import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { PageHeader, Button, Badge, statusTone, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import { useHr } from "@/store/useHr";

export default function Appointments() {
  const { appointments, patientById, bookAppointment, markAppointment } = useEmr();
  const clinicians = useHr((s) => s.staff.filter((x) => x.status === "Active"));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", date: "", time: "09:00", provider: clinicians[0]?.name ?? "", type: "General", reason: "" });

  const today = appointments.filter((a) => shortDate(a.date) === shortDate(new Date()));
  const noShows = appointments.filter((a) => a.status === "No-Show");

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} scheduled`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <CalendarPlus size={15} /> Book Appointment
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={appointments.length} tone="brand" />
        <StatCard label="Today" value={today.length} tone="mist" delay={0.05} />
        <StatCard label="No-shows" value={noShows.length} tone="action" delay={0.1} />
        <StatCard label="Attended" value={appointments.filter((a) => a.status === "Attended").length} tone="brand" delay={0.15} />
      </div>

      <Table columns={["Patient", "Date", "Time", "Provider", "Type", "Status", ""]}>
        {appointments.map((a, i) => {
          const p = patientById(a.patientId);
          const station = a.type === "ANC" ? "ANC" : a.type === "Immunization" ? "Immunization" : "Vital";
          return (
            <Row key={a.id} index={i}>
              <Cell className="font-semibold">
                {p ? `${p.firstName} ${p.lastName}` : "—"}
                <span className="block text-[11px] font-normal text-mist-400">{a.reason}</span>
              </Cell>
              <Cell>{shortDate(a.date)}</Cell>
              <Cell>{a.time}</Cell>
              <Cell>{a.provider}</Cell>
              <Cell><Badge tone="mist">{a.type}</Badge></Cell>
              <Cell><Badge tone={statusTone(a.status)}>{a.status}</Badge></Cell>
              <Cell>
                {a.status === "Scheduled" && (
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => markAppointment(a.id, "Attended", station as never)} className="btn-primary px-2.5 py-1 text-xs">
                      Check in
                    </button>
                    <button onClick={() => markAppointment(a.id, "No-Show")} className="btn-ghost px-2 py-1 text-xs">
                      No-show
                    </button>
                  </div>
                )}
              </Cell>
            </Row>
          );
        })}
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Book Appointment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!f.patientId || !f.date}
              onClick={() => { bookAppointment(f as never); setOpen(false); }}
            >
              Book Appointment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Patient">
            <PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} />
          </Field>
          <Grid cols={3}>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
            <Field label="Type">
              <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={["General", "ANC", "PNC", "Follow-up", "Immunization", "Specialist"]} />
            </Field>
          </Grid>
          <Field label="Provider">
            <Select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} options={clinicians.map((s) => s.name)} />
          </Field>
          <Field label="Reason"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
