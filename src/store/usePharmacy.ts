import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useCatalog } from "@/store/useCatalog";
import { useEmr, prescriptionsForPatient } from "@/store/useEmr";
import { useClinical } from "@/store/useClinical";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { screenPrescription, type SafetyAlert } from "@/data/medicationSafety";
import {
  DEFAULT_PHARMACY_LOCATION,
  type DrugMaster, type DrugMasterStatus, type DrugBatch, type PharmacyLocation, type ExpiryBucket,
  type ControlledMedicineEntry, type ControlledMedicineEntryType,
} from "@/data/pharmacyOps";
import type { DrugStock, Prescription } from "@/data/types";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const actor = () => useIdentity.getState().user;

function defaultDrugMaster(id: string, fields: Partial<DrugMaster>): DrugMaster {
  return {
    id,
    genericName: "",
    strength: "",
    dosageForm: "Tablet",
    route: "Oral",
    category: "Other",
    prescriptionRequired: true,
    controlledSubstance: false,
    minStock: 20,
    reorderLevel: 40,
    maxStock: 500,
    unitOfMeasure: "Tablet",
    status: "Active",
    createdBy: actor().name,
    createdAt: now(),
    ...fields,
  };
}

/** loose name-based match — same substring rule accountingApi.issueInventoryByDrug
 *  uses, so a drug's batches and its linked financial item agree on identity. */
function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9/]/g, "");
}

export type DrugCatalogEntry = DrugStock & { master?: DrugMaster };

export type CreateDrugInput = {
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  unitOfMeasure: string;
  prescriptionRequired: boolean;
  controlledSubstance: boolean;
  brandName?: string;
};

export type ReceiveBatchInput = {
  drugId: string;
  batchNumber?: string;
  quantity: number;
  expiryDate: string;
  manufactureDate?: string;
  costPerUnit?: number;
  supplierId?: string;
  location?: PharmacyLocation;
};

export type SubmitPrescriptionInput = {
  encounterId: string;
  patientId: string;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  qty: number;
  route?: string;
  indication?: string;
  instructions?: string;
  priority?: Prescription["priority"];
  source?: Prescription["source"];
};

export type DispenseResult = { ok: true } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

type PharmacyState = {
  drugMasters: DrugMaster[];
  batches: DrugBatch[];
  controlledLog: ControlledMedicineEntry[];

  drugMasterFor: (drugId: string) => DrugMaster | undefined;
  /** the formulary drug a drug-linked inventory item stands for (the reverse of the name match receiveBatch uses) */
  drugForItem: (itemId: string) => DrugStock | undefined;
  drugCatalog: () => DrugCatalogEntry[];
  createDrug: (input: CreateDrugInput) => string;
  updateDrugMaster: (drugId: string, patch: Partial<DrugMaster>) => void;
  setDrugMasterStatus: (drugId: string, status: DrugMasterStatus) => void;

  batchesForDrug: (drugId: string) => DrugBatch[];
  dispensableBatches: (drugId: string) => DrugBatch[];
  totalStock: (drugId: string) => number;
  expiryBucket: (expiryDate: string) => ExpiryBucket;
  receiveBatch: (input: ReceiveBatchInput) => DrugBatch;
  quarantineBatch: (id: string, reason: string) => void;
  /** closes out a quarantined batch — back into stock, or written off (posting the GL write-off when the drug has a linked inventory item) */
  resolveQuarantine: (batchId: string, decision: "Release" | "WriteOff", note: string) => ActionResult;
  consumeFEFO: (drugId: string, qty: number) => { batchId: string; quantity: number; costPerUnit: number }[] | null;

  logForDrug: (drugId: string) => ControlledMedicineEntry[];
  runningBalance: (drugId: string) => number;
  adjustControlledBalance: (drugId: string, input: { quantity: number; direction: "Increase" | "Decrease"; reason: string }) => void;

  screenNewPrescription: (patientId: string, drugName: string) => SafetyAlert[];
  safetyAlertsFor: (encounterId: string, prescriptionId: string) => SafetyAlert[];
  submitPrescription: (input: SubmitPrescriptionInput) => string;
  approvePrescription: (encounterId: string, prescriptionId: string, opts?: { overrideReason?: string }) => void;
  rejectPrescription: (encounterId: string, prescriptionId: string, input: { reason: string; note: string }) => void;
  startPreparing: (encounterId: string, prescriptionId: string) => void;
  markReady: (encounterId: string, prescriptionId: string) => void;
  dispense: (encounterId: string, prescriptionId: string, opts: { quantity: number; overrideReason?: string; witnessBy?: string }) => DispenseResult;

  /** internal helper (still store-public, per this repo's zustand convention) —
   *  appends one append-only controlled-medicine ledger entry and folds the new
   *  running balance from what came before it. */
  appendControlledEntry: (
    drugId: string,
    input: {
      type: ControlledMedicineEntryType; quantity: number; patientId?: string; encounterId?: string;
      prescriptionId?: string; batchId?: string; witnessBy?: string; adjustment?: boolean; reason?: string; pharmacistName: string;
    },
  ) => ControlledMedicineEntry;
};

// "Expired" is always derived from today's date against the batch's own
// expiryDate, never written back to state — computing it during a render-time
// read must never call set() (that causes "setState while rendering" loops).
function isExpired(batch: DrugBatch): boolean {
  return Boolean(batch.expiryDate) && batch.expiryDate < now();
}

function syncCatalogStock(drugId: string, batches: DrugBatch[]) {
  const stock = batches.filter((b) => b.drugId === drugId && b.status === "Active" && !isExpired(b)).reduce((sum, b) => sum + b.quantity, 0);
  const batchCount = batches.filter((b) => b.drugId === drugId && b.status !== "Depleted" && b.status !== "Written Off").length;
  useCatalog.getState().update("drugs", drugId, { stock, batches: batchCount });
}

function linkedInventoryItem(drugName: string) {
  const target = normName(drugName);
  return useInventoryAccounting.getState().items.find((item) => item.linkedDrugId && target.includes(normName(item.linkedDrugId)));
}

/** the financial cost layer that mirrors a pharmacy batch, matched by the drug's linked item + batch number — best effort, absent when the drug has no linked item */
function linkedLayer(batch: DrugBatch) {
  const drug = useCatalog.getState().drugs.find((d) => d.id === batch.drugId);
  const item = drug ? linkedInventoryItem(drug.name) : undefined;
  if (!item) return undefined;
  const layer = useInventoryAccounting.getState().layers.find((l) => l.itemId === item.id && l.batchNumber === batch.batchNumber);
  return layer ? { item, layer } : undefined;
}

export const usePharmacy = create<PharmacyState>(persisted<PharmacyState>("pharmacy-ops", (set, get) => ({
  drugMasters: [],
  batches: [],
  controlledLog: [],

  drugMasterFor: (drugId) => get().drugMasters.find((d) => d.id === drugId),

  drugForItem: (itemId) => {
    const linked = useInventoryAccounting.getState().itemById(itemId)?.linkedDrugId;
    if (!linked) return undefined;
    return useCatalog.getState().drugs.find((d) => normName(d.name).includes(normName(linked)));
  },

  drugCatalog: () => useCatalog.getState().drugs.map((drug) => ({ ...drug, master: get().drugMasterFor(drug.id) })),

  createDrug: (input) => {
    if (!input.name.trim()) throw new Error("Drug name is required.");
    useCatalog.getState().add("drugs", { name: input.name, form: input.dosageForm, strength: input.strength, klass: input.category, batches: 0, stock: 0, reorder: 40, active: true });
    const created = useCatalog.getState().drugs.find((d) => d.name === input.name);
    const id = created!.id;
    const master = defaultDrugMaster(id, {
      genericName: input.genericName,
      brandName: input.brandName,
      strength: input.strength,
      dosageForm: input.dosageForm,
      category: input.category,
      unitOfMeasure: input.unitOfMeasure,
      prescriptionRequired: input.prescriptionRequired,
      controlledSubstance: input.controlledSubstance,
      status: "Draft",
    });
    set((s) => ({ drugMasters: [master, ...s.drugMasters] }));
    audit(`created drug — ${input.name}`, `pharmacy/drug-catalogue/${id}`, { meta: { status: "Draft" } });
    return id;
  },

  updateDrugMaster: (drugId, patch) => {
    set((s) => {
      const existing = s.drugMasters.find((d) => d.id === drugId);
      const next = existing ? { ...existing, ...patch } : defaultDrugMaster(drugId, patch);
      return { drugMasters: existing ? s.drugMasters.map((d) => (d.id === drugId ? next : d)) : [next, ...s.drugMasters] };
    });
    audit("edited drug master record", `pharmacy/drug-catalogue/${drugId}`);
  },

  setDrugMasterStatus: (drugId, status) => {
    get().updateDrugMaster(drugId, { status });
  },

  batchesForDrug: (drugId) =>
    get()
      .batches.filter((b) => b.drugId === drugId)
      .map((b) => (b.status === "Active" && isExpired(b) ? { ...b, status: "Expired" as const } : b))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),

  dispensableBatches: (drugId) => get().batchesForDrug(drugId).filter((b) => b.status === "Active" && b.quantity > 0),

  totalStock: (drugId) => get().dispensableBatches(drugId).reduce((sum, b) => sum + b.quantity, 0),

  expiryBucket: (expiryDate) => {
    if (!expiryDate) return "later";
    const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
    if (days < 0) return "expired";
    if (days <= 30) return "30";
    if (days <= 60) return "60";
    if (days <= 90) return "90";
    if (days <= 180) return "180";
    return "later";
  },

  receiveBatch: (input) => {
    const who = actor();
    const drug = useCatalog.getState().drugs.find((d) => d.id === input.drugId);
    const master = get().drugMasterFor(input.drugId);
    const batch: DrugBatch = {
      id: `batch-${rid()}`,
      drugId: input.drugId,
      batchNumber: input.batchNumber || `AUTO-${Date.now()}`,
      quantity: input.quantity,
      manufactureDate: input.manufactureDate,
      expiryDate: input.expiryDate,
      costPerUnit: input.costPerUnit ?? 0,
      supplierId: input.supplierId,
      location: input.location ?? DEFAULT_PHARMACY_LOCATION,
      receivedAt: now(),
      receivedBy: who.name,
      status: "Active",
    };
    set((s) => ({ batches: [...s.batches, batch] }));
    syncCatalogStock(input.drugId, get().batches);
    audit(`received batch — ${drug?.name ?? input.drugId} x${input.quantity}`, `pharmacy/batch/${batch.id}`, {
      meta: { batchNumber: batch.batchNumber, expiryDate: batch.expiryDate },
    });

    if (master?.controlledSubstance) {
      get().appendControlledEntry(input.drugId, { type: "Received", quantity: input.quantity, batchId: batch.id, pharmacistName: who.name });
    }

    if (drug) {
      const item = linkedInventoryItem(drug.name);
      if (item) {
        useInventoryAccounting.getState().receiveStock({
          itemId: item.id, qty: input.quantity, unitCost: batch.costPerUnit, date: batch.receivedAt,
          reference: batch.batchNumber, expiryDate: input.expiryDate, batchNumber: batch.batchNumber,
        });
      }
    }
    return batch;
  },

  quarantineBatch: (id, reason) => {
    const who = actor();
    set((s) => ({
      batches: s.batches.map((b) => (b.id === id ? { ...b, status: "Quarantined", quarantineReason: reason, quarantinedBy: who.name, quarantinedAt: now() } : b)),
    }));
    const batch = get().batches.find((b) => b.id === id);
    if (batch) {
      syncCatalogStock(batch.drugId, get().batches);
      const linked = linkedLayer(batch);
      if (linked && linked.layer.status !== "Quarantined") useInventoryAccounting.getState().quarantineLayer({ layerId: linked.layer.id, reason });
    }
    audit(`quarantined batch — ${reason}`, `pharmacy/batch/${id}`);
  },

  resolveQuarantine: (batchId, decision, note) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return { ok: false, error: "Batch not found." };
    if (batch.status !== "Quarantined") return { ok: false, error: "Only a quarantined batch can be resolved." };
    if (!note.trim()) return { ok: false, error: "A note is required to resolve a quarantined batch." };
    const who = actor();
    const linked = linkedLayer(batch);
    const inventory = useInventoryAccounting.getState();

    if (decision === "WriteOff") {
      if (linked) {
        // the layer can hold less than the batch (the two views are bridged by name, not kept in lock-step), so write off whichever is smaller
        const qty = Math.min(batch.quantity, linked.layer.remainingQty);
        if (qty > 0) {
          const res = inventory.writeOff({ itemId: linked.item.id, qty, date: now(), reason: `Quarantined batch ${batch.batchNumber} — ${note.trim()}`, layerId: linked.layer.id });
          if (!res.ok) return { ok: false, error: res.error ?? "The stock write-off could not be posted." };
        }
      }
      const master = get().drugMasterFor(batch.drugId);
      if (master?.controlledSubstance && batch.quantity > 0) {
        get().appendControlledEntry(batch.drugId, {
          type: "Dispensed", quantity: batch.quantity, batchId: batch.id, adjustment: true, reason: `Batch ${batch.batchNumber} written off — ${note.trim()}`, pharmacistName: who.name,
        });
      }
    } else if (linked?.layer.status === "Quarantined") {
      inventory.releaseLayer({ layerId: linked.layer.id, note: note.trim() });
    }

    set((s) => ({
      batches: s.batches.map((b) =>
        b.id === batchId ? { ...b, status: decision === "Release" ? ("Active" as const) : ("Written Off" as const), resolvedBy: who.name, resolvedAt: now(), resolutionNote: note.trim() } : b,
      ),
    }));
    syncCatalogStock(batch.drugId, get().batches);
    audit(`${decision === "Release" ? "released" : "wrote off"} quarantined batch — ${note.trim()}`, `pharmacy/batch/${batchId}`);
    return { ok: true };
  },

  consumeFEFO: (drugId, qty) => {
    // dispensableBatches is already sorted earliest-expiry-first — walk it in
    // that order to decide how much to take from each batch, then apply those
    // amounts to the full batch list (whose own order doesn't matter).
    const available = get().dispensableBatches(drugId);
    const totalAvailable = available.reduce((sum, b) => sum + b.quantity, 0);
    if (qty <= 0 || totalAvailable < qty) return null;

    let remaining = qty;
    const consumed: { batchId: string; quantity: number; costPerUnit: number }[] = [];
    const takeById = new Map<string, number>();
    for (const batch of available) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.quantity);
      remaining -= take;
      takeById.set(batch.id, take);
      consumed.push({ batchId: batch.id, quantity: take, costPerUnit: batch.costPerUnit });
    }

    const nextBatches = get().batches.map((b) => {
      const take = takeById.get(b.id);
      if (!take) return b;
      const newQty = b.quantity - take;
      return { ...b, quantity: newQty, status: newQty === 0 ? ("Depleted" as const) : b.status };
    });
    set({ batches: nextBatches });
    syncCatalogStock(drugId, nextBatches);
    return consumed;
  },

  logForDrug: (drugId) => get().controlledLog.filter((e) => e.drugId === drugId).sort((a, b) => (a.at < b.at ? 1 : -1)),

  runningBalance: (drugId) =>
    get()
      .controlledLog.filter((e) => e.drugId === drugId)
      .reduce((bal, e) => bal + (e.type === "Received" ? e.quantity : -e.quantity), 0),

  adjustControlledBalance: (drugId, input) => {
    if (!input.reason.trim()) throw new Error("A controlled medicine adjustment requires a reason.");
    const who = actor();
    get().appendControlledEntry(drugId, {
      type: input.direction === "Increase" ? "Received" : "Dispensed",
      quantity: input.quantity,
      adjustment: true,
      reason: input.reason,
      pharmacistName: who.name,
    });
  },

  screenNewPrescription: (patientId, drugName) => {
    const patient = useEmr.getState().patientById(patientId);
    const drug = useCatalog.getState().drugs.find((d) => normName(drugName).includes(normName(d.name)));
    const alerts = screenPrescription({
      drugName,
      allergies: useClinical.getState().allergiesFor(patient),
      activePrescriptions: prescriptionsForPatient(useEmr.getState().encounters, patientId)
        .filter((p) => ["Approved", "Preparing", "Ready", "Dispensed", "Partially Dispensed"].includes(p.status))
        .map((p) => ({ drug: p.drug, status: p.status })),
      stockOnHand: drug ? get().totalStock(drug.id) : undefined,
    });
    const master = drug ? get().drugMasterFor(drug.id) : undefined;
    if (master?.controlledSubstance) {
      alerts.push({ kind: "controlled", severity: "moderate", message: `${drugName} is a controlled medicine — dispensing requires a witness.` });
    }
    return alerts;
  },

  safetyAlertsFor: (encounterId, prescriptionId) => {
    const encounter = useEmr.getState().encounters.find((e) => e.id === encounterId);
    const rx = encounter?.prescriptions.find((p) => p.id === prescriptionId);
    if (!encounter || !rx) return [];
    return get().screenNewPrescription(encounter.patientId, rx.drug);
  },

  submitPrescription: (input) => {
    const who = actor();
    const prescription: Prescription = {
      id: `rx-${rid()}`,
      drug: input.drug,
      dose: input.dose,
      frequency: input.frequency,
      duration: input.duration,
      qty: input.qty,
      route: input.route,
      indication: input.indication,
      instructions: input.instructions,
      status: "Under Review",
      priority: input.priority ?? "Routine",
      source: input.source ?? "Doctor Prescription",
      prescribedBy: who.name,
      startedAt: now(),
    };
    useEmr.getState().appendPrescriptions(input.encounterId, [prescription]);
    audit(`submitted prescription — ${input.drug}`, `pharmacy/prescription-queue/${prescription.id}`, { meta: { patientId: input.patientId } });
    return prescription.id;
  },

  approvePrescription: (encounterId, prescriptionId, opts) => {
    const who = actor();
    useEmr.getState().updatePrescription(encounterId, prescriptionId, {
      status: "Approved", reviewedBy: who.name, reviewedAt: now(), overrideReason: opts?.overrideReason,
    });
    audit("approved prescription", `pharmacy/prescription-queue/${prescriptionId}`, { meta: opts?.overrideReason ? { override: opts.overrideReason } : undefined });
  },

  rejectPrescription: (encounterId, prescriptionId, input) => {
    if (!input.reason || !input.note) throw new Error("A rejection requires both a reason and a pharmacist note.");
    const who = actor();
    useEmr.getState().updatePrescription(encounterId, prescriptionId, {
      status: "Rejected", rejectionReason: input.reason, rejectionNote: input.note, reviewedBy: who.name, reviewedAt: now(),
    });
    audit(`rejected prescription — ${input.reason}`, `pharmacy/prescription-queue/${prescriptionId}`, { meta: { note: input.note } });
  },

  startPreparing: (encounterId, prescriptionId) => {
    useEmr.getState().setPrescriptionStatus(encounterId, prescriptionId, "Preparing");
    audit("started preparing prescription", `pharmacy/dispensary/${prescriptionId}`);
  },

  markReady: (encounterId, prescriptionId) => {
    useEmr.getState().setPrescriptionStatus(encounterId, prescriptionId, "Ready");
    audit("marked prescription ready for pickup", `pharmacy/dispensary/${prescriptionId}`);
  },

  dispense: (encounterId, prescriptionId, opts) => {
    const encounter = useEmr.getState().encounters.find((e) => e.id === encounterId);
    const rx = encounter?.prescriptions.find((p) => p.id === prescriptionId);
    if (!encounter || !rx) return { ok: false, error: "Prescription not found." };

    const drug = useCatalog.getState().drugs.find((d) => normName(rx.drug).includes(normName(d.name)));
    const master = drug ? get().drugMasterFor(drug.id) : undefined;
    if (master?.controlledSubstance && !opts.witnessBy) {
      return { ok: false, error: "Dispensing a controlled medicine requires a witness." };
    }

    let consumed: { batchId: string; quantity: number; costPerUnit: number }[] | null = null;
    if (drug) {
      consumed = get().consumeFEFO(drug.id, opts.quantity);
      if (!consumed) return { ok: false, error: `Only ${get().totalStock(drug.id)} of ${rx.drug} available — cannot dispense ${opts.quantity}.` };
    }

    const who = actor();
    useEmr.getState().dispensePrescription(encounterId, prescriptionId, { quantity: opts.quantity, overrideReason: opts.overrideReason });

    if (master?.controlledSubstance && drug) {
      get().appendControlledEntry(drug.id, {
        type: "Dispensed", quantity: opts.quantity, patientId: encounter.patientId, encounterId, prescriptionId,
        pharmacistName: who.name, witnessBy: opts.witnessBy, batchId: consumed?.[0]?.batchId,
      });
    }
    return { ok: true };
  },

  appendControlledEntry: (drugId, input) => {
    const prior = get().runningBalance(drugId);
    const balanceAfter = input.type === "Received" ? prior + input.quantity : prior - input.quantity;
    const entry: ControlledMedicineEntry = { id: `cmed-${rid()}`, drugId, at: now(), balanceAfter, ...input };
    set((s) => ({ controlledLog: [entry, ...s.controlledLog] }));
    return entry;
  },
})));
