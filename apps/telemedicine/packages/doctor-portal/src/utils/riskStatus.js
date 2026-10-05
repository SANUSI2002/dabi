// Deterministic per-patient risk flag for the demo data — real risk
// scoring would come from vitals/records, which this build doesn't have.
const RISK_OVERRIDES = {
  "Michael Chen": "Critical",
};

export function riskStatusFor(patientName, hasNeedsResponse) {
  if (RISK_OVERRIDES[patientName]) return RISK_OVERRIDES[patientName];
  if (hasNeedsResponse) return "Needs Follow-up";
  return "Stable";
}

export function riskStatusClass(status) {
  if (status === "Critical") return "dp-risk-critical";
  if (status === "Needs Follow-up") return "dp-risk-followup";
  return "dp-risk-stable";
}
