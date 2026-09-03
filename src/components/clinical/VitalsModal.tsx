import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/primitives";
import { Field, Input, Select, Grid, Textarea } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { STATIONS } from "@/data/catalog";
import type { Station } from "@/data/types";

export function VitalsModal({
  patientId,
  queueId,
  open,
  onClose,
}: {
  patientId: string;
  queueId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { patientById, recordVitals, advanceQueue } = useEmr();
  const p = patientById(patientId);
  const [v, setV] = useState<Record<string, string>>({});
  const [route, setRoute] = useState<Station>("Consultation");
  const [priority, setPriority] = useState("Normal");

  const num = (k: string) => (v[k] ? +v[k] : undefined);

  function save() {
    recordVitals(patientId, {
      bp: v.bp || undefined,
      temp: num("temp"),
      pulse: num("pulse"),
      resp: num("resp"),
      spo2: num("spo2"),
      weight: num("weight"),
      height: num("height"),
      muac: num("muac"),
      glucose: num("glucose"),
    });
    if (queueId) advanceQueue(queueId, "Waiting", route);
    onClose();
    setV({});
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Vitals & Routing — ${p ? `${p.firstName} ${p.lastName}` : ""}`}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save {queueId ? "& Route" : "Vitals"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {p && (
          <div className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            {p.mrn} · {p.sex} · {p.category}
          </div>
        )}
        <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Vital signs</p>
        <Grid cols={3}>
          <Field label="Blood pressure"><Input placeholder="120/80" value={v.bp ?? ""} onChange={(e) => setV({ ...v, bp: e.target.value })} /></Field>
          <Field label="Temperature (°C)"><Input type="number" step="0.1" value={v.temp ?? ""} onChange={(e) => setV({ ...v, temp: e.target.value })} /></Field>
          <Field label="Pulse (bpm)"><Input type="number" value={v.pulse ?? ""} onChange={(e) => setV({ ...v, pulse: e.target.value })} /></Field>
          <Field label="Resp rate (/min)"><Input type="number" value={v.resp ?? ""} onChange={(e) => setV({ ...v, resp: e.target.value })} /></Field>
          <Field label="SpO₂ (%)"><Input type="number" value={v.spo2 ?? ""} onChange={(e) => setV({ ...v, spo2: e.target.value })} /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.1" value={v.weight ?? ""} onChange={(e) => setV({ ...v, weight: e.target.value })} /></Field>
          <Field label="Height (cm)"><Input type="number" value={v.height ?? ""} onChange={(e) => setV({ ...v, height: e.target.value })} /></Field>
          <Field label="MUAC (cm)"><Input type="number" step="0.1" value={v.muac ?? ""} onChange={(e) => setV({ ...v, muac: e.target.value })} /></Field>
          <Field label="Glucose (mmol/L)"><Input type="number" step="0.1" value={v.glucose ?? ""} onChange={(e) => setV({ ...v, glucose: e.target.value })} /></Field>
        </Grid>
        <Field label="Vitals notes"><Textarea placeholder="Brief observations…" /></Field>

        {queueId && (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Routing</p>
            <Grid cols={2}>
              <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value)} options={["Normal", "Urgent", "Emergency"]} /></Field>
              <Field label="Route to next"><Select value={route} onChange={(e) => setRoute(e.target.value as Station)} options={[...STATIONS]} /></Field>
            </Grid>
          </>
        )}
      </div>
    </Modal>
  );
}
