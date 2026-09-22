import { useMemo, useState } from "react";
import { Pill, PackagePlus, Boxes, TriangleAlert, ShieldCheck, ClipboardCheck, ShieldAlert, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, SectionNote } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Textarea, Checkbox } from "@/components/ui/form";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { useCatalog } from "@/store/useCatalog";
import { useClinical, selectAllergiesFor } from "@/store/useClinical";
import { useAP } from "@/store/accounting/useAP";
import { usePharmacy } from "@/store/usePharmacy";
import type { SafetyAlert } from "@/data/medicationSafety";
import { DRUG_CATEGORIES, PHARMACY_LOCATIONS, REJECTION_REASONS, type PharmacyLocation, type ExpiryBucket, type DrugMasterStatus, type DrugBatch } from "@/data/pharmacyOps";
import { dateTime, shortDate } from "@/lib/format";
import type { Prescription } from "@/data/types";

const RX_QUEUE_TABS = ["Under Review", "Approved", "Rejected", "All"] as const;
const RX_STATUS_TONE: Record<string, "brand" | "action" | "mist" | "amber"> = {
  "Under Review": "amber", Approved: "brand", Preparing: "amber", Ready: "brand", Rejected: "action",
};
const EXPIRY_BUCKET_LABELS: Record<Exclude<ExpiryBucket, "later">, string> = {
  expired: "Expired", "30": "Expiring in 30 days", "60": "Expiring in 60 days", "90": "Expiring in 90 days", "180": "Expiring in 180 days",
};
const DRUG_STATUSES: DrugMasterStatus[] = ["Draft", "Active", "Inactive", "Discontinued"];
const DRUG_STATUS_TONE: Record<DrugMasterStatus, "brand" | "action" | "mist" | "amber"> = { Active: "brand", Draft: "amber", Inactive: "mist", Discontinued: "action" };

function defaultExpiryInput() {
  const d = new Date();
  d.setMonth(d.getMonth() + 18);
  return d.toISOString().slice(0, 10);
}

type EncounterRx = { encounterId: string; patientId: string; encounterDate: string; provider: string; prescription: Prescription };

export default function Pharmacy() {
  const emr = useEmr();
  const { encounters, patientById, outsourcePrescription, refusePrescription } = emr;
  const stock = useCatalog((state) => state.drugs);
  const allergyRecords = useClinical((state) => state.allergies);
  const pharmacy = usePharmacy();
  const vendors = useAP((state) => state.vendors).filter((v) => v.category === "Pharmaceuticals" && v.active);

  const allRx: EncounterRx[] = useMemo(
    () =>
      encounters.flatMap((encounter) =>
        encounter.prescriptions.map((prescription) => ({
          encounterId: encounter.id, patientId: encounter.patientId, encounterDate: encounter.date, provider: encounter.provider, prescription,
        })),
      ),
    [encounters],
  );

  const toDispense = allRx.filter(({ prescription }) => ["Approved", "Preparing", "Ready"].includes(prescription.status));
  const dispensedHistory = allRx.filter(({ prescription }) =>
    ["Dispensed", "Partially Dispensed", "Outsourced", "Refused"].includes(prescription.status),
  );
  const groupedToDispense = useMemo(() => {
    const byEncounter = new Map<string, { encounterId: string; patientId: string; encounterDate: string; provider: string; items: Prescription[] }>();
    for (const row of toDispense) {
      const bucket = byEncounter.get(row.encounterId) ?? { encounterId: row.encounterId, patientId: row.patientId, encounterDate: row.encounterDate, provider: row.provider, items: [] };
      bucket.items.push(row.prescription);
      byEncounter.set(row.encounterId, bucket);
    }
    return [...byEncounter.values()];
  }, [toDispense]);

  const stockOut = stock.filter((drug) => drug.stock === 0).length;
  const lowStock = stock.filter((drug) => drug.stock > 0 && drug.stock <= drug.reorder).length;
  const underReviewCount = allRx.filter(({ prescription }) => prescription.status === "Under Review").length;

  // ---- Prescription Queue ----
  const [queueTab, setQueueTab] = useState<(typeof RX_QUEUE_TABS)[number]>("Under Review");
  const [reviewing, setReviewing] = useState<EncounterRx | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0]);
  const [rejectNote, setRejectNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const queueRows = (queueTab === "All" ? allRx : allRx.filter(({ prescription }) => prescription.status === queueTab))
    .sort((a, b) => +new Date(b.encounterDate) - +new Date(a.encounterDate));

  const reviewAlerts: SafetyAlert[] = reviewing ? pharmacy.safetyAlertsFor(reviewing.encounterId, reviewing.prescription.id) : [];
  const reviewHighAlert = reviewAlerts.some((a) => a.severity === "high");

  function openReview(row: EncounterRx) {
    setReviewing(row);
    setRejecting(false);
    setOverrideReason("");
    setRejectReason(REJECTION_REASONS[0]);
    setRejectNote("");
  }

  function submitApproval() {
    if (!reviewing) return;
    pharmacy.approvePrescription(reviewing.encounterId, reviewing.prescription.id, { overrideReason: reviewAlerts.length ? overrideReason || undefined : undefined });
    setReviewing(null);
  }

  function submitRejection() {
    if (!reviewing || !rejectNote.trim()) return;
    pharmacy.rejectPrescription(reviewing.encounterId, reviewing.prescription.id, { reason: rejectReason, note: rejectNote.trim() });
    setReviewing(null);
  }

  // ---- Dispensary ----
  const [active, setActive] = useState<{ encounterId: string; prescription: Prescription } | null>(null);
  const [dispenseQty, setDispenseQty] = useState(0);
  const [dispenseOverride, setDispenseOverride] = useState("");
  const [witnessBy, setWitnessBy] = useState("");
  const [refuseReason, setRefuseReason] = useState("");
  const [dispenseError, setDispenseError] = useState("");

  const activePatient = active ? patientById(encounters.find((e) => e.id === active.encounterId)?.patientId ?? "") : undefined;
  const activeDrug = active ? stock.find((d) => active.prescription.drug.toLowerCase().includes(d.name.toLowerCase())) : undefined;
  const activeMaster = activeDrug ? pharmacy.drugMasterFor(activeDrug.id) : undefined;
  const dispenseAlerts: SafetyAlert[] = active ? pharmacy.safetyAlertsFor(active.encounterId, active.prescription.id) : [];
  const dispenseHighAlert = dispenseAlerts.some((a) => a.severity === "high");

  function openDispense(encounterId: string, prescription: Prescription) {
    setActive({ encounterId, prescription });
    setDispenseQty(prescription.qty || 1);
    setDispenseOverride("");
    setWitnessBy("");
    setRefuseReason("");
    setDispenseError("");
  }

  function confirmDispense() {
    if (!active) return;
    setDispenseError("");
    const result = pharmacy.dispense(active.encounterId, active.prescription.id, {
      quantity: dispenseQty,
      overrideReason: dispenseAlerts.length ? dispenseOverride || undefined : undefined,
      witnessBy: activeMaster?.controlledSubstance ? witnessBy : undefined,
    });
    if (!result.ok) { setDispenseError(result.error); return; }
    setActive(null);
  }

  // ---- Batch & Expiry ----
  const prescribableCatalog = pharmacy.drugCatalog().filter((d) => d.master?.status !== "Draft" && d.master?.status !== "Discontinued");
  const [showReceive, setShowReceive] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    drugId: prescribableCatalog[0]?.id ?? "", batchNumber: "", quantity: "", expiryDate: defaultExpiryInput(), manufactureDate: "",
    unitCost: "", supplierId: vendors[0]?.id ?? "", location: PHARMACY_LOCATIONS[0] as PharmacyLocation,
  });
  const [batchLocationFilter, setBatchLocationFilter] = useState<"All" | PharmacyLocation>("All");
  const [resolving, setResolving] = useState<DrugBatch | null>(null);
  const [resolveDecision, setResolveDecision] = useState<"Release" | "WriteOff">("Release");
  const [resolveNote, setResolveNote] = useState("");
  const [resolveError, setResolveError] = useState("");

  const allBatches = stock.flatMap((drug) => pharmacy.batchesForDrug(drug.id));
  const expiryBuckets = (["expired", "30", "60", "90", "180"] as const).map((key) => ({
    key, label: EXPIRY_BUCKET_LABELS[key],
    rows: allBatches.filter((b) => b.status === "Active" && b.quantity > 0 && pharmacy.expiryBucket(b.expiryDate) === key),
  }));
  const visibleBatches = (batchLocationFilter === "All" ? allBatches : allBatches.filter((b) => b.location === batchLocationFilter))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  function openResolve(batch: DrugBatch) {
    setResolving(batch);
    setResolveDecision("Release");
    setResolveNote("");
    setResolveError("");
  }

  function submitResolve() {
    if (!resolving) return;
    const result = pharmacy.resolveQuarantine(resolving.id, resolveDecision, resolveNote);
    if (!result.ok) { setResolveError(result.error); return; }
    setResolving(null);
  }

  function submitReceiveBatch() {
    if (!receiveForm.drugId || !receiveForm.quantity) return;
    pharmacy.receiveBatch({
      drugId: receiveForm.drugId, batchNumber: receiveForm.batchNumber || undefined, quantity: Number(receiveForm.quantity),
      expiryDate: receiveForm.expiryDate, manufactureDate: receiveForm.manufactureDate || undefined,
      costPerUnit: receiveForm.unitCost ? Number(receiveForm.unitCost) : undefined, supplierId: receiveForm.supplierId || undefined, location: receiveForm.location,
    });
    setShowReceive(false);
    setReceiveForm((f) => ({ ...f, batchNumber: "", quantity: "", unitCost: "" }));
  }

  // ---- Drug Catalogue ----
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [addDrugForm, setAddDrugForm] = useState({
    name: "", genericName: "", brandName: "", strength: "", dosageForm: "Tablet", category: DRUG_CATEGORIES[0], unitOfMeasure: "Tablet",
    prescriptionRequired: true, controlledSubstance: false,
  });
  const [addDrugError, setAddDrugError] = useState("");

  const catalogRows = pharmacy.drugCatalog().filter((d) => categoryFilter === "All" || d.master?.category === categoryFilter);

  function openEditDrug(drugId: string) {
    const master = pharmacy.drugMasterFor(drugId);
    // a drug already usable in the formulary (no master record yet — created
    // before this workflow existed) should default to Active, not Draft; Draft
    // is only ever the default for a brand-new drug via "Add new drug".
    setEditForm(master ? { ...master } : { status: "Active" });
    setEditingDrugId(drugId);
  }

  function submitEditDrug() {
    if (!editingDrugId) return;
    pharmacy.updateDrugMaster(editingDrugId, editForm);
    setEditingDrugId(null);
  }

  function submitAddDrug() {
    setAddDrugError("");
    try {
      pharmacy.createDrug(addDrugForm);
      setShowAddDrug(false);
      setAddDrugForm({ name: "", genericName: "", brandName: "", strength: "", dosageForm: "Tablet", category: DRUG_CATEGORIES[0], unitOfMeasure: "Tablet", prescriptionRequired: true, controlledSubstance: false });
    } catch (err) {
      setAddDrugError(err instanceof Error ? err.message : "Could not create this drug.");
    }
  }

  // ---- Controlled Medicines ----
  const controlledDrugs = pharmacy.drugCatalog().filter((d) => d.master?.controlledSubstance);
  const [selectedControlled, setSelectedControlled] = useState<string>(controlledDrugs[0]?.id ?? "");
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState<{ direction: "Increase" | "Decrease"; quantity: string; reason: string }>({ direction: "Decrease", quantity: "", reason: "" });
  const [adjustError, setAdjustError] = useState("");

  const controlledLog = selectedControlled ? pharmacy.logForDrug(selectedControlled) : [];

  function submitAdjustment() {
    setAdjustError("");
    try {
      pharmacy.adjustControlledBalance(selectedControlled, { quantity: Number(adjustForm.quantity), direction: adjustForm.direction, reason: adjustForm.reason });
      setShowAdjust(false);
      setAdjustForm({ direction: "Decrease", quantity: "", reason: "" });
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Could not record this adjustment.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        subtitle={`${underReviewCount} awaiting review · ${toDispense.length} in the dispensary pipeline`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Awaiting review" value={underReviewCount} tone={underReviewCount ? "amber" : "mist"} icon={<ClipboardCheck size={18} />} />
        <StatCard label="To dispense" value={toDispense.length} tone={toDispense.length ? "amber" : "mist"} icon={<Pill size={18} />} delay={0.05} />
        <StatCard label="Catalogue items" value={stock.length} tone="mist" delay={0.1} icon={<Boxes size={18} />} />
        <StatCard label="Out of stock" value={stockOut} tone={stockOut ? "action" : "mist"} delay={0.15} hint={lowStock ? `${lowStock} low` : undefined} />
      </div>

      <Tabs
        tabs={["Prescription Queue", "Dispensary", "Batch & Expiry", "Drug Catalogue", "Controlled Medicines", "Dispense history", "Reconciliation"]}
        label="Pharmacy work"
      >
        {(tab) =>
          tab === "Prescription Queue" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {RX_QUEUE_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQueueTab(t)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                      queueTab === t ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-mist-600 ring-mist-200 hover:bg-mist-50"
                    }`}
                  >
                    {t} ({t === "All" ? allRx.length : allRx.filter((r) => r.prescription.status === t).length})
                  </button>
                ))}
              </div>
              <Table columns={["Medication", "Patient", "Source", "Priority", "Status", "Submitted", ""]} caption="Prescription review queue">
                {queueRows.length === 0 && <EmptyRow colSpan={7}>Nothing here.</EmptyRow>}
                {queueRows.map(({ encounterId, patientId, encounterDate, prescription }, index) => (
                  <Row key={prescription.id} index={index}>
                    <Cell className="font-semibold">{prescription.drug}<span className="block text-[11px] font-normal text-mist-400">{prescription.dose} · {prescription.frequency}</span></Cell>
                    <Cell><PatientLink patient={patientById(patientId)} /></Cell>
                    <Cell className="text-mist-500">{prescription.source ?? "Doctor Prescription"}</Cell>
                    <Cell><Badge tone={prescription.priority === "STAT" ? "action" : prescription.priority === "Urgent" ? "amber" : "mist"}>{prescription.priority ?? "Routine"}</Badge></Cell>
                    <Cell><Badge tone={RX_STATUS_TONE[prescription.status] ?? "mist"}>{prescription.status}</Badge></Cell>
                    <Cell className="text-mist-400">{dateTime(encounterDate)}</Cell>
                    <Cell>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openReview({ encounterId, patientId, encounterDate, provider: "", prescription })}>
                        {prescription.status === "Under Review" ? "Review" : "View"}
                      </button>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </div>
          ) : tab === "Dispensary" ? (
            <div className="space-y-4">
              {groupedToDispense.length === 0 && <div className="card py-12 text-center text-mist-400">No approved prescriptions are waiting on Dispensary.</div>}
              {groupedToDispense.map(({ encounterId, patientId, encounterDate, provider, items }) => {
                const patient = patientById(patientId);
                const patientAllergies = patient ? selectAllergiesFor(allergyRecords, patient) : [];
                return (
                  <div key={encounterId} className="card">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-mist-900"><PatientLink patient={patient} /></p>
                        <p className="text-[11px] text-mist-400">{patient?.mrn} · approved from encounter {dateTime(encounterDate)} · {provider}</p>
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
                          <div className="flex items-center gap-2">
                            <Badge tone={prescription.status === "Ready" ? "brand" : "amber"}>{prescription.status === "Approved" ? "Awaiting prep" : prescription.status === "Preparing" ? "Preparing" : "Ready for pickup"}</Badge>
                            {prescription.status === "Approved" && (
                              <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => pharmacy.startPreparing(encounterId, prescription.id)}>Start preparing</Button>
                            )}
                            {prescription.status === "Preparing" && (
                              <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => pharmacy.markReady(encounterId, prescription.id)}>Mark ready</Button>
                            )}
                            {prescription.status === "Ready" && (
                              <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => openDispense(encounterId, prescription)}>Review &amp; dispense</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tab === "Batch & Expiry" ? (
            <div className="space-y-4">
              <p className="flex items-center gap-1.5 text-xs text-mist-400"><PackagePlus size={13} /> Every unit of stock belongs to a batch — dispensing always draws the earliest-expiring batch first (FEFO).</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {expiryBuckets.map((b) => (
                  <StatCard key={b.key} label={b.label} value={b.rows.length} tone={b.key === "expired" || b.key === "30" ? "action" : "amber"} />
                ))}
              </div>
              <div className="card p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-100 px-4 py-3">
                  <Select value={batchLocationFilter} onChange={(e) => setBatchLocationFilter(e.target.value as never)} options={["All", ...PHARMACY_LOCATIONS]} className="h-9 w-auto py-0 text-sm" />
                  <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => setShowReceive(true)}><Plus size={13} /> Receive batch</Button>
                </div>
                <Table columns={["Drug", "Batch #", "Location", "Quantity", "Expiry", "Unit Cost", "Status", ""]}>
                  {visibleBatches.length === 0 && <EmptyRow colSpan={8}>No batches recorded yet.</EmptyRow>}
                  {visibleBatches.map((b) => {
                    const drug = stock.find((d) => d.id === b.drugId);
                    return (
                      <Row key={b.id}>
                        <Cell className="font-medium">{drug?.name ?? b.drugId}</Cell>
                        <Cell className="font-mono text-xs">{b.batchNumber}</Cell>
                        <Cell>{b.location}</Cell>
                        <Cell>{b.quantity}</Cell>
                        <Cell>{shortDate(b.expiryDate)}</Cell>
                        <Cell>₦{b.costPerUnit.toLocaleString()}</Cell>
                        <Cell>
                          <Badge tone={b.status === "Active" ? "brand" : b.status === "Expired" || b.status === "Written Off" ? "action" : b.status === "Quarantined" ? "amber" : "mist"}>{b.status}</Badge>
                          {b.status === "Quarantined" && b.quarantineReason && <span className="block text-[11px] text-mist-500">{b.quarantineReason}</span>}
                          {b.status === "Written Off" && b.resolutionNote && <span className="block text-[11px] text-mist-500">{b.resolutionNote}</span>}
                        </Cell>
                        <Cell>
                          {b.status === "Active" && (
                            <button className="btn-ghost px-2 py-1 text-xs text-action-600" onClick={() => pharmacy.quarantineBatch(b.id, "Manual quarantine")}>Quarantine</button>
                          )}
                          {b.status === "Quarantined" && (
                            <button className="btn-soft px-2 py-1 text-xs" onClick={() => openResolve(b)}>Resolve</button>
                          )}
                        </Cell>
                      </Row>
                    );
                  })}
                </Table>
              </div>
            </div>
          ) : tab === "Drug Catalogue" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={["All", ...DRUG_CATEGORIES]} className="h-9 w-auto py-0 text-sm" />
                <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => setShowAddDrug(true)}><Plus size={13} /> Add new drug</Button>
              </div>
              <Table columns={["Medication", "Generic", "Strength / Form", "Category", "Rx required", "Controlled", "Status", "On hand", ""]} caption="Medication catalogue and stock">
                {catalogRows.map((drug, index) => (
                  <Row key={drug.id} index={index}>
                    <Cell className="font-semibold">{drug.name}</Cell>
                    <Cell className="text-mist-500">{drug.master?.genericName || "—"}</Cell>
                    <Cell className="text-mist-500">{drug.master?.strength || drug.strength} {drug.master?.dosageForm || drug.form}</Cell>
                    <Cell>{drug.master?.category || drug.klass}</Cell>
                    <Cell>{drug.master?.prescriptionRequired ? <Badge tone="amber">Yes</Badge> : <Badge tone="brand">No</Badge>}</Cell>
                    <Cell>{drug.master?.controlledSubstance ? <Badge tone="action">Controlled</Badge> : "—"}</Cell>
                    <Cell><Badge tone={DRUG_STATUS_TONE[drug.master?.status ?? "Active"]}>{drug.master?.status ?? "Active"}</Badge></Cell>
                    <Cell className="font-semibold">{pharmacy.batchesForDrug(drug.id).length ? pharmacy.totalStock(drug.id) : drug.stock}<span className="text-[11px] font-normal text-mist-400"> / reorder {drug.master?.reorderLevel ?? drug.reorder}</span></Cell>
                    <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={() => openEditDrug(drug.id)}>Edit</button></Cell>
                  </Row>
                ))}
              </Table>
            </div>
          ) : tab === "Controlled Medicines" ? (
            <div className="space-y-4">
              {controlledDrugs.length === 0 ? (
                <SectionNote>No drugs are flagged as controlled substances in the Drug Catalogue.</SectionNote>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {controlledDrugs.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedControlled(d.id)}
                        className={`rounded-2xl px-3 py-2 text-left ring-1 transition ${d.id === selectedControlled ? "bg-action-50 ring-action-300" : "bg-white ring-mist-200 hover:bg-mist-50"}`}
                      >
                        <p className="font-display text-lg font-bold text-mist-900">{pharmacy.runningBalance(d.id)}</p>
                        <p className="text-[11px] text-mist-500">{d.name}</p>
                      </button>
                    ))}
                  </div>
                  <div className="card p-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-100 px-4 py-3">
                      <p className="flex items-center gap-1.5 font-semibold text-mist-800">
                        <ShieldAlert size={15} /> {controlledDrugs.find((d) => d.id === selectedControlled)?.name} — running balance: {pharmacy.runningBalance(selectedControlled)}
                      </p>
                      <Button variant="action" className="px-2.5 py-1 text-xs" onClick={() => setShowAdjust(true)}><Plus size={13} /> Record adjustment</Button>
                    </div>
                    <Table columns={["Type", "Quantity", "Patient", "Pharmacist", "Witness", "Balance after", "Date"]}>
                      {controlledLog.length === 0 && <EmptyRow colSpan={7}>No activity recorded for this medicine yet.</EmptyRow>}
                      {controlledLog.map((entry) => (
                        <Row key={entry.id}>
                          <Cell><Badge tone={entry.type === "Received" ? "brand" : "action"}>{entry.adjustment ? `${entry.type} (Adj.)` : entry.type}</Badge></Cell>
                          <Cell>{entry.quantity}</Cell>
                          <Cell><PatientLink patient={entry.patientId ? patientById(entry.patientId) : undefined} /></Cell>
                          <Cell className="text-mist-500">{entry.pharmacistName}</Cell>
                          <Cell className="text-mist-500">{entry.witnessBy ?? "—"}</Cell>
                          <Cell className="font-semibold">{entry.balanceAfter}</Cell>
                          <Cell className="text-mist-400">{dateTime(entry.at)}{entry.reason && <span className="block text-[11px]">{entry.reason}</span>}</Cell>
                        </Row>
                      ))}
                    </Table>
                  </div>
                </>
              )}
            </div>
          ) : tab === "Dispense history" ? (
            <Table columns={["Patient", "Medication", "Ordered", "Dispensed", "Status", "By", "When"]} caption="Dispensing history">
              {dispensedHistory.length === 0 && <EmptyRow colSpan={7}>Nothing has been dispensed yet.</EmptyRow>}
              {dispensedHistory
                .sort((left, right) => +new Date(right.encounterDate) - +new Date(left.encounterDate))
                .map(({ encounterId, patientId, encounterDate, prescription }, index) => (
                  <Row key={`${encounterId}-${prescription.id}`} index={index}>
                    <Cell className="font-semibold"><PatientLink patient={patientById(patientId)} /></Cell>
                    <Cell>{prescription.drug}</Cell>
                    <Cell>{prescription.qty}</Cell>
                    <Cell>{prescription.dispensedQty ?? (prescription.status === "Dispensed" ? prescription.qty : "—")}</Cell>
                    <Cell>
                      <ClinicalStatusBadge kind="dispense" status={prescription.status} />
                      {prescription.refusalReason && <p className="text-[11px] text-mist-400">{prescription.refusalReason}</p>}
                      {prescription.overrideReason && <p className="text-[11px] text-amber-600">Override: {prescription.overrideReason}</p>}
                    </Cell>
                    <Cell className="text-mist-500">{prescription.dispensedBy ?? "—"}</Cell>
                    <Cell className="text-mist-400">{prescription.dispensedAt ? shortDate(prescription.dispensedAt) : shortDate(encounterDate)}</Cell>
                  </Row>
                ))}
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
                for (const { patientId, prescription } of allRx) byPatient.set(patientId, [...(byPatient.get(patientId) ?? []), prescription]);
                const rows = [...byPatient.entries()];
                if (rows.length === 0) return <div className="card py-10 text-center text-sm text-mist-400">No prescriptions on record.</div>;
                return rows.map(([patientId, prescriptions]) => {
                  const patient = patientById(patientId);
                  const buckets = {
                    "In review / preparation": prescriptions.filter((p) => ["Under Review", "Approved", "Preparing", "Ready"].includes(p.status)),
                    "Current (dispensed)": prescriptions.filter((p) => p.status === "Dispensed" || p.status === "Partially Dispensed"),
                    "Stopped / not given": prescriptions.filter((p) => ["Refused", "Cancelled", "Outsourced", "Rejected"].includes(p.status)),
                  };
                  return (
                    <div key={patientId} className="card">
                      <p className="mb-3 font-semibold text-mist-900">{patient ? <PatientLink patient={patient} /> : patientId}</p>
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

      {/* Review a prescription (Prescription Queue) */}
      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={reviewing ? `${reviewing.prescription.drug} — Pharmacist review` : ""}
        wide
        footer={
          reviewing && reviewing.prescription.status === "Under Review" && !rejecting ? (
            <>
              <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button variant="action" onClick={() => setRejecting(true)}>Reject</Button>
              <Button disabled={reviewHighAlert && !overrideReason.trim()} onClick={submitApproval}>Approve</Button>
            </>
          ) : reviewing && rejecting ? (
            <>
              <Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button>
              <Button variant="action" disabled={!rejectNote.trim()} onClick={submitRejection}>Reject prescription</Button>
            </>
          ) : (
            <Button onClick={() => setReviewing(null)}>Close</Button>
          )
        }
      >
        {reviewing && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-mist-400">Patient</span> <PatientLink patient={patientById(reviewing.patientId)} /></p>
              <p><span className="text-mist-400">Prescribed by</span> {reviewing.prescription.prescribedBy ?? "—"}</p>
              <p><span className="text-mist-400">Priority</span> {reviewing.prescription.priority ?? "Routine"}</p>
              <p><span className="text-mist-400">Source</span> {reviewing.prescription.source ?? "Doctor Prescription"}</p>
            </div>
            <div className="rounded-xl bg-mist-50 p-3 text-sm">
              <p className="font-semibold text-mist-800">{reviewing.prescription.drug}</p>
              <p className="text-mist-500">{reviewing.prescription.dose} · {reviewing.prescription.frequency} · for {reviewing.prescription.duration} · qty {reviewing.prescription.qty}{reviewing.prescription.route ? ` · ${reviewing.prescription.route}` : ""}</p>
              {reviewing.prescription.indication && <p className="text-[11px] text-mist-400">for {reviewing.prescription.indication}</p>}
            </div>

            {reviewAlerts.length === 0 ? (
              <p className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
                <ShieldCheck size={15} aria-hidden /> No safety alerts from the name-based screen. This is not a clinical validation.
              </p>
            ) : (
              <div className="space-y-2">
                {reviewAlerts.map((alert, index) => (
                  <p key={index} className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-sm ring-1 ${alert.severity === "high" ? "bg-action-50 text-action-800 ring-action-200" : alert.severity === "moderate" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-mist-100 text-mist-600 ring-mist-200"}`}>
                    <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span><b className="uppercase">{alert.kind}</b> — {alert.message}</span>
                  </p>
                ))}
                {reviewing.prescription.status === "Under Review" && !rejecting && (
                  <Field label={`Override / proceed reason${reviewHighAlert ? " *" : ""}`}>
                    <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Required to approve despite a high-severity alert" />
                  </Field>
                )}
              </div>
            )}

            {rejecting && (
              <div className="space-y-3 rounded-xl bg-mist-50 p-3">
                <Field label="Reason *">
                  <Select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} options={REJECTION_REASONS} />
                </Field>
                <Field label="Pharmacist note * (shown to the prescriber)">
                  <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                </Field>
              </div>
            )}

            {reviewing.prescription.status === "Rejected" && (
              <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-800">
                <b>{reviewing.prescription.rejectionReason}</b> — {reviewing.prescription.rejectionNote} ({reviewing.prescription.reviewedBy}, {reviewing.prescription.reviewedAt ? dateTime(reviewing.prescription.reviewedAt) : ""})
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Dispense */}
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
                  disabled={dispenseQty <= 0 || (dispenseAlerts.length > 0 && dispenseHighAlert && !dispenseOverride.trim()) || (activeMaster?.controlledSubstance && !witnessBy.trim())}
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

            {dispenseError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{dispenseError}</p>}

            {dispenseAlerts.length === 0 ? (
              <p className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
                <ShieldCheck size={15} aria-hidden /> No safety alerts from the name-based screen. This is not a clinical validation.
              </p>
            ) : (
              <div className="space-y-2">
                {dispenseAlerts.map((alert, index) => (
                  <p key={index} role={alert.severity === "high" ? "alert" : undefined} className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-sm ring-1 ${alert.severity === "high" ? "bg-action-50 text-action-800 ring-action-200" : alert.severity === "moderate" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-mist-100 text-mist-600 ring-mist-200"}`}>
                    <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span><b className="uppercase">{alert.kind}</b> — {alert.message}</span>
                  </p>
                ))}
                <p className="text-[11px] text-mist-400">Warnings do not block dispensing. {dispenseHighAlert ? "A high-severity alert requires an override reason." : "Record why you are proceeding if appropriate."}</p>
              </div>
            )}

            <Grid cols={2}>
              <Field label="Quantity to dispense" hint={dispenseQty < (active.prescription.qty || 1) ? "Recorded as a partial dispense" : undefined}>
                <Input type="number" min={1} max={active.prescription.qty || undefined} value={dispenseQty || ""} onChange={(event) => setDispenseQty(Number(event.target.value))} />
              </Field>
              {dispenseAlerts.length > 0 && (
                <Field label={`Override / proceed reason${dispenseHighAlert ? " *" : ""}`}>
                  <Input value={dispenseOverride} onChange={(event) => setDispenseOverride(event.target.value)} placeholder="e.g. Allergy is to a different class, confirmed with prescriber" />
                </Field>
              )}
            </Grid>

            {activeMaster?.controlledSubstance && (
              <Field label="Witness (required — controlled medicine) *">
                <Input value={witnessBy} onChange={(event) => setWitnessBy(event.target.value)} placeholder="Witnessing staff name" />
              </Field>
            )}

            <Field label="If not dispensing — reason" hint="Fill this to record a refusal instead of dispensing.">
              <Textarea value={refuseReason} onChange={(event) => setRefuseReason(event.target.value)} className="min-h-[60px]" placeholder="e.g. Out of stock, patient declined, prescriber to review dose" />
            </Field>
          </div>
        )}
      </Modal>

      {/* Receive batch */}
      <Modal
        open={showReceive}
        onClose={() => setShowReceive(false)}
        title="Receive batch"
        wide
        footer={<><Button variant="ghost" onClick={() => setShowReceive(false)}>Cancel</Button><Button disabled={!receiveForm.drugId || !receiveForm.quantity} onClick={submitReceiveBatch}>Receive</Button></>}
      >
        <div className="space-y-4">
          <Field label="Drug *">
            <Select value={receiveForm.drugId} onChange={(e) => setReceiveForm({ ...receiveForm, drugId: e.target.value })} options={prescribableCatalog.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Grid cols={2}>
            <Field label="Batch number"><Input value={receiveForm.batchNumber} onChange={(e) => setReceiveForm({ ...receiveForm, batchNumber: e.target.value })} placeholder="Auto-generated if left blank" /></Field>
            <Field label="Quantity *"><Input type="number" min={1} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} /></Field>
            <Field label="Manufacture date"><Input type="date" value={receiveForm.manufactureDate} onChange={(e) => setReceiveForm({ ...receiveForm, manufactureDate: e.target.value })} /></Field>
            <Field label="Expiry date *"><Input type="date" value={receiveForm.expiryDate} onChange={(e) => setReceiveForm({ ...receiveForm, expiryDate: e.target.value })} /></Field>
            <Field label="Unit cost (₦)"><Input type="number" min={0} value={receiveForm.unitCost} onChange={(e) => setReceiveForm({ ...receiveForm, unitCost: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Supplier">
              <Select value={receiveForm.supplierId} onChange={(e) => setReceiveForm({ ...receiveForm, supplierId: e.target.value })} options={[{ value: "", label: "—" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} />
            </Field>
          </Grid>
          <Field label="Receiving location">
            <Select value={receiveForm.location} onChange={(e) => setReceiveForm({ ...receiveForm, location: e.target.value as PharmacyLocation })} options={[...PHARMACY_LOCATIONS]} />
          </Field>
        </div>
      </Modal>

      {/* Resolve a quarantined batch */}
      <Modal
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        title={resolving ? `Resolve quarantined batch — ${stock.find((d) => d.id === resolving.drugId)?.name ?? ""}` : ""}
        footer={<><Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button><Button variant={resolveDecision === "WriteOff" ? "action" : "primary"} disabled={!resolveNote.trim()} onClick={submitResolve}>{resolveDecision === "WriteOff" ? "Write off batch" : "Release into stock"}</Button></>}
      >
        {resolving && (
          <div className="space-y-4">
            {resolveError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{resolveError}</p>}
            <div className="rounded-xl bg-mist-50 p-3 text-sm">
              <p className="font-semibold text-mist-800">Batch <span className="font-mono">{resolving.batchNumber}</span> · {resolving.quantity} units · expires {shortDate(resolving.expiryDate)}</p>
              <p className="text-mist-500">Quarantined: {resolving.quarantineReason ?? "—"}{resolving.quarantinedBy ? ` (${resolving.quarantinedBy})` : ""}</p>
            </div>
            <Field label="Outcome">
              <Select
                value={resolveDecision}
                onChange={(e) => setResolveDecision(e.target.value as "Release" | "WriteOff")}
                options={[{ value: "Release", label: "Release — back into dispensable stock" }, { value: "WriteOff", label: "Write off — destroy / remove permanently" }]}
              />
            </Field>
            <Field label="Note *"><Textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} className="min-h-[60px]" placeholder={resolveDecision === "Release" ? "e.g. Cleared by QA after inspection" : "e.g. Destroyed per SOP, witnessed"} /></Field>
            {resolveDecision === "WriteOff" && <p className="text-[11px] text-mist-400">If this drug is linked to an inventory item, the loss is posted to the general ledger. This can't be undone.</p>}
          </div>
        )}
      </Modal>

      {/* Edit drug master */}
      <Modal
        open={Boolean(editingDrugId)}
        onClose={() => setEditingDrugId(null)}
        title={editingDrugId ? `Edit — ${stock.find((d) => d.id === editingDrugId)?.name}` : ""}
        wide
        footer={<><Button variant="ghost" onClick={() => setEditingDrugId(null)}>Cancel</Button><Button onClick={submitEditDrug}>Save</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Generic name"><Input value={(editForm.genericName as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, genericName: e.target.value })} /></Field>
            <Field label="Brand name"><Input value={(editForm.brandName as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })} /></Field>
            <Field label="Strength"><Input value={(editForm.strength as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })} /></Field>
            <Field label="Manufacturer"><Input value={(editForm.manufacturer as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })} /></Field>
            <Field label="Category">
              <Select value={(editForm.category as string) ?? DRUG_CATEGORIES[0]} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} options={DRUG_CATEGORIES} />
            </Field>
            <Field label="Status">
              <Select value={(editForm.status as string) ?? "Draft"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} options={DRUG_STATUSES} />
            </Field>
            <Field label="Min stock"><Input type="number" min={0} value={(editForm.minStock as number) ?? 0} onChange={(e) => setEditForm({ ...editForm, minStock: Number(e.target.value) })} /></Field>
            <Field label="Reorder level"><Input type="number" min={0} value={(editForm.reorderLevel as number) ?? 0} onChange={(e) => setEditForm({ ...editForm, reorderLevel: Number(e.target.value) })} /></Field>
          </Grid>
          <Grid cols={2}>
            <Checkbox label="Prescription required" checked={Boolean(editForm.prescriptionRequired)} onChange={(e) => setEditForm({ ...editForm, prescriptionRequired: e.target.checked })} />
            <Checkbox label="Controlled medicine" checked={Boolean(editForm.controlledSubstance)} onChange={(e) => setEditForm({ ...editForm, controlledSubstance: e.target.checked })} />
          </Grid>
          <Field label="Patient-facing description"><Textarea value={(editForm.patientDescription as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, patientDescription: e.target.value })} /></Field>
          <Field label="Pharmacist notes (internal)"><Textarea value={(editForm.pharmacistNotes as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, pharmacistNotes: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Add new drug */}
      <Modal
        open={showAddDrug}
        onClose={() => setShowAddDrug(false)}
        title="Add new drug"
        wide
        footer={<><Button variant="ghost" onClick={() => setShowAddDrug(false)}>Cancel</Button><Button disabled={!addDrugForm.name.trim() || !addDrugForm.genericName.trim()} onClick={submitAddDrug}>Create drug</Button></>}
      >
        <div className="space-y-4">
          {addDrugError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{addDrugError}</p>}
          <Grid cols={2}>
            <Field label="Display name *"><Input value={addDrugForm.name} onChange={(e) => setAddDrugForm({ ...addDrugForm, name: e.target.value })} placeholder="e.g. Ibuprofen 400mg (10 tabs)" /></Field>
            <Field label="Generic name *"><Input value={addDrugForm.genericName} onChange={(e) => setAddDrugForm({ ...addDrugForm, genericName: e.target.value })} /></Field>
            <Field label="Brand name"><Input value={addDrugForm.brandName} onChange={(e) => setAddDrugForm({ ...addDrugForm, brandName: e.target.value })} /></Field>
            <Field label="Strength"><Input value={addDrugForm.strength} onChange={(e) => setAddDrugForm({ ...addDrugForm, strength: e.target.value })} placeholder="e.g. 400mg" /></Field>
            <Field label="Dosage form"><Input value={addDrugForm.dosageForm} onChange={(e) => setAddDrugForm({ ...addDrugForm, dosageForm: e.target.value })} /></Field>
            <Field label="Category">
              <Select value={addDrugForm.category} onChange={(e) => setAddDrugForm({ ...addDrugForm, category: e.target.value })} options={DRUG_CATEGORIES} />
            </Field>
          </Grid>
          <Grid cols={2}>
            <Checkbox label="Prescription required" checked={addDrugForm.prescriptionRequired} onChange={(e) => setAddDrugForm({ ...addDrugForm, prescriptionRequired: e.target.checked })} />
            <Checkbox label="Controlled medicine" checked={addDrugForm.controlledSubstance} onChange={(e) => setAddDrugForm({ ...addDrugForm, controlledSubstance: e.target.checked })} />
          </Grid>
          <p className="text-[11px] text-mist-400">Saved as <b>Draft</b> — it won't appear for prescribing or receiving stock until switched to Active from this catalogue.</p>
        </div>
      </Modal>

      {/* Controlled medicine adjustment */}
      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Record controlled medicine adjustment"
        footer={<><Button variant="ghost" onClick={() => setShowAdjust(false)}>Cancel</Button><Button variant="action" disabled={!adjustForm.quantity || !adjustForm.reason.trim()} onClick={submitAdjustment}>Record adjustment</Button></>}
      >
        <div className="space-y-4">
          {adjustError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{adjustError}</p>}
          <Grid cols={2}>
            <Field label="Direction">
              <Select value={adjustForm.direction} onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value as never })} options={[{ value: "Decrease", label: "Decrease (breakage/loss)" }, { value: "Increase", label: "Increase (count correction)" }]} />
            </Field>
            <Field label="Quantity *"><Input type="number" min={1} value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} /></Field>
          </Grid>
          <Field label="Reason *"><Textarea value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
