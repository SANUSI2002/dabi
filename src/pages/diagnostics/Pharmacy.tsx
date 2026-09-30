import { useEffect, useMemo, useState } from "react";
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
import { DRUG_CATEGORIES, PHARMACY_LOCATIONS, REJECTION_REASONS, type PharmacyLocation, type ExpiryBucket, type DrugMasterStatus, type DrugBatch, type ControlledMedicineEntry } from "@/data/pharmacyOps";
import { dateTime, shortDate } from "@/lib/format";
import type { Prescription } from "@/data/types";
import { useIsLiveEmr, useLiveEmr, liveCan } from "@/emr-live/session";
import { useLivePharmacy, useLivePharmacyRefresh, type LiveRxLine, type LiveRegisterEntry, type ApiBatch } from "@/emr-live/pharmacy";
import { describeEmrError, newIdempotencyKey } from "@/emr-live/client";

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
  const { encounters, outsourcePrescription, refusePrescription } = emr;
  const demoStock = useCatalog((state) => state.drugs);
  const allergyRecords = useClinical((state) => state.allergies);
  const pharmacy = usePharmacy();
  const vendors = useAP((state) => state.vendors).filter((v) => v.category === "Pharmaceuticals" && v.active);

  // A live hospital's pharmacy works on its own prescriptions and stock (see src/emr-live/pharmacy.ts).
  const live = useIsLiveEmr();
  const canDispense = !live || liveCan("prescription.dispense");
  useLivePharmacyRefresh(live, live && liveCan("prescription.dispense"));
  const store = useLivePharmacy();
  const myUserId = useLiveEmr((state) => state.user?.id);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Runs a live action; failures are shown instead of closing the dialog. Returns whether it worked. */
  async function runLive(action: () => Promise<void>) {
    setBusy(true);
    setActionError("");
    try { await action(); return true; } catch (cause) { setActionError(describeEmrError(cause)); return false; } finally { setBusy(false); }
  }
  const liveLine = (prescription: Prescription) => prescription as LiveRxLine;
  const patientById = (id?: string) => (live ? store.lines.find((line) => line.patientId === id)?.patient : emr.patientById(id));

  // The catalogue as the page lists it: the demo catalogue, or the hospital formulary with its stock.
  const stock = live
    ? store.drugs.map((drug) => ({ id: drug.code, name: drug.name, strength: drug.strength, form: drug.form, klass: drug.category ?? "—", stock: drug.onHand, reorder: drug.reorderLevel, active: drug.active }))
    : demoStock;

  const demoRx: EncounterRx[] = useMemo(
    () =>
      encounters.flatMap((encounter) =>
        encounter.prescriptions.map((prescription) => ({
          encounterId: encounter.id, patientId: encounter.patientId, encounterDate: encounter.date, provider: encounter.provider, prescription,
        })),
      ),
    [encounters],
  );
  const allRx: EncounterRx[] = live
    ? store.lines.map((line) => ({ encounterId: line.encounterId, patientId: line.patientId, encounterDate: line.orderedAt, provider: line.prescribedBy ?? "", prescription: line }))
    : demoRx;

  const toDispense = allRx.filter(({ prescription }) => ["Approved", "Preparing", "Ready"].includes(prescription.status));
  // Live lines stay "Approved" until fully given, so part-given ones also belong in the history.
  const dispensedHistory = live
    ? allRx
      .filter(({ prescription }) => (prescription.dispensedQty ?? 0) > 0 || ["Outsourced", "Refused"].includes(prescription.status))
      .map((row) => (row.prescription.status === "Approved" ? { ...row, prescription: { ...row.prescription, status: "Partially Dispensed" as const } } : row))
    : allRx.filter(({ prescription }) =>
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

  const reviewAlerts: SafetyAlert[] = reviewing ? (live ? liveLine(reviewing.prescription).alerts : pharmacy.safetyAlertsFor(reviewing.encounterId, reviewing.prescription.id)) : [];
  const reviewHighAlert = reviewAlerts.some((a) => a.severity === "high");

  function openReview(row: EncounterRx) {
    setActionError("");
    setReviewing(row);
    setRejecting(false);
    setOverrideReason("");
    setRejectReason(REJECTION_REASONS[0]);
    setRejectNote("");
  }

  async function submitApproval() {
    if (!reviewing) return;
    if (live) {
      if (await runLive(() => store.approve(liveLine(reviewing.prescription), overrideReason))) setReviewing(null);
      return;
    }
    pharmacy.approvePrescription(reviewing.encounterId, reviewing.prescription.id, { overrideReason: reviewAlerts.length ? overrideReason || undefined : undefined });
    setReviewing(null);
  }

  async function submitRejection() {
    if (!reviewing || !rejectNote.trim()) return;
    if (live) {
      if (await runLive(() => store.reject(liveLine(reviewing.prescription), rejectReason, rejectNote))) setReviewing(null);
      return;
    }
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
  const [dispenseKey, setDispenseKey] = useState("");

  const activePatient = active ? (live ? liveLine(active.prescription).patient : patientById(encounters.find((e) => e.id === active.encounterId)?.patientId ?? "")) : undefined;
  const activeDrug = active && !live ? demoStock.find((d) => active.prescription.drug.toLowerCase().includes(d.name.toLowerCase())) : undefined;
  const activeMaster = activeDrug ? pharmacy.drugMasterFor(activeDrug.id) : undefined;
  const activeControlled = active ? (live ? liveLine(active.prescription).controlled : Boolean(activeMaster?.controlledSubstance)) : false;
  // Live: what is left to give on this line (part may already have been handed over).
  const orderedQty = active ? (live ? liveLine(active.prescription).remaining : active.prescription.qty || 1) : 1;
  const witnesses = store.pharmacyStaff.filter((member) => member.userId !== myUserId);
  const dispenseAlerts: SafetyAlert[] = active ? (live ? liveLine(active.prescription).alerts : pharmacy.safetyAlertsFor(active.encounterId, active.prescription.id)) : [];
  const dispenseHighAlert = dispenseAlerts.some((a) => a.severity === "high");

  function openDispense(encounterId: string, prescription: Prescription) {
    setActive({ encounterId, prescription });
    setDispenseQty(live ? liveLine(prescription).remaining : prescription.qty || 1);
    setDispenseKey(newIdempotencyKey()); // one key per dispensing: a retried click never dispenses twice
    setDispenseOverride("");
    setWitnessBy("");
    setRefuseReason("");
    setDispenseError("");
  }

  async function confirmDispense() {
    if (!active) return;
    setDispenseError("");
    if (live) {
      const done = await runLive(() => store.dispense(liveLine(active.prescription), {
        quantity: dispenseQty, witnessUserId: activeControlled ? witnessBy : undefined, note: dispenseOverride, key: dispenseKey,
      }));
      if (done) setActive(null);
      return;
    }
    const result = pharmacy.dispense(active.encounterId, active.prescription.id, {
      quantity: dispenseQty,
      overrideReason: dispenseAlerts.length ? dispenseOverride || undefined : undefined,
      witnessBy: activeMaster?.controlledSubstance ? witnessBy : undefined,
    });
    if (!result.ok) { setDispenseError(result.error); return; }
    setActive(null);
  }

  // ---- Batch & Expiry ----
  const prescribableCatalog = live
    ? store.drugs.filter((drug) => drug.active).map((drug) => ({ id: drug.code, name: drug.name }))
    : pharmacy.drugCatalog().filter((d) => d.master?.status !== "Draft" && d.master?.status !== "Discontinued");
  const [showReceive, setShowReceive] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    drugId: prescribableCatalog[0]?.id ?? "", batchNumber: "", quantity: "", expiryDate: defaultExpiryInput(), manufactureDate: "",
    unitCost: "", supplierId: vendors[0]?.id ?? "", location: PHARMACY_LOCATIONS[0] as PharmacyLocation,
  });
  const [batchLocationFilter, setBatchLocationFilter] = useState<"All" | PharmacyLocation>("All");
  const [receiveKey, setReceiveKey] = useState("");
  const [receiveSupplier, setReceiveSupplier] = useState("");
  const [resolving, setResolving] = useState<DrugBatch | null>(null);
  const [resolveDecision, setResolveDecision] = useState<"Release" | "WriteOff">("Release");
  const [resolveNote, setResolveNote] = useState("");
  const [resolveError, setResolveError] = useState("");

  // Batches as the table lists them: demo batches, or the hospital's (one store, no quarantine yet).
  type BatchRow = { id: string; drugName: string; batchNumber: string; location: string; quantity: number; expiryDate: string; costPerUnit: number; status: DrugBatch["status"]; demo?: DrugBatch };
  const today = new Date().toISOString().slice(0, 10);
  const allBatches: BatchRow[] = live
    ? store.drugs.flatMap((drug) => drug.batches.map((b) => ({
      id: b.id, drugName: drug.name, batchNumber: b.batchNumber, location: "Pharmacy store", quantity: b.quantityOnHand, expiryDate: b.expiryDate,
      costPerUnit: (b.unitCostMinor ?? 0) / 100, status: (b.expiryDate <= today ? "Expired" : "Active") as DrugBatch["status"],
    })))
    : demoStock.flatMap((drug) => pharmacy.batchesForDrug(drug.id)).map((b) => ({
      id: b.id, drugName: demoStock.find((d) => d.id === b.drugId)?.name ?? b.drugId, batchNumber: b.batchNumber, location: b.location,
      quantity: b.quantity, expiryDate: b.expiryDate, costPerUnit: b.costPerUnit, status: b.status, demo: b,
    }));
  const expiryBuckets = (["expired", "30", "60", "90", "180"] as const).map((key) => ({
    key, label: EXPIRY_BUCKET_LABELS[key],
    rows: allBatches.filter((b) => (b.status === "Active" || b.status === "Expired") && b.quantity > 0 && pharmacy.expiryBucket(b.expiryDate) === key),
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

  function openReceive() {
    setActionError("");
    setReceiveKey(newIdempotencyKey());
    setReceiveForm((f) => ({ ...f, drugId: prescribableCatalog.some((d) => d.id === f.drugId) ? f.drugId : prescribableCatalog[0]?.id ?? "" }));
    setShowReceive(true);
  }

  async function submitReceiveBatch() {
    if (!receiveForm.drugId || !receiveForm.quantity) return;
    if (live) {
      const done = await runLive(() => store.receive({
        code: receiveForm.drugId, batchNumber: receiveForm.batchNumber, expiryDate: receiveForm.expiryDate, quantity: Number(receiveForm.quantity),
        unitCost: receiveForm.unitCost ? Number(receiveForm.unitCost) : undefined, supplier: receiveSupplier, key: receiveKey,
      }));
      if (done) {
        setShowReceive(false);
        setReceiveForm((f) => ({ ...f, batchNumber: "", quantity: "", unitCost: "" }));
        setReceiveSupplier("");
      }
      return;
    }
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
  // Live formulary products also need a code and the units prescribing and dispensing use.
  const [liveDrugExtra, setLiveDrugExtra] = useState({ code: "", doseUnit: "mg", dispenseUnit: "tablet", dosePerUnit: "", route: "PO" });

  const catalogRows = (live
    ? store.drugs.map((drug) => ({
      id: drug.code, name: drug.name, strength: drug.strength, form: drug.form, klass: drug.category ?? "—", stock: drug.onHand, reorder: drug.reorderLevel,
      master: {
        genericName: drug.genericName, strength: drug.strength, dosageForm: drug.form, category: drug.category ?? "", prescriptionRequired: drug.prescriptionRequired,
        controlledSubstance: drug.controlled, status: (drug.active ? "Active" : "Inactive") as DrugMasterStatus, reorderLevel: drug.reorderLevel,
      },
    }))
    : pharmacy.drugCatalog()
  ).filter((d) => categoryFilter === "All" || d.master?.category === categoryFilter);

  function openEditDrug(drugId: string) {
    setActionError("");
    const liveDrug = live ? store.drugs.find((drug) => drug.code === drugId) : undefined;
    if (liveDrug) {
      setEditForm({
        genericName: liveDrug.genericName, brandName: liveDrug.brandName ?? "", strength: liveDrug.strength, manufacturer: liveDrug.manufacturer ?? "",
        category: liveDrug.category ?? "", status: liveDrug.active ? "Active" : "Inactive", minStock: liveDrug.minStock, reorderLevel: liveDrug.reorderLevel,
        prescriptionRequired: liveDrug.prescriptionRequired, controlledSubstance: liveDrug.controlled,
        patientDescription: liveDrug.patientDescription ?? "", pharmacistNotes: liveDrug.pharmacistNotes ?? "",
      });
      setEditingDrugId(drugId);
      return;
    }
    const master = pharmacy.drugMasterFor(drugId);
    // a drug already usable in the formulary (no master record yet — created
    // before this workflow existed) should default to Active, not Draft; Draft
    // is only ever the default for a brand-new drug via "Add new drug".
    setEditForm(master ? { ...master } : { status: "Active" });
    setEditingDrugId(drugId);
  }

  async function submitEditDrug() {
    if (!editingDrugId) return;
    const liveDrug = live ? store.drugs.find((drug) => drug.code === editingDrugId) : undefined;
    if (liveDrug) {
      const optional = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
      const done = await runLive(() => store.saveDrug(liveDrug.code, liveDrug.version, {
        genericName: String(editForm.genericName ?? "").trim() || liveDrug.genericName, brandName: optional(editForm.brandName),
        strength: String(editForm.strength ?? "").trim() || liveDrug.strength, manufacturer: optional(editForm.manufacturer), category: optional(editForm.category),
        active: editForm.status === "Active", minStock: Number(editForm.minStock) || 0, reorderLevel: Number(editForm.reorderLevel) || 0,
        prescriptionRequired: Boolean(editForm.prescriptionRequired), controlled: Boolean(editForm.controlledSubstance),
        patientDescription: optional(editForm.patientDescription), pharmacistNotes: optional(editForm.pharmacistNotes),
      }));
      if (done) setEditingDrugId(null);
      return;
    }
    pharmacy.updateDrugMaster(editingDrugId, editForm);
    setEditingDrugId(null);
  }

  async function submitAddDrug() {
    setAddDrugError("");
    if (live) {
      try {
        await store.createDrug({
          code: liveDrugExtra.code.trim(), genericName: addDrugForm.genericName.trim(), ...(addDrugForm.brandName.trim() ? { brandName: addDrugForm.brandName.trim() } : {}),
          form: addDrugForm.dosageForm.trim(), strength: addDrugForm.strength.trim(), doseUnit: liveDrugExtra.doseUnit.trim(), dispenseUnit: liveDrugExtra.dispenseUnit.trim(),
          ...(liveDrugExtra.dosePerUnit ? { dosePerDispenseUnit: Number(liveDrugExtra.dosePerUnit) } : {}), defaultRoute: liveDrugExtra.route,
          category: addDrugForm.category, prescriptionRequired: addDrugForm.prescriptionRequired, controlled: addDrugForm.controlledSubstance,
        });
        setShowAddDrug(false);
        setAddDrugForm({ name: "", genericName: "", brandName: "", strength: "", dosageForm: "Tablet", category: DRUG_CATEGORIES[0], unitOfMeasure: "Tablet", prescriptionRequired: true, controlledSubstance: false });
        setLiveDrugExtra({ code: "", doseUnit: "mg", dispenseUnit: "tablet", dosePerUnit: "", route: "PO" });
      } catch (cause) {
        setAddDrugError(describeEmrError(cause));
      }
      return;
    }
    try {
      pharmacy.createDrug(addDrugForm);
      setShowAddDrug(false);
      setAddDrugForm({ name: "", genericName: "", brandName: "", strength: "", dosageForm: "Tablet", category: DRUG_CATEGORIES[0], unitOfMeasure: "Tablet", prescriptionRequired: true, controlledSubstance: false });
    } catch (err) {
      setAddDrugError(err instanceof Error ? err.message : "Could not create this drug.");
    }
  }

  // ---- Controlled Medicines ----
  const controlledDrugs = live
    ? store.drugs.filter((drug) => drug.controlled).map((drug) => ({ id: drug.code, name: drug.name }))
    : pharmacy.drugCatalog().filter((d) => d.master?.controlledSubstance);
  const [chosenControlled, setSelectedControlled] = useState<string>(controlledDrugs[0]?.id ?? "");
  const selectedControlled = controlledDrugs.some((d) => d.id === chosenControlled) ? chosenControlled : controlledDrugs[0]?.id ?? "";
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState<{ direction: "Increase" | "Decrease"; quantity: string; reason: string }>({ direction: "Decrease", quantity: "", reason: "" });
  const [adjustBatchId, setAdjustBatchId] = useState("");
  const [adjustError, setAdjustError] = useState("");

  // Live: the register is the stock ledger for the chosen drug (loaded when it is chosen).
  const loadRegister = store.loadRegister;
  useEffect(() => {
    if (live && selectedControlled) loadRegister(selectedControlled).catch(() => undefined);
  }, [live, selectedControlled, loadRegister]);
  const controlledLog = selectedControlled ? (live ? store.register[selectedControlled] ?? [] : pharmacy.logForDrug(selectedControlled)) : [];
  const liveBalance = (code: string) => {
    const drug = store.drugs.find((d) => d.code === code);
    return drug ? drug.onHand + drug.expiredOnHand : 0;
  };
  const runningBalance = (id: string) => (live ? liveBalance(id) : pharmacy.runningBalance(id));
  const adjustBatches: ApiBatch[] = live ? store.drugs.find((drug) => drug.code === selectedControlled)?.batches ?? [] : [];

  async function submitAdjustment() {
    setAdjustError("");
    if (live) {
      const batch = adjustBatches.find((b) => b.id === adjustBatchId) ?? adjustBatches[0];
      if (!batch) { setAdjustError("There is no stock batch of this medicine to adjust."); return; }
      const quantity = Number(adjustForm.quantity) * (adjustForm.direction === "Decrease" ? -1 : 1);
      try {
        await store.adjust(batch, quantity, adjustForm.reason);
        await store.loadRegister(selectedControlled);
        setShowAdjust(false);
        setAdjustForm({ direction: "Decrease", quantity: "", reason: "" });
      } catch (cause) {
        setAdjustError(describeEmrError(cause));
      }
      return;
    }
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

      {(store.error && live) || (actionError && !reviewing && !active && !showReceive && !editingDrugId) ? (
        <p role="alert" className="mb-4 rounded-xl bg-action-50 px-4 py-2.5 text-sm font-medium text-action-800 ring-1 ring-action-200">
          {actionError || store.error}
        </p>
      ) : null}

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
                const patientAllergies = live ? [] : patient ? selectAllergiesFor(allergyRecords, patient) : [];
                const liveAllergies = live ? liveLine(items[0]).allergies : [];
                return (
                  <div key={encounterId} className="card">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-mist-900"><PatientLink patient={patient} /></p>
                        <p className="text-[11px] text-mist-400">{patient?.mrn} · approved from encounter {dateTime(encounterDate)} · {provider}</p>
                      </div>
                      {liveAllergies.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-action-50 px-2 py-0.5 text-[11px] font-bold text-action-700 ring-1 ring-action-200">
                          <TriangleAlert size={12} aria-hidden /> Allergy: {liveAllergies.join(", ")}
                        </span>
                      )}
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
                            {live ? (
                              <>
                                <Badge tone="amber">{prescription.dispensedQty ? `${prescription.dispensedQty} of ${prescription.qty} given` : "To dispense"}</Badge>
                                {canDispense && <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => openDispense(encounterId, prescription)}>Review &amp; dispense</Button>}
                              </>
                            ) : <Badge tone={prescription.status === "Ready" ? "brand" : "amber"}>{prescription.status === "Approved" ? "Awaiting prep" : prescription.status === "Preparing" ? "Preparing" : "Ready for pickup"}</Badge>}
                            {!live && prescription.status === "Approved" && (
                              <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => pharmacy.startPreparing(encounterId, prescription.id)}>Start preparing</Button>
                            )}
                            {!live && prescription.status === "Preparing" && (
                              <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => pharmacy.markReady(encounterId, prescription.id)}>Mark ready</Button>
                            )}
                            {!live && prescription.status === "Ready" && (
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
                  <Select value={batchLocationFilter} onChange={(e) => setBatchLocationFilter(e.target.value as never)} options={live ? ["All"] : ["All", ...PHARMACY_LOCATIONS]} className="h-9 w-auto py-0 text-sm" />
                  <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={openReceive}><Plus size={13} /> Receive batch</Button>
                </div>
                <Table columns={["Drug", "Batch #", "Location", "Quantity", "Expiry", "Unit Cost", "Status", ""]}>
                  {visibleBatches.length === 0 && <EmptyRow colSpan={8}>No batches recorded yet.</EmptyRow>}
                  {visibleBatches.map((b) => {
                    return (
                      <Row key={b.id}>
                        <Cell className="font-medium">{b.drugName}</Cell>
                        <Cell className="font-mono text-xs">{b.batchNumber}</Cell>
                        <Cell>{b.location}</Cell>
                        <Cell>{b.quantity}</Cell>
                        <Cell>{shortDate(b.expiryDate)}</Cell>
                        <Cell>₦{b.costPerUnit.toLocaleString()}</Cell>
                        <Cell>
                          <Badge tone={b.status === "Active" ? "brand" : b.status === "Expired" || b.status === "Written Off" ? "action" : b.status === "Quarantined" ? "amber" : "mist"}>{b.status}</Badge>
                          {b.status === "Quarantined" && b.demo?.quarantineReason && <span className="block text-[11px] text-mist-500">{b.demo.quarantineReason}</span>}
                          {b.status === "Written Off" && b.demo?.resolutionNote && <span className="block text-[11px] text-mist-500">{b.demo.resolutionNote}</span>}
                        </Cell>
                        <Cell>
                          {b.demo && b.status === "Active" && (
                            <button className="btn-ghost px-2 py-1 text-xs text-action-600" onClick={() => pharmacy.quarantineBatch(b.id, "Manual quarantine")}>Quarantine</button>
                          )}
                          {b.demo && b.status === "Quarantined" && (
                            <button className="btn-soft px-2 py-1 text-xs" onClick={() => openResolve(b.demo!)}>Resolve</button>
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
                <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => { setAddDrugError(""); setShowAddDrug(true); }}><Plus size={13} /> Add new drug</Button>
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
                    <Cell className="font-semibold">{live ? drug.stock : pharmacy.batchesForDrug(drug.id).length ? pharmacy.totalStock(drug.id) : drug.stock}<span className="text-[11px] font-normal text-mist-400"> / reorder {drug.master?.reorderLevel ?? drug.reorder}</span></Cell>
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
                        <p className="font-display text-lg font-bold text-mist-900">{runningBalance(d.id)}</p>
                        <p className="text-[11px] text-mist-500">{d.name}</p>
                      </button>
                    ))}
                  </div>
                  <div className="card p-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-100 px-4 py-3">
                      <p className="flex items-center gap-1.5 font-semibold text-mist-800">
                        <ShieldAlert size={15} /> {controlledDrugs.find((d) => d.id === selectedControlled)?.name} — running balance: {runningBalance(selectedControlled)}
                      </p>
                      <Button variant="action" className="px-2.5 py-1 text-xs" onClick={() => { setAdjustError(""); setAdjustBatchId(adjustBatches[0]?.id ?? ""); setShowAdjust(true); }}><Plus size={13} /> Record adjustment</Button>
                    </div>
                    <Table columns={["Type", "Quantity", "Patient", "Pharmacist", "Witness", "Balance after", "Date"]}>
                      {controlledLog.length === 0 && <EmptyRow colSpan={7}>No activity recorded for this medicine yet.</EmptyRow>}
                      {controlledLog.map((entry) => (
                        <Row key={entry.id}>
                          <Cell><Badge tone={entry.type === "Received" ? "brand" : "action"}>{entry.adjustment ? `${entry.type} (Adj.)` : entry.type}</Badge></Cell>
                          <Cell>{entry.quantity}</Cell>
                          <Cell><PatientLink patient={live ? (entry as LiveRegisterEntry).patient : (entry as ControlledMedicineEntry).patientId ? patientById((entry as ControlledMedicineEntry).patientId) : undefined} /></Cell>
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
          reviewing && reviewing.prescription.status === "Under Review" && !rejecting && (!live || liveCan("prescription.review")) ? (
            <>
              <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button variant="action" onClick={() => setRejecting(true)}>Reject</Button>
              <Button disabled={(reviewHighAlert && !overrideReason.trim()) || busy} onClick={() => { void submitApproval(); }}>Approve</Button>
            </>
          ) : reviewing && rejecting ? (
            <>
              <Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button>
              <Button variant="action" disabled={!rejectNote.trim() || busy} onClick={() => { void submitRejection(); }}>Reject prescription</Button>
            </>
          ) : (
            <Button onClick={() => setReviewing(null)}>Close</Button>
          )
        }
      >
        {reviewing && (
          <div className="space-y-4">
            {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
            {live && liveLine(reviewing.prescription).siblings.length > 0 && reviewing.prescription.status === "Under Review" && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                The prescription is reviewed as a whole: approving or rejecting also covers {liveLine(reviewing.prescription).siblings.join(", ")}.
              </p>
            )}
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
                <ShieldCheck size={15} aria-hidden /> {live ? "No safety alerts were raised when this was prescribed (allergy, dose and duplicate checks)." : "No safety alerts from the name-based screen. This is not a clinical validation."}
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
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (!live) { outsourcePrescription(active.encounterId, active.prescription.id); setActive(null); return; }
                    const reason = refuseReason.trim() || "Sent out: to be bought outside the hospital pharmacy";
                    void runLive(() => store.close(liveLine(active.prescription), "OUTSOURCED", reason)).then((done) => { if (done) setActive(null); });
                  }}
                >Outsource</Button>
                <Button
                  variant="action"
                  disabled={!refuseReason.trim() || busy}
                  onClick={() => {
                    if (!live) { refusePrescription(active.encounterId, active.prescription.id, refuseReason.trim()); setActive(null); return; }
                    void runLive(() => store.close(liveLine(active.prescription), "NOT_DISPENSED", refuseReason.trim())).then((done) => { if (done) setActive(null); });
                  }}
                >
                  Not dispensed
                </Button>
                <Button
                  disabled={dispenseQty <= 0 || (dispenseAlerts.length > 0 && dispenseHighAlert && !dispenseOverride.trim()) || (activeControlled && !witnessBy.trim()) || busy}
                  onClick={() => { void confirmDispense(); }}
                >
                  {dispenseQty >= orderedQty ? "Dispense in full" : `Dispense ${dispenseQty} of ${orderedQty}`}
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

            {(dispenseError || (live && actionError)) && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{dispenseError || actionError}</p>}
            {live && (active.prescription.dispensedQty ?? 0) > 0 && (
              <p className="text-[11px] text-mist-500">{active.prescription.dispensedQty} already given; {orderedQty} left on this prescription.</p>
            )}

            {dispenseAlerts.length === 0 ? (
              <p className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
                <ShieldCheck size={15} aria-hidden /> {live ? "No safety alerts were raised when this was prescribed (allergy, dose and duplicate checks)." : "No safety alerts from the name-based screen. This is not a clinical validation."}
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
              <Field label="Quantity to dispense" hint={dispenseQty < orderedQty ? "Recorded as a partial dispense" : undefined}>
                <Input type="number" min={1} max={orderedQty || undefined} value={dispenseQty || ""} onChange={(event) => setDispenseQty(Number(event.target.value))} />
              </Field>
              {dispenseAlerts.length > 0 && (
                <Field label={`Override / proceed reason${dispenseHighAlert ? " *" : ""}`}>
                  <Input value={dispenseOverride} onChange={(event) => setDispenseOverride(event.target.value)} placeholder="e.g. Allergy is to a different class, confirmed with prescriber" />
                </Field>
              )}
            </Grid>

            {activeControlled && (
              <Field label="Witness (required — controlled medicine) *">
                {live ? (
                  <Select value={witnessBy} onChange={(event) => setWitnessBy(event.target.value)} options={[{ value: "", label: "Choose the witnessing pharmacy staff member…" }, ...witnesses.map((w) => ({ value: w.userId, label: w.name }))]} />
                ) : (
                  <Input value={witnessBy} onChange={(event) => setWitnessBy(event.target.value)} placeholder="Witnessing staff name" />
                )}
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
        footer={<><Button variant="ghost" onClick={() => setShowReceive(false)}>Cancel</Button><Button disabled={!receiveForm.drugId || !receiveForm.quantity || (live && !receiveForm.batchNumber.trim()) || busy} onClick={() => { void submitReceiveBatch(); }}>Receive</Button></>}
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          <Field label="Drug *">
            <Select value={receiveForm.drugId} onChange={(e) => setReceiveForm({ ...receiveForm, drugId: e.target.value })} options={prescribableCatalog.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Grid cols={2}>
            <Field label={live ? "Batch number *" : "Batch number"}><Input value={receiveForm.batchNumber} onChange={(e) => setReceiveForm({ ...receiveForm, batchNumber: e.target.value })} placeholder={live ? "As printed on the pack" : "Auto-generated if left blank"} /></Field>
            <Field label="Quantity *"><Input type="number" min={1} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} /></Field>
            {!live && <Field label="Manufacture date"><Input type="date" value={receiveForm.manufactureDate} onChange={(e) => setReceiveForm({ ...receiveForm, manufactureDate: e.target.value })} /></Field>}
            <Field label="Expiry date *"><Input type="date" value={receiveForm.expiryDate} onChange={(e) => setReceiveForm({ ...receiveForm, expiryDate: e.target.value })} /></Field>
            <Field label="Unit cost (₦)"><Input type="number" min={0} value={receiveForm.unitCost} onChange={(e) => setReceiveForm({ ...receiveForm, unitCost: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Supplier">
              {live ? (
                <Input value={receiveSupplier} onChange={(e) => setReceiveSupplier(e.target.value)} placeholder="Optional" />
              ) : (
                <Select value={receiveForm.supplierId} onChange={(e) => setReceiveForm({ ...receiveForm, supplierId: e.target.value })} options={[{ value: "", label: "—" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} />
              )}
            </Field>
          </Grid>
          {!live && (
            <Field label="Receiving location">
              <Select value={receiveForm.location} onChange={(e) => setReceiveForm({ ...receiveForm, location: e.target.value as PharmacyLocation })} options={[...PHARMACY_LOCATIONS]} />
            </Field>
          )}
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
        footer={<><Button variant="ghost" onClick={() => setEditingDrugId(null)}>Cancel</Button><Button disabled={busy} onClick={() => { void submitEditDrug(); }}>Save</Button></>}
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          <Grid cols={2}>
            <Field label="Generic name"><Input value={(editForm.genericName as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, genericName: e.target.value })} /></Field>
            <Field label="Brand name"><Input value={(editForm.brandName as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })} /></Field>
            <Field label="Strength"><Input value={(editForm.strength as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })} /></Field>
            <Field label="Manufacturer"><Input value={(editForm.manufacturer as string) ?? ""} onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })} /></Field>
            <Field label="Category">
              <Select value={(editForm.category as string) ?? DRUG_CATEGORIES[0]} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} options={live ? [{ value: "", label: "— Not set —" }, ...DRUG_CATEGORIES.map((c) => ({ value: c, label: c }))] : DRUG_CATEGORIES} />
            </Field>
            <Field label="Status">
              <Select value={(editForm.status as string) ?? "Draft"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} options={live ? ["Active", "Inactive"] : DRUG_STATUSES} />
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
        footer={<><Button variant="ghost" onClick={() => setShowAddDrug(false)}>Cancel</Button><Button disabled={(live ? !liveDrugExtra.code.trim() || !addDrugForm.strength.trim() : !addDrugForm.name.trim()) || !addDrugForm.genericName.trim()} onClick={() => { void submitAddDrug(); }}>Create drug</Button></>}
      >
        <div className="space-y-4">
          {addDrugError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{addDrugError}</p>}
          <Grid cols={2}>
            {live ? (
              <Field label="Formulary code *" hint="Short code prescribers and stock use, e.g. IBU400"><Input value={liveDrugExtra.code} onChange={(e) => setLiveDrugExtra({ ...liveDrugExtra, code: e.target.value.toUpperCase() })} /></Field>
            ) : (
              <Field label="Display name *"><Input value={addDrugForm.name} onChange={(e) => setAddDrugForm({ ...addDrugForm, name: e.target.value })} placeholder="e.g. Ibuprofen 400mg (10 tabs)" /></Field>
            )}
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
          {live && (
            <Grid cols={2}>
              <Field label="Dose unit *" hint="What doses are prescribed in, e.g. mg"><Input value={liveDrugExtra.doseUnit} onChange={(e) => setLiveDrugExtra({ ...liveDrugExtra, doseUnit: e.target.value })} /></Field>
              <Field label="Dispense unit *" hint="What is handed over, e.g. tablet"><Input value={liveDrugExtra.dispenseUnit} onChange={(e) => setLiveDrugExtra({ ...liveDrugExtra, dispenseUnit: e.target.value })} /></Field>
              <Field label="Dose per dispense unit" hint="e.g. 400 (mg per tablet) — lets quantities be worked out"><Input type="number" min={0} value={liveDrugExtra.dosePerUnit} onChange={(e) => setLiveDrugExtra({ ...liveDrugExtra, dosePerUnit: e.target.value })} /></Field>
              <Field label="Default route"><Select value={liveDrugExtra.route} onChange={(e) => setLiveDrugExtra({ ...liveDrugExtra, route: e.target.value })} options={["PO", "SL", "IV", "IM", "SC", "INHALED", "TOPICAL", "PR", "PV", "OPHTHALMIC", "OTIC", "NASAL"]} /></Field>
            </Grid>
          )}
          <p className="text-[11px] text-mist-400">
            {live
              ? "Available for prescribing and receiving stock as soon as it is saved; switch it to Inactive from this catalogue to withdraw it."
              : <>Saved as <b>Draft</b> — it won&apos;t appear for prescribing or receiving stock until switched to Active from this catalogue.</>}
          </p>
        </div>
      </Modal>

      {/* Controlled medicine adjustment */}
      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Record controlled medicine adjustment"
        footer={<><Button variant="ghost" onClick={() => setShowAdjust(false)}>Cancel</Button><Button variant="action" disabled={!adjustForm.quantity || !adjustForm.reason.trim()} onClick={() => { void submitAdjustment(); }}>Record adjustment</Button></>}
      >
        <div className="space-y-4">
          {adjustError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{adjustError}</p>}
          {live && (
            <Field label="Batch *" hint="Stock is counted per batch">
              <Select value={adjustBatchId} onChange={(e) => setAdjustBatchId(e.target.value)} options={adjustBatches.map((b) => ({ value: b.id, label: `${b.batchNumber} · ${b.quantityOnHand} on hand · expires ${shortDate(b.expiryDate)}` }))} />
            </Field>
          )}
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
