import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, Plus, ArrowRightCircle } from "lucide-react";
import { PageHeader, Button, Badge, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { VitalsModal } from "@/components/clinical/VitalsModal";
import { useEmr } from "@/store/useEmr";
import { STATIONS } from "@/data/catalog";
import { ageFromDob } from "@/lib/format";

export default function ClinicalQueue() {
  const nav = useNavigate();
  const { queue, patientById, addToQueue, advanceQueue } = useEmr();
  const [tab, setTab] = useState<"All" | "Waiting" | "In Progress" | "Completed" | "Referred">("All");
  const [station, setStation] = useState<string>("All Stations");
  const [add, setAdd] = useState(false);
  const [vitalsFor, setVitalsFor] = useState<{ patientId: string; queueId: string } | null>(null);

  const [pid, setPid] = useState<string | null>(null);
  const [pr, setPr] = useState("Normal");
  const [complaint, setComplaint] = useState("");
  const [toStation, setToStation] = useState<string>("Vital");

  const filtered = queue.filter(
    (q) =>
      (tab === "All" || q.status === tab) &&
      (station === "All Stations" || q.station === station),
  );

  const counts = {
    All: queue.length,
    Waiting: queue.filter((q) => q.status === "Waiting").length,
    "In Progress": queue.filter((q) => q.status === "In Progress").length,
    Completed: queue.filter((q) => q.status === "Completed").length,
    Referred: queue.filter((q) => q.status === "Referred").length,
  };

  return (
    <div>
      <PageHeader
        title="Clinical Queue"
        subtitle={`${counts.Waiting} waiting · ${counts["In Progress"]} in progress`}
        actions={
          <>
            <Button variant="ghost">
              <PhoneCall size={15} /> Call Next
            </Button>
            <Button onClick={() => setAdd(true)}>
              <Plus size={15} /> Add to Queue
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`chip transition ${tab === k ? "bg-brand-gradient text-white" : "bg-white text-mist-500 ring-1 ring-mist-200 hover:bg-mist-50"}`}
          >
            {k} <span className="opacity-70">{counts[k]}</span>
          </button>
        ))}
        <select value={station} onChange={(e) => setStation(e.target.value)} className="input ml-auto w-auto py-1.5 text-xs">
          {["All Stations", ...STATIONS].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <Table columns={["Patient", "Age / Sex", "Station", "Priority", "Wait", "Status", "Assigned", ""]}>
        {filtered.map((q, i) => {
          const p = patientById(q.patientId);
          return (
            <Row key={q.id} index={i}>
              <Cell className="font-semibold text-mist-900">
                {p ? `${p.firstName} ${p.lastName}` : "—"}
                <span className="block text-[11px] font-normal text-mist-400">{p?.mrn}</span>
              </Cell>
              <Cell>{p ? `${ageFromDob(p.dob)} · ${p.sex}` : "—"}</Cell>
              <Cell>{q.station}</Cell>
              <Cell>
                <Badge tone={q.priority === "Normal" ? "mist" : "action"}>{q.priority}</Badge>
              </Cell>
              <Cell className="text-mist-400">{q.waitMins}m</Cell>
              <Cell>
                <Badge tone={statusTone(q.status)}>{q.status}</Badge>
              </Cell>
              <Cell>{q.assignedTo?.split(" ").slice(-1)[0] ?? "—"}</Cell>
              <Cell>
                <div className="flex justify-end gap-1.5">
                  {q.station === "Vital" && q.status !== "Completed" && (
                    <button
                      onClick={() => setVitalsFor({ patientId: q.patientId, queueId: q.id })}
                      className="btn-soft px-2.5 py-1 text-xs"
                    >
                      Vitals
                    </button>
                  )}
                  {q.status === "Waiting" && q.station !== "Vital" && (
                    <button
                      onClick={() => advanceQueue(q.id, "In Progress")}
                      className="btn-soft px-2.5 py-1 text-xs"
                    >
                      Start
                    </button>
                  )}
                  {q.status === "In Progress" && q.station === "Consultation" && (
                    <button
                      onClick={() => nav("/consultation")}
                      className="btn-primary px-2.5 py-1 text-xs"
                    >
                      <ArrowRightCircle size={13} /> Continue
                    </button>
                  )}
                </div>
              </Cell>
            </Row>
          );
        })}
      </Table>

      <Modal
        open={add}
        onClose={() => setAdd(false)}
        title="Add to Queue"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdd(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pid}
              onClick={() => {
                if (pid) addToQueue(pid, toStation as never, pr as never, complaint);
                setAdd(false);
                setPid(null);
                setComplaint("");
              }}
            >
              Add to Queue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Patient">
            <PatientPicker value={pid} onChange={setPid} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First station">
              <Select value={toStation} onChange={(e) => setToStation(e.target.value)} options={[...STATIONS]} />
            </Field>
            <Field label="Priority">
              <Select value={pr} onChange={(e) => setPr(e.target.value)} options={["Normal", "Urgent", "Emergency"]} />
            </Field>
          </div>
          <Field label="Reason / chief complaint">
            <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Fever for 2 days, headache" />
          </Field>
        </div>
      </Modal>

      {vitalsFor && (
        <VitalsModal
          patientId={vitalsFor.patientId}
          queueId={vitalsFor.queueId}
          open
          onClose={() => setVitalsFor(null)}
        />
      )}
    </div>
  );
}
