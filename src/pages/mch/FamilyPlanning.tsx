import { useMemo, useState } from "react";
import { Users, Plus, CalendarClock, RefreshCw, XCircle } from "lucide-react";
import { Bars } from "@/components/ui/Chart";
import { PageHeader, Button, Badge, StatCard, statusTone, Card } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { useIdentity } from "@/store/useIdentity";
import { FP_METHODS } from "@/data/catalog";
import { shortDate, ageFromDob, timeAgo } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";
import type { FpVisitType } from "@/data/types";

// annual couple-years-of-protection contribution by method (WHO/USAID factors, per client-year on method)
const CYP: Record<string, number> = {
  "Implant": 2.5, "IUCD": 4.6,
  "Injectable (DMPA-IM)": 1.0, "Injectable (DMPA-SC)": 1.0,
  "Oral Pill": 1.0, "Male Condom": 0.5, "Female Condom": 0.5,
  "LAM": 0.25, "Natural / Calendar": 0.25,
};
const VISIT_TYPES: FpVisitType[] = ["Revisit", "Resupply", "Switch method", "Removal"];

export default function FamilyPlanning() {
  const { fpClients, patientById, addFpClient, addFpVisit, discontinueFp } = useEmr();
  const me = useIdentity((s) => s.user.name);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", method: FP_METHODS[0], firstTime: false, startDate: "", nextVisit: "", counselled: true, notes: "" });
  const [visitFor, setVisitFor] = useState<string | null>(null);
  const [vf, setVf] = useState<{ type: FpVisitType; method: string; nextVisit: string; notes: string }>({ type: "Resupply", method: "", nextVisit: "", notes: "" });
  const [discFor, setDiscFor] = useState<string | null>(null);
  const [discReason, setDiscReason] = useState("");

  const active = fpClients.filter((c) => c.status === "Active");
  const dueFollowUp = active.filter((c) => c.nextVisit && differenceInCalendarDays(new Date(c.nextVisit), new Date()) <= 7);
  const overdue = active.filter((c) => c.nextVisit && differenceInCalendarDays(new Date(c.nextVisit), new Date()) < 0);
  const totalCyp = useMemo(() => active.reduce((n, c) => n + (CYP[c.method] ?? 0), 0), [active]);

  const methodMix = FP_METHODS.map((m) => ({ label: m.split(" (")[0], clients: active.filter((c) => c.method === m).length })).filter((x) => x.clients > 0);

  return (
    <div>
      <PageHeader
        title="Family Planning"
        subtitle={`${active.length} active clients · ${totalCyp.toFixed(1)} CYP`}
        actions={<Button onClick={() => { setF({ patientId: "", method: FP_METHODS[0], firstTime: false, startDate: "", nextVisit: "", counselled: true, notes: "" }); setOpen(true); }}><Plus size={15} /> New client</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active clients" value={active.length} tone="brand" icon={<Users size={18} />} />
        <StatCard label="CYP (protection)" value={totalCyp.toFixed(1)} tone="brand" delay={0.05} />
        <StatCard label="Due ≤ 7 days" value={dueFollowUp.length} tone={dueFollowUp.length ? "amber" : "mist"} delay={0.1} icon={<CalendarClock size={18} />} />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? "action" : "brand"} delay={0.15} />
      </div>

      <Tabs tabs={["FP Clients", `Follow-up (${dueFollowUp.length})`, "Method Mix"]}>
        {(t) =>
          t === "FP Clients" ? (
            <Table columns={["Patient", "Age", "Method", "New", "Started", "Next visit", "Visits", "Status", ""]}>
              {fpClients.map((c, i) => {
                const p = patientById(c.patientId);
                const late = c.status === "Active" && c.nextVisit && differenceInCalendarDays(new Date(c.nextVisit), new Date()) < 0;
                return (
                  <Row key={c.id} index={i} className={late ? "bg-action-50/40" : undefined}>
                    <Cell><PatientLink patient={p} /></Cell>
                    <Cell>{p ? ageFromDob(p.dob) : "—"}</Cell>
                    <Cell><Badge tone="mist">{c.method}</Badge></Cell>
                    <Cell>{c.firstTime ? "Yes" : "No"}</Cell>
                    <Cell className="text-mist-400">{shortDate(c.startDate)}</Cell>
                    <Cell className={late ? "font-semibold text-action-600" : "text-mist-500"}>{c.nextVisit ? shortDate(c.nextVisit) : "—"}</Cell>
                    <Cell>{c.visits?.length ?? 1}</Cell>
                    <Cell><Badge tone={statusTone(c.status)}>{c.status}</Badge>{c.discontinueReason && <span className="block text-[11px] text-mist-400">{c.discontinueReason}</span>}</Cell>
                    <Cell>
                      {c.status === "Active" && (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => { setVisitFor(c.id); setVf({ type: "Resupply", method: c.method, nextVisit: "", notes: "" }); }} className="btn-primary px-2.5 py-1 text-xs"><RefreshCw size={12} /> Visit</button>
                          <button onClick={() => { setDiscFor(c.id); setDiscReason(""); }} className="btn-ghost px-2 py-1 text-xs"><XCircle size={12} /> Stop</button>
                        </div>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : t.startsWith("Follow-up") ? (
            <Table columns={["Patient", "Method", "Next visit", "Status", "Last seen", ""]}>
              {dueFollowUp.sort((a, b) => +new Date(a.nextVisit!) - +new Date(b.nextVisit!)).map((c, i) => {
                const overdueDays = differenceInCalendarDays(new Date(), new Date(c.nextVisit!));
                const last = c.visits?.[c.visits.length - 1];
                return (
                  <Row key={c.id} index={i} className={overdueDays > 0 ? "bg-action-50/40" : undefined}>
                    <Cell><PatientLink patient={patientById(c.patientId)} /></Cell>
                    <Cell><Badge tone="mist">{c.method}</Badge></Cell>
                    <Cell>{shortDate(c.nextVisit!)}</Cell>
                    <Cell><Badge tone={overdueDays > 0 ? "action" : "amber"}>{overdueDays > 0 ? `${overdueDays}d overdue` : `in ${-overdueDays}d`}</Badge></Cell>
                    <Cell className="text-mist-400">{last ? timeAgo(last.date) : "—"}</Cell>
                    <Cell>
                      <button onClick={() => { setVisitFor(c.id); setVf({ type: "Resupply", method: c.method, nextVisit: "", notes: "" }); }} className="btn-primary px-2.5 py-1 text-xs">Record visit</button>
                    </Cell>
                  </Row>
                );
              })}
              {dueFollowUp.length === 0 && <Row><Cell className="text-mist-400">No clients due in the next 7 days.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
            </Table>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">Method mix (active clients)</h3>
                {methodMix.length ? (
                  <Bars data={methodMix} x="label" height={260} series={[{ key: "clients", label: "Clients", color: "#0fc06d" }]} />
                ) : (
                  <p className="text-sm text-mist-400">No active clients.</p>
                )}
              </Card>
              <Card>
                <h3 className="mb-3 font-display font-bold text-mist-900">CYP by method</h3>
                <div className="space-y-1.5 text-sm">
                  {FP_METHODS.filter((m) => active.some((c) => c.method === m)).map((m) => {
                    const cnt = active.filter((c) => c.method === m).length;
                    return (
                      <div key={m} className="flex items-center justify-between border-b border-dashed border-mist-100 py-1.5">
                        <span className="text-mist-600">{m} <span className="text-mist-400">×{cnt}</span></span>
                        <span className="font-semibold text-mist-900">{(cnt * (CYP[m] ?? 0)).toFixed(1)} CYP</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 font-bold text-mist-900">
                    <span>Total</span><span>{totalCyp.toFixed(1)} CYP</span>
                  </div>
                </div>
              </Card>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register FP client"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId || !f.startDate} onClick={() => { addFpClient({ ...f, nextVisit: f.nextVisit || undefined } as never); setOpen(false); }}>Save</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient (female)"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} filter={(p) => p.sex === "F"} /></Field>
          <Grid cols={2}>
            <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={FP_METHODS} /></Field>
            <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Next visit"><Input type="date" value={f.nextVisit} onChange={(e) => setF({ ...f, nextVisit: e.target.value })} /></Field>
          </Grid>
          <Checkbox label="First-time FP user (never used contraception before)" checked={f.firstTime} onChange={(e) => setF({ ...f, firstTime: e.target.checked })} />
          <Checkbox label="Counselling provided (incl. postpartum FP)" checked={f.counselled} onChange={(e) => setF({ ...f, counselled: e.target.checked })} />
          <Field label="Notes / side effects"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!visitFor}
        onClose={() => setVisitFor(null)}
        title="Record FP visit"
        footer={<><Button variant="ghost" onClick={() => setVisitFor(null)}>Cancel</Button>
          <Button onClick={() => { if (visitFor) addFpVisit(visitFor, { type: vf.type, method: vf.method, nextVisit: vf.nextVisit ? new Date(vf.nextVisit).toISOString() : undefined, notes: vf.notes.trim() || undefined, by: me }); setVisitFor(null); }}>Save visit</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Visit type"><Select value={vf.type} onChange={(e) => setVf({ ...vf, type: e.target.value as FpVisitType })} options={VISIT_TYPES} /></Field>
            <Field label={vf.type === "Switch method" ? "New method" : "Method"}>
              <Select value={vf.method} onChange={(e) => setVf({ ...vf, method: e.target.value })} options={FP_METHODS} disabled={vf.type !== "Switch method"} />
            </Field>
            <Field label="Next visit"><Input type="date" value={vf.nextVisit} onChange={(e) => setVf({ ...vf, nextVisit: e.target.value })} /></Field>
          </Grid>
          <Field label="Notes"><Textarea value={vf.notes} onChange={(e) => setVf({ ...vf, notes: e.target.value })} placeholder="Side effects, BP, weight, counselling…" /></Field>
          {vf.type === "Removal" && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">A removal marks the client discontinued.</p>}
        </div>
      </Modal>

      <Modal
        open={!!discFor}
        onClose={() => setDiscFor(null)}
        title="Discontinue FP"
        footer={<><Button variant="ghost" onClick={() => setDiscFor(null)}>Cancel</Button>
          <Button variant="action" disabled={!discReason.trim()} onClick={() => { if (discFor) discontinueFp(discFor, discReason.trim()); setDiscFor(null); }}>Discontinue</Button></>}
      >
        <Field label="Reason"><Select value={discReason} onChange={(e) => setDiscReason(e.target.value)} options={["", "Wants to conceive", "Side effects", "Method failure", "Moved away", "Partner objection", "Switched method"].map((r) => ({ value: r, label: r || "Select a reason…" }))} /></Field>
      </Modal>
    </div>
  );
}
