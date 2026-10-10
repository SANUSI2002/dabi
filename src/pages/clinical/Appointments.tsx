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
import {
  newIdempotencyKey, useLiveAppointments, useLiveAppointmentsLoad,
  type AppointmentRequest, type ConfirmForm, type LiveAppointment,
} from "@/emr-live/appointments";

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
  const liveRequests = useLiveAppointments((s) => s.requests);
  const appointments: (Appointment & Partial<LiveAppointment>)[] = live ? liveItems : demoAppointments;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", date: "", time: "09:00", provider: clinicians[0]?.name ?? "", providerUserId: "", type: "General" as Appointment["type"], reason: "" });
  const [bookingKey, setBookingKey] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  // Requests from the Sabi app (live only): confirm books the patient in; reject tells them why.
  const [confirming, setConfirming] = useState<AppointmentRequest | null>(null);
  const [confirmForm, setConfirmForm] = useState<ConfirmForm>({ patientId: "", type: "General", providerUserId: "" });
  const [confirmKey, setConfirmKey] = useState("");
  const [rejecting, setRejecting] = useState<AppointmentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [requestError, setRequestError] = useState("");

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

  function openConfirm(request: AppointmentRequest) {
    setRequestError("");
    setConfirmForm({ patientId: request.linkedPatient?.id ?? "", type: request.suggestedType, providerUserId: "" });
    setConfirmKey(newIdempotencyKey());
    setConfirming(request);
  }

  function openReject(request: AppointmentRequest) {
    setRequestError("");
    setRejectReason("");
    setRejecting(request);
  }

  /** Confirm / reject; the hospital's answer (e.g. "the time has passed") shows in the dialog. */
  async function decide(work: () => Promise<void>, close: () => void) {
    setRequestError("");
    setPending(true);
    try {
      await work();
      close();
    } catch (cause) {
      setRequestError(describeEmrError(cause));
    } finally {
      setPending(false);
    }
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

      {live && liveRequests.length > 0 && (
        <section aria-labelledby="sabi-requests" className="mb-5">
          <h2 id="sabi-requests" className="mb-2 text-sm font-semibold text-mist-700">
            Requests from the Sabi app ({liveRequests.length})
          </h2>
          <Table columns={["Patient", "Date", "Time", "Visit", "Record", ""]}>
            {liveRequests.map((r, i) => (
              <Row key={r.id} index={i}>
                <Cell className="font-semibold">
                  <div>{r.name}</div>
                  <div className="text-xs font-normal text-mist-400">
                    {[r.requestedBy && `Requested by ${r.requestedBy}`, r.phone].filter(Boolean).join(" · ")}
                  </div>
                </Cell>
                <Cell>{shortDate(r.requestedAt)}</Cell>
                <Cell>{r.time}</Cell>
                <Cell>
                  <div>{r.visit}</div>
                  {r.reason && <div className="text-xs text-mist-400">{r.reason}</div>}
                </Cell>
                <Cell>
                  {r.linkedPatient ? <Badge tone="brand">{r.linkedPatient.mrn}</Badge> : <Badge tone="amber">Not linked</Badge>}
                </Cell>
                <Cell>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => openConfirm(r)} className="btn-primary px-2.5 py-1 text-xs">Confirm</button>
                    <button onClick={() => openReject(r)} className="btn-ghost px-2 py-1 text-xs">Reject</button>
                  </div>
                </Cell>
              </Row>
            ))}
          </Table>
        </section>
      )}

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

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Confirm Request"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button
              disabled={!confirming || !confirmForm.patientId || pending}
              onClick={() => confirming && void decide(() => useLiveAppointments.getState().confirmRequest(confirming, confirmForm, confirmKey), () => setConfirming(null))}
            >
              {pending ? "Confirming…" : "Confirm Appointment"}
            </Button>
          </>
        }
      >
        {confirming && (
          <div className="space-y-4">
            <p className="text-sm text-mist-600">
              {confirming.name} asked for {confirming.visit.toLowerCase()} on {shortDate(confirming.requestedAt)} at {confirming.time}
              {confirming.requestedBy ? ` (requested by ${confirming.requestedBy})` : ""}.
              {confirming.reason ? ` “${confirming.reason}”` : ""}
            </p>
            <Field label="Patient record">
              {confirming.linkedPatient ? (
                <p className="text-sm font-medium text-mist-800">
                  {confirming.linkedPatient.firstName} {confirming.linkedPatient.lastName} · {confirming.linkedPatient.mrn}
                </p>
              ) : (
                <>
                  <PatientPicker value={confirmForm.patientId} onChange={(id) => setConfirmForm({ ...confirmForm, patientId: id })} />
                  <p className="mt-1 text-xs text-mist-400">
                    {confirming.forDependent
                      ? `Choose ${confirming.name}'s own record, or register them first.`
                      : "Not linked to their Sabi account yet. Find their record, or register them first; confirming links it."}
                    {[confirming.dateOfBirth && ` Born ${shortDate(confirming.dateOfBirth)}.`, confirming.phone && ` Phone ${confirming.phone}.`].filter(Boolean).join("")}
                  </p>
                </>
              )}
            </Field>
            <Grid cols={2}>
              <Field label="Type">
                <Select value={confirmForm.type} onChange={(e) => setConfirmForm({ ...confirmForm, type: e.target.value as Appointment["type"] })} options={["General", "ANC", "PNC", "Follow-up", "Immunization", "Specialist"]} />
              </Field>
              <Field label="Provider">
                <Select
                  value={confirmForm.providerUserId}
                  onChange={(e) => setConfirmForm({ ...confirmForm, providerUserId: e.target.value })}
                  options={[{ value: "", label: "Any available clinician" }, ...liveClinicians.map((c) => ({ value: c.userId, label: c.name }))]}
                />
              </Field>
            </Grid>
            {requestError && <p role="alert" className="text-sm text-action-700">{requestError}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject Request"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              disabled={!rejecting || rejectReason.trim().length < 3 || pending}
              onClick={() => rejecting && void decide(() => useLiveAppointments.getState().rejectRequest(rejecting, rejectReason), () => setRejecting(null))}
            >
              {pending ? "Rejecting…" : "Reject Request"}
            </Button>
          </>
        }
      >
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-mist-600">
              {rejecting.name} asked for {rejecting.visit.toLowerCase()} on {shortDate(rejecting.requestedAt)} at {rejecting.time}. They will see your reason in the Sabi app.
            </p>
            <Field label="Reason"><Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></Field>
            {requestError && <p role="alert" className="text-sm text-action-700">{requestError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
