import { useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Printer, TestTube, PlayCircle, CheckCircle2, ShieldCheck, Undo2, Settings as SettingsIcon, Eye } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { LabReportDoc } from "@/components/print/documents";
import { LabProgress, labSteps } from "@/components/lab/LabProgress";
import { useEmr } from "@/store/useEmr";
import { useLabConfig } from "@/store/useLabConfig";
import { useIdentity } from "@/store/useIdentity";
import { dateTime, shortDate } from "@/lib/format";

const SAMPLE_TYPES = ["Venous blood (EDTA)", "Venous blood (Plain)", "Capillary blood", "Urine", "Stool", "Sputum", "Swab", "Other"];

export default function Laboratory() {
  const { labOrders, patientById, collectSample, startProcessing, advancePhase, submitLabResult, approveLabResult, sendLabResultBack } = useEmr();
  const { configFor } = useLabConfig();
  const user = useIdentity((s) => s.user);
  const canApprove = user.role === "Lab Technician" || user.systemRole === "System Administrator";

  const [printPid, setPrintPid] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [collectFor, setCollectFor] = useState<string | null>(null);
  const [sampleType, setSampleType] = useState(SAMPLE_TYPES[0]);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [flag, setFlag] = useState<"Normal" | "Low" | "High" | "Critical">("Normal");
  const [backFor, setBackFor] = useState<string | null>(null);
  const [backNote, setBackNote] = useState("");

  const pending = labOrders.filter((l) => l.status !== "Resulted" && l.status !== "Rejected");
  const done = labOrders.filter((l) => l.status === "Resulted");
  const awaiting = labOrders.filter((l) => l.status === "Awaiting Approval");
  const viewOrder = labOrders.find((l) => l.id === viewId);
  const resultOrder = labOrders.find((l) => l.id === resultFor);

  function openResult(order: typeof labOrders[number]) {
    const cfg = configFor(order.test);
    const blank: Record<string, string> = {};
    cfg.resultTemplate.forEach((f) => (blank[f.label] = ""));
    setFields(blank);
    setFlag("Normal");
    setResultFor(order.id);
  }

  return (
    <div>
      <PageHeader title="Laboratory" subtitle={`${pending.length} pending · ${done.length} resulted`} actions={
        <Link to="/laboratory/test-settings" className="btn-ghost text-xs"><SettingsIcon size={13} /> Test settings</Link>
      } />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={labOrders.length} tone="brand" icon={<FlaskConical size={18} />} />
        <StatCard label="Pending" value={pending.length} tone="action" delay={0.05} />
        <StatCard label="Awaiting approval" value={awaiting.length} tone="amber" delay={0.1} />
        <StatCard label="Resulted" value={done.length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={[`Pending Orders (${pending.length})`, `Results (${done.length})`]}>
        {(t) =>
          t.startsWith("Pending") ? (
            <div className="space-y-3">
              {pending.map((l) => {
                const p = patientById(l.patientId);
                const cfg = configFor(l.test);
                return (
                  <Card key={l.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display font-bold text-mist-900">{l.test}</p>
                        <p className="text-[11px] text-mist-400">
                          {p ? `${p.firstName} ${p.lastName}` : "—"} · {l.category} · ordered {dateTime(l.orderedAt)} by {l.orderedBy}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={l.urgency === "Urgent" ? "action" : "mist"}>{l.urgency}</Badge>
                        <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                      </div>
                    </div>

                    <LabProgress order={l} phases={cfg.phases} />

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {l.status === "Pending" && (
                        <Button onClick={() => { setSampleType(SAMPLE_TYPES[0]); setCollectFor(l.id); }}>
                          <TestTube size={14} /> Collect sample
                        </Button>
                      )}
                      {l.status === "Sample Collected" && (
                        <Button onClick={() => startProcessing(l.id)}>
                          <PlayCircle size={14} /> Start processing
                        </Button>
                      )}
                      {l.status === "In Process" && (
                        (l.phaseIndex ?? 0) < cfg.phases.length - 1 ? (
                          <Button onClick={() => advancePhase(l.id, cfg.phases[l.phaseIndex ?? 0])}>
                            <CheckCircle2 size={14} /> Complete "{cfg.phases[l.phaseIndex ?? 0]}"
                          </Button>
                        ) : (
                          <Button onClick={() => openResult(l)}>
                            <CheckCircle2 size={14} /> Complete final phase & enter result
                          </Button>
                        )
                      )}
                      {l.status === "Awaiting Approval" && (
                        canApprove ? (
                          <>
                            <Button variant="ghost" onClick={() => { setBackFor(l.id); setBackNote(""); }}><Undo2 size={14} /> Send back</Button>
                            <Button variant="soft" onClick={() => setViewId(l.id)}><Eye size={14} /> Review result</Button>
                            <Button onClick={() => approveLabResult(l.id)}><ShieldCheck size={14} /> Approve</Button>
                          </>
                        ) : (
                          <p className="text-xs text-mist-400">Awaiting a lab scientist's sign-off.</p>
                        )
                      )}
                    </div>
                    {l.revisionNote && l.status === "In Process" && (
                      <p className="mt-2 rounded-lg bg-action-50 px-3 py-2 text-xs text-action-600">Sent back: {l.revisionNote}</p>
                    )}
                  </Card>
                );
              })}
              {pending.length === 0 && <Card className="text-center text-mist-400">No pending orders.</Card>}
            </div>
          ) : (
            <div className="card p-0">
              <table className="w-full">
                <thead className="border-b border-mist-200 bg-mist-50/60">
                  <tr>{["Patient", "Test", "Flag", "Approved By", ""].map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {done.map((l) => {
                    const p = patientById(l.patientId);
                    return (
                      <tr key={l.id}>
                        <td className="td font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                        <td className="td">{l.test}</td>
                        <td className="td"><Badge tone={statusTone(l.flag ?? "Normal")}>{l.flag}</Badge></td>
                        <td className="td text-mist-500">{l.approvedBy ?? l.verifiedBy}</td>
                        <td className="td text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setViewId(l.id)} className="btn-ghost px-2.5 py-1 text-xs"><Eye size={13} /> View</button>
                            <button onClick={() => setPrintPid(l.patientId)} className="btn-ghost px-2.5 py-1 text-xs"><Printer size={13} /> Print</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {done.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-mist-400">No results recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )
        }
      </Tabs>

      {/* Collect sample */}
      <Modal
        open={!!collectFor}
        onClose={() => setCollectFor(null)}
        title="Collect sample"
        footer={<><Button variant="ghost" onClick={() => setCollectFor(null)}>Cancel</Button>
          <Button onClick={() => { if (collectFor) collectSample(collectFor, sampleType); setCollectFor(null); }}>Confirm collection</Button></>}
      >
        <div className="space-y-4">
          <Field label="Sample type"><Select value={sampleType} onChange={(e) => setSampleType(e.target.value)} options={SAMPLE_TYPES} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Recorded as collected by <b className="text-mist-700">{user.name}</b> (signed-in user).</p>
        </div>
      </Modal>

      {/* Enter result — structured template */}
      <Modal
        open={!!resultFor}
        onClose={() => setResultFor(null)}
        title={`Enter result — ${resultOrder?.test ?? ""}`}
        wide
        footer={<><Button variant="ghost" onClick={() => setResultFor(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!resultFor || !resultOrder) return;
            const cfg = configFor(resultOrder.test);
            submitLabResult(resultFor, fields, flag, cfg.phases[cfg.phases.length - 1]);
            setResultFor(null);
          }}>Submit for approval</Button></>}
      >
        {resultOrder && (
          <div className="space-y-4">
            <Grid cols={2}>
              {configFor(resultOrder.test).resultTemplate.map((f) => (
                <Field key={f.id} label={f.unit ? `${f.label} (${f.unit})` : f.label} hint={f.refRange ? `Reference: ${f.refRange}` : undefined}>
                  <Input value={fields[f.label] ?? ""} onChange={(e) => setFields({ ...fields, [f.label]: e.target.value })} />
                </Field>
              ))}
            </Grid>
            <Field label="Overall flag"><Select value={flag} onChange={(e) => setFlag(e.target.value as never)} options={["Normal", "Low", "High", "Critical"]} /></Field>
            <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Submitted by <b className="text-mist-700">{user.name}</b> — routes to sign-off before it's visible as final.</p>
          </div>
        )}
      </Modal>

      {/* Send back for revision */}
      <Modal
        open={!!backFor}
        onClose={() => setBackFor(null)}
        title="Send back for revision"
        footer={<><Button variant="ghost" onClick={() => setBackFor(null)}>Cancel</Button>
          <Button variant="action" disabled={!backNote.trim()} onClick={() => { if (backFor) sendLabResultBack(backFor, backNote.trim()); setBackFor(null); }}>Send back</Button></>}
      >
        <Field label="Reason"><Textarea value={backNote} onChange={(e) => setBackNote(e.target.value)} placeholder="What needs to be corrected?" /></Field>
      </Modal>

      {/* View result — read-only template */}
      <Modal open={!!viewId} onClose={() => setViewId(null)} title={`Result — ${viewOrder?.test ?? ""}`} wide footer={<Button onClick={() => setViewId(null)}>Close</Button>}>
        {viewOrder && (
          <div className="space-y-3">
            <LabProgress order={viewOrder} phases={configFor(viewOrder.test).phases} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {configFor(viewOrder.test).resultTemplate.map((f) => (
                <div key={f.id} className="rounded-xl bg-mist-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-mist-400">{f.label}{f.unit ? ` (${f.unit})` : ""}</p>
                  <p className="text-sm font-semibold text-mist-800">{viewOrder.resultFields?.[f.label] || "—"}</p>
                  {f.refRange && <p className="text-[10px] text-mist-400">Ref: {f.refRange}</p>}
                </div>
              ))}
            </div>
            {viewOrder.phaseLog && viewOrder.phaseLog.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-mist-400">Phase history</p>
                <div className="space-y-1">
                  {viewOrder.phaseLog.map((h, i) => (
                    <p key={i} className="text-xs text-mist-500">{h.name} — {h.by} · {shortDate(h.at)}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {printPid && patientById(printPid) && (
        <LabReportDoc
          patient={patientById(printPid)!}
          orders={labOrders.filter((l) => l.patientId === printPid && l.status === "Resulted")}
          open
          onClose={() => setPrintPid(null)}
        />
      )}
    </div>
  );
}
