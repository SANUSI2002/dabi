import { useMemo, useState } from "react";
import { Pill, PackagePlus, Boxes, TriangleAlert, ShieldCheck } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, SectionNote } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Textarea } from "@/components/ui/form";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { useEmr } from "@/store/useEmr";
import { useCatalog } from "@/store/useCatalog";
import { useClinical, selectAllergiesFor } from "@/store/useClinical";
import { screenPrescription, type SafetyAlert } from "@/data/medicationSafety";
import { dateTime, shortDate } from "@/lib/format";
import type { Prescription } from "@/data/types";

export default function Pharmacy() {
  const emr = useEmr();
  const { encounters, patientById, dispensePrescription, outsourcePrescription, refusePrescription } = emr;
  const stock = useCatalog((state) => state.drugs);
  const receiveStock = useCatalog((state) => state.receiveStock);
  const allergyRecords = useClinical((state) => state.allergies);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ drug: "", quantity: 0, batchNumber: "", expiryDate: "", supplier: "" });
  const [active, setActive] = useState<{ encounterId: string; prescription: Prescription } | null>(null);
  const [dispenseQty, setDispenseQty] = useState(0);
  const [overrideReason, setOverrideReason] = useState("");
  const [refuseReason, setRefuseReason] = useState("");

  const allPrescriptions = useMemo(
    () =>
      encounters.flatMap((encounter) =>
        encounter.prescriptions.map((prescription) => ({ encounter, prescription })),
      ),
    [encounters],
  );
  const toDispense = allPrescriptions.filter(({ prescription }) => prescription.status === "Pending");
  const dispensedHistory = allPrescriptions.filter(({ prescription }) =>
    ["Dispensed", "Partially Dispensed", "Outsourced", "Refused"].includes(prescription.status),
  );
  const groupedToDispense = useMemo(() => {
    const byEncounter = new Map<string, { encounter: (typeof toDispense)[number]["encounter"]; items: Prescription[] }>();
    for (const { encounter, prescription } of toDispense) {
      const bucket = byEncounter.get(encounter.id) ?? { encounter, items: [] };
      bucket.items.push(prescription);
      byEncounter.set(encounter.id, bucket);
    }
    return [...byEncounter.values()];
  }, [toDispense]);

  const stockOut = stock.filter((drug) => drug.stock === 0).length;
  const lowStock = stock.filter((drug) => drug.stock > 0 && drug.stock <= drug.reorder).length;

  const activePatient = active ? patientById(active.encounterId ? encounters.find((encounter) => encounter.id === active.encounterId)?.patientId ?? "" : "") : null;
  const activeAllergies = activePatient ? selectAllergiesFor(allergyRecords, activePatient) : [];
  const activePatientPrescriptions = activePatient
    ? allPrescriptions.filter(({ encounter }) => encounter.patientId === activePatient.id).map(({ prescription }) => prescription)
    : [];
  const stockRow = active ? stock.find((drug) => active.prescription.drug.toLowerCase().includes(drug.name.toLowerCase())) : undefined;
  const alerts: SafetyAlert[] = active
    ? screenPrescription({
        drugName: active.prescription.drug,
        allergies: activeAllergies,
        activePrescriptions: activePatientPrescriptions.map((prescription) => ({ drug: prescription.drug, status: prescription.status })),
        stockOnHand: stockRow?.stock,
      })
    : [];
  const highAlert = alerts.some((alert) => alert.severity === "high");

  function openDispense(encounterId: string, prescription: Prescription) {
    setActive({ encounterId, prescription });
    setDispenseQty(prescription.qty || 1);
    setOverrideReason("");
    setRefuseReason("");
  }

  function confirmDispense() {
    if (!active) return;
    dispensePrescription(active.encounterId, active.prescription.id, {
      quantity: dispenseQty,
      overrideReason: alerts.length ? overrideReason || undefined : undefined,
    });
    setActive(null);
  }

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        subtitle={`${toDispense.length} prescriptions to dispense`}
        actions={<Button onClick={() => { setReceiveForm({ drug: "", quantity: 0, batchNumber: "", expiryDate: "", supplier: "" }); setReceiveOpen(true); }}><PackagePlus size={15} /> Receive stock</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="To dispense" value={toDispense.length} tone={toDispense.length ? "amber" : "mist"} icon={<Pill size={18} />} />
        <StatCard label="Dispensed / actioned" value={dispensedHistory.length} tone="brand" delay={0.05} />
        <StatCard label="Catalogue items" value={stock.length} tone="mist" delay={0.1} icon={<Boxes size={18} />} />
        <StatCard label="Out of stock" value={stockOut} tone={stockOut ? "action" : "mist"} delay={0.15} hint={lowStock ? `${lowStock} low` : undefined} />
      </div>

      <Tabs tabs={[`To dispense (${toDispense.length})`, `Medication catalogue (${stock.length})`, "Dispense history", "Reconciliation"]} label="Pharmacy work">
        {(tab) =>
          tab.startsWith("To dispense") ? (
            <div className="space-y-3">
              {groupedToDispense.length === 0 && <div className="card py-12 text-center text-mist-400">No prescriptions are waiting to be dispensed.</div>}
              {groupedToDispense.map(({ encounter, items }) => {
                const patient = patientById(encounter.patientId);
                const patientAllergies = patient ? selectAllergiesFor(allergyRecords, patient) : [];
                return (
                  <div key={encounter.id} className="card">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-mist-900">{patient ? `${patient.firstName} ${patient.lastName}` : "—"}</p>
                        <p className="text-[11px] text-mist-400">{patient?.mrn} · prescribed {dateTime(encounter.date)} · {encounter.provider}</p>
                      </div>
                      {patientAllergies.some((allergy) => allergy.clinicalStatus === "active") && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-action-50 px-2 py-0.5 text-[11px] font-bold text-action-700 ring-1 ring-action-200">
                          <TriangleAlert size={12} aria-hidden /> Allergy: {patientAllergies.filter((allergy) => allergy.clinicalStatus === "active").map((allergy) => allergy.substance.display).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-mist-100">
                      {items.map((prescription) => (
                        <div key={prescription.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div className="text-sm">
                            <span className="font-medium text-mist-800">{prescription.drug}</span>
                            <span className="text-mist-400"> · {prescription.dose} · {prescription.frequency} · {prescription.duration} · Qty {prescription.qty}</span>
                            {prescription.indication && <span className="block text-[11px] text-mist-400">for {prescription.indication}</span>}
                          </div>
                          <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => openDispense(encounter.id, prescription)}>Review &amp; dispense</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tab.startsWith("Medication catalogue") ? (
            <Table columns={["Medication", "Form", "Strength", "Class", "Formulary", "On hand", "Status"]} caption="Medication catalogue and stock">
              {stock.map((drug, index) => (
                <Row key={drug.id} index={index}>
                  <Cell className="font-semibold">{drug.name}</Cell>
                  <Cell>{drug.form}</Cell>
                  <Cell className="text-mist-500">{drug.strength}</Cell>
                  <Cell className="text-mist-500">{drug.klass}</Cell>
                  <Cell>{drug.active === false ? <Badge tone="mist">Non-formulary</Badge> : <Badge tone="brand">Formulary</Badge>}</Cell>
                  <Cell className="font-semibold">{drug.stock}<span className="text-[11px] font-normal text-mist-400"> / reorder {drug.reorder}</span></Cell>
                  <Cell>
                    <Badge tone={drug.stock === 0 ? "action" : drug.stock <= drug.reorder ? "amber" : "brand"}>
                      {drug.stock === 0 ? "Out of stock" : drug.stock <= drug.reorder ? "Low — reorder" : "In stock"}
                    </Badge>
                  </Cell>
                </Row>
              ))}
            </Table>
          ) : tab === "Dispense history" ? (
            <Table columns={["Patient", "Medication", "Ordered", "Dispensed", "Status", "By", "When"]} caption="Dispensing history">
              {dispensedHistory.length === 0 && <EmptyRow colSpan={7}>Nothing has been dispensed yet.</EmptyRow>}
              {dispensedHistory
                .sort((left, right) => +new Date(right.encounter.date) - +new Date(left.encounter.date))
                .map(({ encounter, prescription }, index) => {
                  const patient = patientById(encounter.patientId);
                  return (
                    <Row key={`${encounter.id}-${prescription.id}`} index={index}>
                      <Cell className="font-semibold">{patient ? `${patient.firstName} ${patient.lastName}` : "—"}</Cell>
                      <Cell>{prescription.drug}</Cell>
                      <Cell>{prescription.qty}</Cell>
                      <Cell>{prescription.dispensedQty ?? (prescription.status === "Dispensed" ? prescription.qty : "—")}</Cell>
                      <Cell>
                        <ClinicalStatusBadge kind="dispense" status={prescription.status} />
                        {prescription.refusalReason && <p className="text-[11px] text-mist-400">{prescription.refusalReason}</p>}
                        {prescription.overrideReason && <p className="text-[11px] text-amber-600">Override: {prescription.overrideReason}</p>}
                      </Cell>
                      <Cell className="text-mist-500">{prescription.dispensedBy ?? "—"}</Cell>
                      <Cell className="text-mist-400">{prescription.dispensedAt ? shortDate(prescription.dispensedAt) : shortDate(encounter.date)}</Cell>
                    </Row>
                  );
                })}
            </Table>
          ) : (
            <div className="space-y-4">
              <SectionNote tone="unavailable">
                Home / pre-admission medication is captured as free text in the consultation note. A structured
                medication-reconciliation source is not integrated in this build, so “home medications” cannot be
                listed here automatically.
              </SectionNote>
              {(() => {
                const byPatient = new Map<string, Prescription[]>();
                for (const { encounter, prescription } of allPrescriptions) {
                  byPatient.set(encounter.patientId, [...(byPatient.get(encounter.patientId) ?? []), prescription]);
                }
                const rows = [...byPatient.entries()];
                if (rows.length === 0) return <div className="card py-10 text-center text-sm text-mist-400">No prescriptions on record.</div>;
                return rows.map(([patientId, prescriptions]) => {
                  const patient = patientById(patientId);
                  const buckets = {
                    "Newly prescribed": prescriptions.filter((prescription) => prescription.status === "Pending"),
                    "Current (dispensed)": prescriptions.filter((prescription) => prescription.status === "Dispensed" || prescription.status === "Partially Dispensed"),
                    "Stopped / not given": prescriptions.filter((prescription) => prescription.status === "Refused" || prescription.status === "Cancelled" || prescription.status === "Outsourced"),
                  };
                  return (
                    <div key={patientId} className="card">
                      <p className="mb-3 font-semibold text-mist-900">{patient ? `${patient.firstName} ${patient.lastName}` : patientId}</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {Object.entries(buckets).map(([label, list]) => (
                          <div key={label}>
                            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-mist-400">{label} ({list.length})</p>
                            {list.length === 0 ? (
                              <p className="text-xs text-mist-300">None</p>
                            ) : (
                              <ul className="space-y-1 text-sm text-mist-600">
                                {list.map((prescription) => (
                                  <li key={prescription.id}>{prescription.drug} <span className="text-[11px] text-mist-400">{prescription.dose} {prescription.frequency}</span></li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )
        }
      </Tabs>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={`Dispense — ${active?.prescription.drug ?? ""}`}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setActive(null)}>Cancel</Button>
            {active && (
              <>
                <Button variant="ghost" onClick={() => { outsourcePrescription(active.encounterId, active.prescription.id); setActive(null); }}>Outsource</Button>
                <Button
                  variant="action"
                  disabled={!refuseReason.trim()}
                  onClick={() => { refusePrescription(active.encounterId, active.prescription.id, refuseReason.trim()); setActive(null); }}
                >
                  Not dispensed
                </Button>
                <Button
                  disabled={dispenseQty <= 0 || (alerts.length > 0 && highAlert && !overrideReason.trim())}
                  onClick={confirmDispense}
                >
                  {dispenseQty >= (active.prescription.qty || 1) ? "Dispense in full" : `Dispense ${dispenseQty} of ${active.prescription.qty}`}
                </Button>
              </>
            )}
          </>
        }
      >
        {active && (
          <div className="space-y-4">
            <div className="rounded-xl bg-mist-50 p-3 text-sm">
              <p className="font-semibold text-mist-800">{active.prescription.drug}</p>
              <p className="text-mist-500">
                {active.prescription.dose} · {active.prescription.frequency} · for {active.prescription.duration} · ordered quantity {active.prescription.qty}
                {active.prescription.route ? ` · ${active.prescription.route}` : ""}
              </p>
              {activePatient && <p className="mt-1 text-[11px] text-mist-400">For {activePatient.firstName} {activePatient.lastName} · {activePatient.mrn}</p>}
            </div>

            {alerts.length === 0 ? (
              <p className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
                <ShieldCheck size={15} aria-hidden /> No safety alerts from the name-based screen. This is not a clinical validation.
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <p
                    key={index}
                    role={alert.severity === "high" ? "alert" : undefined}
                    className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-sm ring-1 ${
                      alert.severity === "high" ? "bg-action-50 text-action-800 ring-action-200" : alert.severity === "moderate" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-mist-100 text-mist-600 ring-mist-200"
                    }`}
                  >
                    <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span><b className="uppercase">{alert.kind}</b> — {alert.message}</span>
                  </p>
                ))}
                <p className="text-[11px] text-mist-400">
                  Warnings do not block dispensing. {highAlert ? "A high-severity alert requires an override reason." : "Record why you are proceeding if appropriate."}
                </p>
              </div>
            )}

            <Grid cols={2}>
              <Field label="Quantity to dispense" hint={dispenseQty < (active.prescription.qty || 1) ? "Recorded as a partial dispense" : undefined}>
                <Input type="number" min={1} max={active.prescription.qty || undefined} value={dispenseQty || ""} onChange={(event) => setDispenseQty(Number(event.target.value))} />
              </Field>
              {alerts.length > 0 && (
                <Field label={`Override / proceed reason${highAlert ? " *" : ""}`}>
                  <Input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="e.g. Allergy is to a different class, confirmed with prescriber" />
                </Field>
              )}
            </Grid>

            <Field label="If not dispensing — reason" hint="Fill this to record a refusal instead of dispensing.">
              <Textarea value={refuseReason} onChange={(event) => setRefuseReason(event.target.value)} className="min-h-[60px]" placeholder="e.g. Out of stock, patient declined, prescriber to review dose" />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Receive drug stock"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button
              disabled={!receiveForm.drug || receiveForm.quantity <= 0}
              onClick={() => {
                receiveStock(receiveForm.drug, receiveForm.quantity, {
                  batchNumber: receiveForm.batchNumber || undefined,
                  expiryDate: receiveForm.expiryDate || undefined,
                  supplier: receiveForm.supplier || undefined,
                });
                setReceiveOpen(false);
              }}
            >
              Receive {receiveForm.quantity > 0 ? `+${receiveForm.quantity}` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Medication">
            <Select
              value={receiveForm.drug}
              onChange={(event) => setReceiveForm({ ...receiveForm, drug: event.target.value })}
              options={[{ value: "", label: "Select a medication…" }, ...stock.map((drug) => ({ value: drug.name, label: `${drug.name} (${drug.stock} on hand)` }))]}
            />
          </Field>
          <Grid cols={2}>
            <Field label="Batch number"><Input value={receiveForm.batchNumber} onChange={(event) => setReceiveForm({ ...receiveForm, batchNumber: event.target.value })} placeholder="e.g. AB123" /></Field>
            <Field label="Expiry date"><Input type="date" value={receiveForm.expiryDate} onChange={(event) => setReceiveForm({ ...receiveForm, expiryDate: event.target.value })} /></Field>
            <Field label="Quantity received"><Input type="number" min={1} value={receiveForm.quantity || ""} onChange={(event) => setReceiveForm({ ...receiveForm, quantity: Number(event.target.value) })} /></Field>
            <Field label="Supplier"><Input value={receiveForm.supplier} onChange={(event) => setReceiveForm({ ...receiveForm, supplier: event.target.value })} placeholder="Optional" /></Field>
          </Grid>
          <p className="text-[11px] text-mist-400">Batch and expiry are recorded on the stock-movement audit entry. Per-batch stock ledgers are not modelled in this build.</p>
        </div>
      </Modal>
    </div>
  );
}
