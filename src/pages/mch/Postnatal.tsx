import { useMemo, useState } from "react";
import { HeartPulse, CalendarClock, TriangleAlert } from "lucide-react";
import { PageHeader, Button, StatCard, EmptyState, Badge } from "@/components/ui/primitives";
import { GuidelineBanner } from "@/components/clinical/GuidelineBanner";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";

const DANGER = ["Not feeding well", "Convulsions", "Fast breathing (>60/min)", "Severe chest indrawing", "Hypothermia (<35.5°)", "Fever (>37.5°)", "Jaundice", "Umbilical infection"];

// WHO PNC contact schedule (days postpartum)
const SCHEDULE = [
  { contact: 1 as const, label: "PNC 1 — within 24h", day: 1 },
  { contact: 2 as const, label: "PNC 2 — day 3", day: 3 },
  { contact: 3 as const, label: "PNC 3 — days 7–14", day: 10 },
  { contact: 4 as const, label: "PNC 4 — 6 weeks", day: 42 },
];
const contactFor = (daysPP: number) => (daysPP <= 2 ? 1 : daysPP <= 5 ? 2 : daysPP <= 20 ? 3 : 4) as 1 | 2 | 3 | 4;

export default function Postnatal() {
  const { pncVisits, deliveries, patientById, addPncVisit } = useEmr();
  const [f, setF] = useState({
    patientId: "", deliveryId: "", date: "", timing: "48–72 hours", daysPP: 3, bp: "",
    uterus: "Well contracted", lochia: "Normal", breast: "Normal", breastfeeding: "Exclusive",
    fpCounselled: false, notes: "",
  });
  const [danger, setDanger] = useState<string[]>([]);

  // PNC due: deliveries with a live/alive mother in the last 45 days, next contact not yet done
  const due = useMemo(() => {
    const recent = deliveries.filter((d) => d.motherStatus !== "Died" && differenceInCalendarDays(new Date(), new Date(d.date)) <= 45);
    return recent.map((d) => {
      const daysPP = differenceInCalendarDays(new Date(), new Date(d.date));
      const done = new Set(pncVisits.filter((v) => v.patientId === d.patientId).map((v) => v.contact ?? contactFor(v.daysPP)));
      const next = SCHEDULE.find((s) => !done.has(s.contact));
      if (!next) return null;
      const overdueDays = daysPP - next.day;
      return { d, daysPP, next, overdueDays, status: overdueDays > 3 ? "Overdue" : overdueDays >= -1 ? "Due" : "Upcoming" };
    }).filter(Boolean) as { d: (typeof deliveries)[number]; daysPP: number; next: (typeof SCHEDULE)[number]; overdueDays: number; status: string }[];
  }, [deliveries, pncVisits]);

  const overdue = due.filter((x) => x.status === "Overdue");

  const patientDeliveries = deliveries.filter((d) => d.patientId === f.patientId);
  const [tab, setTab] = useState("PNC Due");

  function startFrom(patientId: string, deliveryId: string) {
    const d = deliveries.find((x) => x.id === deliveryId);
    const daysPP = d ? differenceInCalendarDays(new Date(), new Date(d.date)) : 3;
    setF((s) => ({ ...s, patientId, deliveryId, daysPP, date: new Date().toISOString().slice(0, 10) }));
    setTab("Record Visit");
  }

  return (
    <div>
      <PageHeader title="Postnatal Care (PNC)" subtitle="WHO 4-contact schedule · mother & newborn assessment · danger-sign escalation" />

      <GuidelineBanner guidelineKey="pnc-2013" className="mb-5" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="PNC visits" value={pncVisits.length} tone="brand" icon={<HeartPulse size={18} />} />
        <StatCard label="Contacts due" value={due.length} tone={due.length ? "amber" : "brand"} delay={0.05} icon={<CalendarClock size={18} />} />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? "action" : "brand"} delay={0.1} />
        <StatCard label="Danger signs seen" value={pncVisits.filter((v) => v.dangerSigns.length).length} tone={pncVisits.some((v) => v.dangerSigns.length) ? "action" : "mist"} delay={0.15} icon={<TriangleAlert size={18} />} />
      </div>

      <Tabs tabs={["PNC Due", "Record Visit", "PNC Records"]} active={tab} onChange={setTab}>
        {(t) =>
          t === "PNC Due" ? (
            <Table columns={["Mother", "Delivered", "Days PP", "Next contact", "Status", ""]}>
              {due.sort((a, b) => b.overdueDays - a.overdueDays).map((x, i) => (
                <Row key={x.d.id} index={i} className={x.status === "Overdue" ? "bg-action-50/40" : undefined}>
                  <Cell><PatientLink patient={patientById(x.d.patientId)} /></Cell>
                  <Cell className="text-mist-400">{shortDate(x.d.date)}</Cell>
                  <Cell>{x.daysPP}</Cell>
                  <Cell className="font-medium">{x.next.label}</Cell>
                  <Cell><Badge tone={x.status === "Overdue" ? "action" : x.status === "Due" ? "amber" : "mist"}>{x.status}{x.overdueDays > 0 ? ` · ${x.overdueDays}d` : ""}</Badge></Cell>
                  <Cell>
                    <button onClick={() => startFrom(x.d.patientId, x.d.id)} className="btn-primary px-2.5 py-1 text-xs">Record contact</button>
                  </Cell>
                </Row>
              ))}
              {due.length === 0 && <Row><Cell className="text-mist-400">No PNC contacts due — all recent deliveries are up to date.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
            </Table>
          ) : t === "Record Visit" ? (
            <div className="card space-y-5">
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Mother & delivery link</p>
                <Grid cols={2}>
                  <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id, deliveryId: "" })} filter={(p) => p.sex === "F"} /></Field>
                  <Field label="Link to delivery">
                    <Select
                      value={f.deliveryId}
                      onChange={(e) => { const d = deliveries.find((x) => x.id === e.target.value); setF({ ...f, deliveryId: e.target.value, daysPP: d ? differenceInCalendarDays(new Date(), new Date(d.date)) : f.daysPP }); }}
                      options={[{ value: "", label: patientDeliveries.length ? "Select a delivery…" : "No facility delivery on record" }, ...patientDeliveries.map((d) => ({ value: d.id, label: `${shortDate(d.date)} · ${d.mode} · ${d.babyStatus}` }))]}
                    />
                  </Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Visit &amp; vitals</p>
                <Grid cols={3}>
                  <Field label="Visit date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
                  <Field label="Days postpartum"><Input type="number" value={f.daysPP} onChange={(e) => setF({ ...f, daysPP: +e.target.value })} /></Field>
                  <Field label="Contact"><Input value={SCHEDULE.find((s) => s.contact === contactFor(f.daysPP))?.label ?? "—"} readOnly className="bg-mist-50 text-mist-500" /></Field>
                  <Field label="BP"><Input value={f.bp} onChange={(e) => setF({ ...f, bp: e.target.value })} placeholder="120/80" /></Field>
                  <Field label="Uterus"><Select value={f.uterus} onChange={(e) => setF({ ...f, uterus: e.target.value })} options={["Well contracted", "Poorly contracted", "Tender"]} /></Field>
                  <Field label="Lochia"><Select value={f.lochia} onChange={(e) => setF({ ...f, lochia: e.target.value })} options={["Normal", "Excessive", "Offensive"]} /></Field>
                  <Field label="Breast"><Select value={f.breast} onChange={(e) => setF({ ...f, breast: e.target.value })} options={["Normal", "Engorged", "Cracked nipple", "Mastitis"]} /></Field>
                  <Field label="Breastfeeding"><Select value={f.breastfeeding} onChange={(e) => setF({ ...f, breastfeeding: e.target.value })} options={["Exclusive", "Mixed", "Not breastfeeding"]} /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-1.5 text-[11px] font-bold uppercase text-mist-400">Newborn danger signs</p>
                <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-4">
                  {DANGER.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm text-mist-600">
                      <input type="checkbox" className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600" checked={danger.includes(d)} onChange={(e) => setDanger((x) => (e.target.checked ? [...x, d] : x.filter((y) => y !== d)))} />
                      {d}
                    </label>
                  ))}
                </div>
                {danger.length > 0 && (
                  <p className="mt-2 rounded-xl bg-action-50 px-3 py-2 text-xs font-semibold text-action-700 ring-1 ring-action-200">
                    <TriangleAlert size={12} className="mr-1 inline" /> Saving with danger signs sends the mother to the Consultation queue as Urgent.
                  </p>
                )}
              </section>
              <label className="flex items-center gap-2 text-sm text-mist-600">
                <input type="checkbox" checked={f.fpCounselled} onChange={(e) => setF({ ...f, fpCounselled: e.target.checked })} className="h-4 w-4 rounded border-mist-300 text-brand-600" />
                Family planning counselled
              </label>
              <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Concerns, education provided, follow-up plan…" /></Field>
              <div className="flex justify-end">
                <Button
                  disabled={!f.patientId || !f.date}
                  onClick={() => {
                    addPncVisit({
                      patientId: f.patientId, deliveryId: f.deliveryId || undefined, contact: contactFor(f.daysPP),
                      date: new Date(f.date).toISOString(), timing: SCHEDULE.find((s) => s.contact === contactFor(f.daysPP))?.label ?? f.timing,
                      daysPP: f.daysPP, bp: f.bp || undefined, uterus: f.uterus, lochia: f.lochia, breast: f.breast,
                      breastfeeding: f.breastfeeding, dangerSigns: danger, fpCounselled: f.fpCounselled, notes: f.notes || undefined,
                    });
                    setF({ ...f, patientId: "", deliveryId: "", date: "", bp: "", notes: "" });
                    setDanger([]);
                    setTab("PNC Records");
                  }}
                >
                  Save visit
                </Button>
              </div>
            </div>
          ) : pncVisits.length === 0 ? (
            <EmptyState title="No PNC visits yet" hint='Switch to "Record Visit" to add one.' />
          ) : (
            <Table columns={["Mother", "Date", "Contact", "Days PP", "BP", "Danger", "Breastfeeding", "FP"]}>
              {pncVisits.map((v, i) => (
                <Row key={v.id} index={i} className={v.dangerSigns.length ? "bg-action-50/40" : undefined}>
                  <Cell><PatientLink patient={patientById(v.patientId)} /></Cell>
                  <Cell className="text-mist-400">{shortDate(v.date)}</Cell>
                  <Cell><Badge tone="mist">PNC {v.contact ?? contactFor(v.daysPP)}</Badge></Cell>
                  <Cell>{v.daysPP}</Cell>
                  <Cell>{v.bp || "—"}</Cell>
                  <Cell>{v.dangerSigns.length ? <Badge tone="action">{v.dangerSigns.length}</Badge> : "—"}</Cell>
                  <Cell><Badge tone={v.breastfeeding === "Exclusive" ? "brand" : "amber"}>{v.breastfeeding}</Badge></Cell>
                  <Cell>{v.fpCounselled ? <Badge tone="brand">Yes</Badge> : "—"}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>
    </div>
  );
}
