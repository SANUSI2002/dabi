import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePharmacy } from "./usePharmacy";
import { useCatalog } from "./useCatalog";
import { useEmr } from "./useEmr";
import { useIdentity } from "./useIdentity";
import { useInventoryAccounting } from "./accounting/useInventoryAccounting";
import { useLedger } from "./accounting/useLedger";

function makeEncounter(patientId = "p1") {
  const encounterId = useEmr.getState().createWardRoundEncounter(patientId, "Dr. Adaeze Okonjo");
  return encounterId;
}

describe("usePharmacy — pharmacy operations", () => {
  beforeEach(() => {
    useIdentity.getState().setUser("s1");
  });

  afterEach(() => {
    usePharmacy.setState({ drugMasters: [], batches: [], controlledLog: [] });
    useEmr.setState({ encounters: [] });
  });

  it("creates a drug as Draft and lets it be switched to Active", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Ibuprofen 400mg", genericName: "Ibuprofen", strength: "400mg", dosageForm: "Tablet",
      category: "Analgesics & Antipyretics", unitOfMeasure: "Tablet", prescriptionRequired: false, controlledSubstance: false,
    });
    expect(usePharmacy.getState().drugMasterFor(drugId)?.status).toBe("Draft");
    expect(useCatalog.getState().drugs.find((d) => d.id === drugId)?.name).toBe("Ibuprofen 400mg");

    usePharmacy.getState().setDrugMasterStatus(drugId, "Active");
    expect(usePharmacy.getState().drugMasterFor(drugId)?.status).toBe("Active");
  });

  it("FEFO consumption draws the earliest-expiring batch first", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Amoxicillin", genericName: "Amoxicillin", strength: "500mg", dosageForm: "Capsule",
      category: "Antibiotics", unitOfMeasure: "Capsule", prescriptionRequired: true, controlledSubstance: false,
    });
    const later = new Date(Date.now() + 200 * 86_400_000).toISOString();
    const sooner = new Date(Date.now() + 30 * 86_400_000).toISOString();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: later, batchNumber: "LATER" });
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: sooner, batchNumber: "SOONER" });

    expect(usePharmacy.getState().totalStock(drugId)).toBe(20);
    const consumed = usePharmacy.getState().consumeFEFO(drugId, 5);
    expect(consumed).not.toBeNull();
    const soonerBatch = usePharmacy.getState().batchesForDrug(drugId).find((b) => b.batchNumber === "SOONER")!;
    expect(soonerBatch.quantity).toBe(5); // drawn down first
    const laterBatch = usePharmacy.getState().batchesForDrug(drugId).find((b) => b.batchNumber === "LATER")!;
    expect(laterBatch.quantity).toBe(10); // untouched
  });

  it("a quarantined batch is excluded from FEFO consumption", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Metronidazole", genericName: "Metronidazole", strength: "400mg", dosageForm: "Tablet",
      category: "Antiprotozoals", unitOfMeasure: "Tablet", prescriptionRequired: true, controlledSubstance: false,
    });
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 100 * 86_400_000).toISOString();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: soon, batchNumber: "Q" });
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: later, batchNumber: "OK" });
    const quarantineTarget = usePharmacy.getState().batchesForDrug(drugId).find((b) => b.batchNumber === "Q")!;
    usePharmacy.getState().quarantineBatch(quarantineTarget.id, "Suspected temperature excursion");

    expect(usePharmacy.getState().totalStock(drugId)).toBe(10); // only the non-quarantined batch counts
    const consumed = usePharmacy.getState().consumeFEFO(drugId, 10)!;
    expect(consumed[0].batchId).not.toBe(quarantineTarget.id);
  });

  it("controlled medicine running balance folds across receive, dispense and adjustment", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Tramadol", genericName: "Tramadol", strength: "50mg", dosageForm: "Capsule",
      category: "Opioid Analgesics", unitOfMeasure: "Capsule", prescriptionRequired: true, controlledSubstance: true,
    });
    const expiry = new Date(Date.now() + 300 * 86_400_000).toISOString();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 30, expiryDate: expiry });
    expect(usePharmacy.getState().runningBalance(drugId)).toBe(30);

    usePharmacy.getState().adjustControlledBalance(drugId, { quantity: 2, direction: "Decrease", reason: "Breakage during count" });
    expect(usePharmacy.getState().runningBalance(drugId)).toBe(28);
    expect(usePharmacy.getState().logForDrug(drugId)).toHaveLength(2);
  });

  it("rejects a controlled-medicine adjustment with no reason", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Tramadol 2", genericName: "Tramadol", strength: "50mg", dosageForm: "Capsule",
      category: "Opioid Analgesics", unitOfMeasure: "Capsule", prescriptionRequired: true, controlledSubstance: true,
    });
    expect(() => usePharmacy.getState().adjustControlledBalance(drugId, { quantity: 1, direction: "Decrease", reason: "" })).toThrow();
  });

  it("submit → approve → dispense: full lifecycle preserves the audit trail and consumes stock", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Paracetamol", genericName: "Paracetamol", strength: "500mg", dosageForm: "Tablet",
      category: "Analgesics & Antipyretics", unitOfMeasure: "Tablet", prescriptionRequired: false, controlledSubstance: false,
    });
    const expiry = new Date(Date.now() + 300 * 86_400_000).toISOString();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 20, expiryDate: expiry });

    const encounterId = makeEncounter("p1");
    const prescriptionId = usePharmacy.getState().submitPrescription({
      encounterId, patientId: "p1", drug: "Test Paracetamol", dose: "1 tab", frequency: "TDS", duration: "3 days", qty: 9,
    });
    const encounter = useEmr.getState().encounters.find((e) => e.id === encounterId)!;
    expect(encounter.prescriptions[0].status).toBe("Under Review");

    usePharmacy.getState().approvePrescription(encounterId, prescriptionId);
    expect(useEmr.getState().encounters.find((e) => e.id === encounterId)!.prescriptions[0].status).toBe("Approved");

    usePharmacy.getState().startPreparing(encounterId, prescriptionId);
    usePharmacy.getState().markReady(encounterId, prescriptionId);
    expect(useEmr.getState().encounters.find((e) => e.id === encounterId)!.prescriptions[0].status).toBe("Ready");

    const result = usePharmacy.getState().dispense(encounterId, prescriptionId, { quantity: 9 });
    expect(result.ok).toBe(true);
    expect(useEmr.getState().encounters.find((e) => e.id === encounterId)!.prescriptions[0].status).toBe("Dispensed");
    expect(usePharmacy.getState().totalStock(drugId)).toBe(11);
  });

  it("rejecting a prescription requires both a reason and a note", () => {
    const encounterId = makeEncounter("p1");
    const prescriptionId = usePharmacy.getState().submitPrescription({
      encounterId, patientId: "p1", drug: "Some Drug", dose: "1 tab", frequency: "OD", duration: "5 days", qty: 5,
    });
    expect(() => usePharmacy.getState().rejectPrescription(encounterId, prescriptionId, { reason: "", note: "" })).toThrow();
    usePharmacy.getState().rejectPrescription(encounterId, prescriptionId, { reason: "Drug unavailable", note: "Out of stock, advised alternative" });
    expect(useEmr.getState().encounters.find((e) => e.id === encounterId)!.prescriptions[0].status).toBe("Rejected");
  });

  it("dispense is blocked when FEFO stock can't cover the approved quantity", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Scarce Drug", genericName: "Scarce", strength: "100mg", dosageForm: "Tablet",
      category: "Other", unitOfMeasure: "Tablet", prescriptionRequired: false, controlledSubstance: false,
    });
    const expiry = new Date(Date.now() + 300 * 86_400_000).toISOString();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 2, expiryDate: expiry });

    const encounterId = makeEncounter("p1");
    const prescriptionId = usePharmacy.getState().submitPrescription({
      encounterId, patientId: "p1", drug: "Test Scarce Drug", dose: "1 tab", frequency: "OD", duration: "10 days", qty: 10,
    });
    usePharmacy.getState().approvePrescription(encounterId, prescriptionId);
    usePharmacy.getState().markReady(encounterId, prescriptionId);

    const result = usePharmacy.getState().dispense(encounterId, prescriptionId, { quantity: 10 });
    expect(result.ok).toBe(false);
    expect(useEmr.getState().encounters.find((e) => e.id === encounterId)!.prescriptions[0].status).toBe("Ready"); // unchanged
  });

  it("dispensing a controlled medicine without a witness is blocked", () => {
    const drugId = usePharmacy.getState().createDrug({
      name: "Test Controlled Drug", genericName: "Fentanyl-like", strength: "50mcg", dosageForm: "Ampoule",
      category: "Opioid Analgesics", unitOfMeasure: "Ampoule", prescriptionRequired: true, controlledSubstance: true,
    });
    const expiry = new Date(Date.now() + 300 * 86_400_000).toISOString();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: expiry });

    const encounterId = makeEncounter("p1");
    const prescriptionId = usePharmacy.getState().submitPrescription({
      encounterId, patientId: "p1", drug: "Test Controlled Drug", dose: "1 amp", frequency: "PRN", duration: "1 day", qty: 1,
    });
    usePharmacy.getState().approvePrescription(encounterId, prescriptionId);
    usePharmacy.getState().markReady(encounterId, prescriptionId);

    const withoutWitness = usePharmacy.getState().dispense(encounterId, prescriptionId, { quantity: 1 });
    expect(withoutWitness.ok).toBe(false);

    const withWitness = usePharmacy.getState().dispense(encounterId, prescriptionId, { quantity: 1, witnessBy: "Nurse Grace Nwangbo" });
    expect(withWitness.ok).toBe(true);
    expect(usePharmacy.getState().runningBalance(drugId)).toBe(9); // 10 received - 1 dispensed
  });
});

describe("usePharmacy — quarantine resolution", () => {
  const expiry = () => new Date(Date.now() + 300 * 86_400_000).toISOString();
  // "…Amoxicillin…" matches the seeded linked inventory item; "Zzz…" matches none
  const linkedDrug = (name = "Test Amoxicillin Resolve") =>
    usePharmacy.getState().createDrug({ name, genericName: "Amoxicillin", strength: "500mg", dosageForm: "Capsule", category: "Antibiotics", unitOfMeasure: "Capsule", prescriptionRequired: true, controlledSubstance: false });
  const unlinkedDrug = (controlled = false) =>
    usePharmacy.getState().createDrug({ name: `Zzz Unlinked Compound ${Math.random()}`, genericName: "Zzz", strength: "1mg", dosageForm: "Tablet", category: "Other", unitOfMeasure: "Tablet", prescriptionRequired: true, controlledSubstance: controlled });
  const batchOf = (drugId: string, batchNumber: string) => usePharmacy.getState().batches.find((b) => b.drugId === drugId && b.batchNumber === batchNumber)!;
  const layerOf = (batchNumber: string) => useInventoryAccounting.getState().layers.find((l) => l.batchNumber === batchNumber)!;

  let snapshot: ReturnType<typeof useInventoryAccounting.getState>;
  beforeEach(() => {
    useIdentity.getState().setUser("s1");
    snapshot = useInventoryAccounting.getState();
  });
  afterEach(() => {
    usePharmacy.setState({ drugMasters: [], batches: [], controlledLog: [] });
    useInventoryAccounting.setState({ items: snapshot.items, layers: snapshot.layers, movements: snapshot.movements });
  });

  it("quarantining a batch of a linked drug also quarantines its matching cost layer", () => {
    const drugId = linkedDrug();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 20, expiryDate: expiry(), batchNumber: "LINK-Q", costPerUnit: 100 });
    expect(layerOf("LINK-Q").status).not.toBe("Quarantined");

    usePharmacy.getState().quarantineBatch(batchOf(drugId, "LINK-Q").id, "Suspected contamination");
    expect(batchOf(drugId, "LINK-Q").status).toBe("Quarantined");
    expect(layerOf("LINK-Q").status).toBe("Quarantined");
  });

  it("releasing a quarantined batch restores it in both the pharmacy and the financial layer", () => {
    const drugId = linkedDrug("Test Amoxicillin Release");
    usePharmacy.getState().receiveBatch({ drugId, quantity: 20, expiryDate: expiry(), batchNumber: "LINK-R", costPerUnit: 100 });
    usePharmacy.getState().quarantineBatch(batchOf(drugId, "LINK-R").id, "Held for QA");
    expect(usePharmacy.getState().totalStock(drugId)).toBe(0);

    const res = usePharmacy.getState().resolveQuarantine(batchOf(drugId, "LINK-R").id, "Release", "Cleared by QA");
    expect(res.ok).toBe(true);
    expect(batchOf(drugId, "LINK-R")).toMatchObject({ status: "Active", resolutionNote: "Cleared by QA" });
    expect(usePharmacy.getState().totalStock(drugId)).toBe(20);
    expect(layerOf("LINK-R").status).toBe("Active");
  });

  it("writing off a quarantined batch of a linked drug posts a GL write-off for that batch's layer", () => {
    const drugId = linkedDrug("Test Amoxicillin WriteOff");
    usePharmacy.getState().receiveBatch({ drugId, quantity: 20, expiryDate: expiry(), batchNumber: "LINK-W", costPerUnit: 100 });
    usePharmacy.getState().quarantineBatch(batchOf(drugId, "LINK-W").id, "Expired in transit");
    const journalsBefore = useLedger.getState().entries.length;
    const qtyBefore = useInventoryAccounting.getState().items.find((i) => i.linkedDrugId === "amoxicillin")!.currentQty;

    const res = usePharmacy.getState().resolveQuarantine(batchOf(drugId, "LINK-W").id, "WriteOff", "Destroyed per SOP");
    expect(res.ok).toBe(true);
    expect(batchOf(drugId, "LINK-W").status).toBe("Written Off");
    expect(layerOf("LINK-W").remainingQty).toBe(0);
    expect(useInventoryAccounting.getState().items.find((i) => i.linkedDrugId === "amoxicillin")!.currentQty).toBe(qtyBefore - 20);
    expect(useLedger.getState().entries.length).toBe(journalsBefore + 1);
    expect(usePharmacy.getState().totalStock(drugId)).toBe(0);
  });

  it("resolving a batch of a drug with no linked inventory item only touches the batch — no ledger entry", () => {
    const drugId = unlinkedDrug();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: expiry(), batchNumber: "UNLINKED" });
    usePharmacy.getState().quarantineBatch(batchOf(drugId, "UNLINKED").id, "Damaged");
    const journalsBefore = useLedger.getState().entries.length;

    expect(usePharmacy.getState().resolveQuarantine(batchOf(drugId, "UNLINKED").id, "WriteOff", "Damaged beyond use").ok).toBe(true);
    expect(batchOf(drugId, "UNLINKED").status).toBe("Written Off");
    expect(useLedger.getState().entries.length).toBe(journalsBefore);
  });

  it("writing off a controlled medicine's batch reduces its running balance", () => {
    const drugId = unlinkedDrug(true);
    usePharmacy.getState().receiveBatch({ drugId, quantity: 10, expiryDate: expiry(), batchNumber: "CTRL" });
    expect(usePharmacy.getState().runningBalance(drugId)).toBe(10);
    usePharmacy.getState().quarantineBatch(batchOf(drugId, "CTRL").id, "Seal broken");

    usePharmacy.getState().resolveQuarantine(batchOf(drugId, "CTRL").id, "WriteOff", "Witnessed destruction");
    expect(usePharmacy.getState().runningBalance(drugId)).toBe(0);
  });

  it("requires a note, and only a quarantined batch can be resolved", () => {
    const drugId = unlinkedDrug();
    usePharmacy.getState().receiveBatch({ drugId, quantity: 5, expiryDate: expiry(), batchNumber: "GUARD" });
    const id = batchOf(drugId, "GUARD").id;

    expect(usePharmacy.getState().resolveQuarantine(id, "Release", "ok").ok).toBe(false); // still Active
    usePharmacy.getState().quarantineBatch(id, "Check");
    expect(usePharmacy.getState().resolveQuarantine(id, "Release", "   ").ok).toBe(false); // no note
    expect(batchOf(drugId, "GUARD").status).toBe("Quarantined");
    expect(usePharmacy.getState().resolveQuarantine("nope", "Release", "x").ok).toBe(false);
  });
});
