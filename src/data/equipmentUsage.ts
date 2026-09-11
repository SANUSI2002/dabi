// Ties a real, named operator to a machine while it's running their test — the accountability
// layer the SCADA grid surfaces live ("this analyzer is running Samuel Etim's PCV for Caroline
// Patrick") and keeps as a traceable history afterward. The operator is never invented: it's
// whoever actually collected the sample on the real lab order (sampleCollectedBy), falling back
// to who ordered the test — both are real staff names already in the EMR, not simulator fiction.
export type UsageOutcome = "Completed" | "Aborted";

export type EquipmentUsageSession = {
  id: string;
  equipmentId: string;
  operator: string;
  patientId?: string;
  patientName?: string;
  testName?: string;
  orderId?: string;
  startedAt: string;
  endedAt?: string;
  outcome?: UsageOutcome;
};
