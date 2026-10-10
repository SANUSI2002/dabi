import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { PageHeader, Button, Badge, statusTone, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import { useHr } from "@/store/useHr";
import type { Appointment } from "@/data/types";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { newIdempotencyKey, useLiveAppointments, useLiveAppointmentsLoad, type LiveAppointment } from "@/emr-live/appointments";

export default function Appointments() {
  const { appointments: demoAppointments, patientById, bookAppointment, markAppointment } = useEmr();
  const clinicians = useHr((s) => s.staff).filter((x) => x.status === "Active");
  // A live hospital's bookings come from its EMR (see src/emr-live/appointments.ts).
  const live = useIsLiveEmr();
  useLiveAppointmentsLoad(live);
  const liveItems = useLiveAppointments((s) => s.items);
  const liveLoaded = useLiveAppointments((s) => s.loaded);
  const liveError = useLiveAppointments((s) => s.error);
  const liveClinicians = useLiveAppointments((s) => s.clinicians);
  const appointments: (Appointment & Partial<LiveAppointment>)[] = live ? liveItems : demoAppointments;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", date: "", time: "09:00", provider: clinicians[0]?.name ?? "", providerUserId: "", type: "General" as Appointment["type"], reason: "" });
  const [bookingKey, setBookingKey] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  function openBooking() {
    setFormError("");
    setBookingKey(newIdempotencyKey());
    setOpen(true);
  }

  async function submitBooking() {
    if (!live) { bookAppointment(f as never); setOpen(false); return; }
    setFormError("");
    setPending(true);
    try {
      await useLiveAppointments.getState().book(f, bookingKey);
      setOpen(false);
    } catch (cause) {
      setFormError(describeEmrError(cause));
    } finally {
      setPending(false);
    }
  }

  /** Live check-in / no-show; the hospital's answer (e.g. "not due yet") shows above the list. */
  async function liveAction(appointment: LiveAppointment, action: "checkIn" | "noShow") {
    setActionError("");
    try { await useLiveAppointments.getState()[action](appointment); } catch (cause) { setActionError(describeEmrError(cause)); }
  }

  const today = appointments.filter((a) => shortDate(a.date) === shortDate(new Date()));
  const noShows = appointments.filter((a) => a.status === "No-Show");

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={`${appointments.length} scheduled`}
        actions={
          <Button onClick={openBooking}>
            <CalendarPlus size={15} /> Book Appointment
          </Button>
        }
      />

      {live && (actionError || liveError) && (
        <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError || liveError}</p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={appointments.length} tone="brand" />
        <StatCard label="Today" value={today.length} tone="mist" delay={0.05} />
        <StatCard label="No-shows" value={noShows.length} tone="action" delay={0.1} />
        <StatCard label="Attended" value={appointments.filter((a) => a.status === "Attended").length} tone="brand" delay={0.15} />
      </div>

      <Table columns={["Patient", "Date", "Time", "Provider", "Type", "Status", ""]}>
        {live && appointments.length === 0 && <EmptyRow colSpan={7}>{liveLoaded ? "No appointments booked." : "Loading appointments…"}</EmptyRow>}
        {appointments.map((a, i) => {
          const p = live ? a.patient : patientById(a.patientId);
          const station = a.type === "ANC" ? "ANC" : a.type === "Immunization" ? "Immunization" : "Vital";
          return (
            <Row key={a.id} index={i}>
              <Cell className="font-semibold">
                <PatientLink patient={p} sub={a.reason} />
              </Cell>
              <Cell>{shortDate(a.date)}</Cell>
              <Cell>{a.time}</Cell>
              <Cell>{a.provider}</Cell>
              <Cell><Badge tone="mist">{a.type}</Badge></Cell>
              <Cell><Badge tone={statusTone(a.status)}>{a.status}</Badge></Cell>
              <Cell>
                {a.status === "Scheduled" && (
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => (live ? void liveAction(a as LiveAppointment, "checkIn") : markAppointment(a.id, "Attended", station as never))} className="btn-primary px-2.5 py-1 text-xs">
                      Check in
                    </button>
                    <button onClick={() => (live ? void liveAction(a as LiveAppointment, "noShow") : markAppointment(a.id, "No-Show"))} className="btn-ghost px-2 py-1 text-xs">
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
              disabled={!f.patientId || !f.date || pending}
              onClick={() => void submitBooking()}
            >
              {pending ? "Booking…" : "Book Appointment"}
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
              <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Appointment["type"] })} options={["General", "ANC", "PNC", "Follow-up", "Immunization", "Specialist"]} />
            </Field>
          </Grid>
          <Field label="Provider">
            {live ? (
              <Select
                value={f.providerUserId}
                onChange={(e) => setF({ ...f, providerUserId: e.target.value })}
                options={[{ value: "", label: "Any available clinician" }, ...liveClinicians.map((c) => ({ value: c.userId, label: c.name }))]}
              />
            ) : (
              <Select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} options={clinicians.map((s) => s.name)} />
            )}
          </Field>
          <Field label="Reason"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          {formError && <p role="alert" className="text-sm text-action-700">{formError}</p>}
        </div>
      </Modal>
    </div>
  );
}
