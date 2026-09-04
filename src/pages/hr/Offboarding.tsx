import { useState } from "react";
import { LogOut, Plus, CheckCircle2, Wallet, MessageSquare, ClipboardList } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useOffboarding } from "@/store/useOffboarding";
import { useHr } from "@/store/useHr";
import { shortDate, initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EXIT_REASONS } from "@/data/offboarding";

export default function Offboarding() {
  const { stages, cases, initiate, recordExitInterview, recordHandover, settleFnf, canAdvance, advanceStage } = useOffboarding();
  const staff = useHr((s) => s.staff);

  const ongoing = cases.filter((c) => c.status === "Ongoing");
  const completed = cases.filter((c) => c.status === "Completed");
  const eligible = staff.filter((s) => s.status === "Active" && !cases.some((c) => c.employeeId === s.id && c.status === "Ongoing"));

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ employeeId: eligible[0]?.id ?? "", reason: EXIT_REASONS[0], lastWorkingDate: "" });
  const [ivFor, setIvFor] = useState<string | null>(null);
  const [ivNotes, setIvNotes] = useState("");
  const [hoFor, setHoFor] = useState<string | null>(null);
  const [hoNotes, setHoNotes] = useState("");
  const [fnfFor, setFnfFor] = useState<string | null>(null);
  const [fnfAmount, setFnfAmount] = useState(0);

  return (
    <div>
      <PageHeader
        title="Offboarding"
        subtitle="Exit workflow — notice, exit interview, handover, final settlement"
        actions={<Button variant="action" onClick={() => { setF({ employeeId: eligible[0]?.id ?? "", reason: EXIT_REASONS[0], lastWorkingDate: "" }); setOpen(true); }}><Plus size={15} /> Initiate offboarding</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ongoing" value={ongoing.length} tone={ongoing.length ? "amber" : "mist"} icon={<LogOut size={18} />} />
        <StatCard label="Completed" value={completed.length} tone="brand" delay={0.05} />
        <StatCard label="FNF settled" value={cases.filter((c) => c.fnfSettled).length} tone="mist" delay={0.1} icon={<Wallet size={18} />} />
        <StatCard label="Eligible staff" value={eligible.length} tone="mist" delay={0.15} />
      </div>

      <div className="space-y-4">
        {ongoing.map((c) => {
          const emp = staff.find((s) => s.id === c.employeeId);
          const stage = stages.find((s) => s.id === c.currentStageId)!;
          const ready = canAdvance(c.id);
          return (
            <Card key={c.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-action-gradient text-xs font-bold text-white">{initials(emp?.name ?? "?")}</span>
                  <div>
                    <p className="font-display font-bold text-mist-900">{emp?.name ?? c.employeeId}</p>
                    <p className="text-[11px] text-mist-400">{c.reason} · notice {shortDate(c.noticeDate)} · last working day {shortDate(c.lastWorkingDate)}</p>
                  </div>
                </div>
                <Badge tone="amber">{stage.title}</Badge>
              </div>

              <div className="mb-4 flex items-center gap-1">
                {stages.map((s, i) => (
                  <div key={s.id} className="flex flex-1 items-center gap-1">
                    <div className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                      s.sequence < stage.sequence ? "bg-action-gradient text-white" : s.id === stage.id ? "bg-amber-400 text-white" : "bg-mist-100 text-mist-400",
                    )}>
                      {s.sequence < stage.sequence ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    {s.sequence < stages.length - 1 && <div className={cn("h-0.5 flex-1", s.sequence < stage.sequence ? "bg-action-400" : "bg-mist-100")} />}
                  </div>
                ))}
              </div>

              {stage.type === "Exit Interview" && (
                <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm">
                  {c.exitInterviewNotes ? (
                    <p className="text-mist-600">“{c.exitInterviewNotes}”</p>
                  ) : (
                    <button onClick={() => { setIvFor(c.id); setIvNotes(""); }} className="btn-soft text-xs"><MessageSquare size={12} /> Record exit interview</button>
                  )}
                </div>
              )}
              {stage.type === "Work Handover" && (
                <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm">
                  {c.handoverNotes ? (
                    <p className="text-mist-600">“{c.handoverNotes}”</p>
                  ) : (
                    <button onClick={() => { setHoFor(c.id); setHoNotes(""); }} className="btn-soft text-xs"><ClipboardList size={12} /> Record work handover</button>
                  )}
                </div>
              )}
              {stage.type === "FNF Settlement" && (
                <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm">
                  {c.fnfSettled ? (
                    <p className="font-semibold text-brand-700">Final settlement paid — ₦{c.fnfAmount?.toLocaleString()}</p>
                  ) : (
                    <button onClick={() => { setFnfFor(c.id); setFnfAmount(0); }} className="btn-soft text-xs"><Wallet size={12} /> Settle final pay</button>
                  )}
                </div>
              )}
              {stage.type === "Farewell" && <p className="text-sm text-mist-500">Wish {emp?.name?.split(" ")[0]} well, then archive to complete the exit.</p>}

              <div className="mt-3 flex justify-end">
                <Button variant={stage.type === "Farewell" ? "action" : "ghost"} disabled={!ready} onClick={() => advanceStage(c.id)}>
                  {stage.type === "Farewell" ? "Archive & deactivate" : "Next stage"}
                </Button>
              </div>
            </Card>
          );
        })}
        {ongoing.length === 0 && <Card className="text-sm text-mist-400">No offboarding in progress.</Card>}
      </div>

      {completed.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display font-bold text-mist-900">Completed exits</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {completed.map((c) => {
              const emp = staff.find((s) => s.id === c.employeeId);
              return (
                <Card key={c.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-mist-900">{emp?.name ?? c.employeeId}</p>
                    <p className="text-[11px] text-mist-400">{c.reason} · archived {c.completedAt ? shortDate(c.completedAt) : "—"}</p>
                  </div>
                  <Badge tone="mist">Archived</Badge>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Initiate offboarding"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="action" disabled={!f.employeeId || !f.lastWorkingDate} onClick={() => { initiate(f.employeeId, f.reason, new Date(f.lastWorkingDate).toISOString()); setOpen(false); }}>Start exit process</Button></>}
      >
        <div className="space-y-4">
          <Field label="Employee"><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} options={eligible.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Reason"><Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} options={EXIT_REASONS} /></Field>
          <Field label="Last working date"><Input type="date" value={f.lastWorkingDate} onChange={(e) => setF({ ...f, lastWorkingDate: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!ivFor} onClose={() => setIvFor(null)} title="Exit interview notes"
        footer={<><Button variant="ghost" onClick={() => setIvFor(null)}>Cancel</Button><Button disabled={!ivNotes.trim()} onClick={() => { if (ivFor) recordExitInterview(ivFor, ivNotes.trim()); setIvFor(null); }}>Save</Button></>}>
        <Field label="Notes"><Textarea value={ivNotes} onChange={(e) => setIvNotes(e.target.value)} placeholder="Reason discussed, feedback on the role/team, would they recommend the facility…" /></Field>
      </Modal>

      <Modal open={!!hoFor} onClose={() => setHoFor(null)} title="Work handover notes"
        footer={<><Button variant="ghost" onClick={() => setHoFor(null)}>Cancel</Button><Button disabled={!hoNotes.trim()} onClick={() => { if (hoFor) recordHandover(hoFor, hoNotes.trim()); setHoFor(null); }}>Save</Button></>}>
        <Field label="Notes"><Textarea value={hoNotes} onChange={(e) => setHoNotes(e.target.value)} placeholder="Outstanding cases, keys/equipment returned, credentials revoked, successor briefed…" /></Field>
      </Modal>

      <Modal open={!!fnfFor} onClose={() => setFnfFor(null)} title="Final settlement (FNF)"
        footer={<><Button variant="ghost" onClick={() => setFnfFor(null)}>Cancel</Button><Button disabled={fnfAmount <= 0} onClick={() => { if (fnfFor) settleFnf(fnfFor, fnfAmount); setFnfFor(null); }}>Mark settled</Button></>}>
        <Field label="Amount (₦)"><Input type="number" value={fnfAmount} onChange={(e) => setFnfAmount(+e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
