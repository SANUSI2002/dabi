import type { OrganizationApplication } from "@/registration/domain";
import type { ComplianceRequirement, ComplianceRequirementSet, Jurisdiction, Regulator, ResolvedComplianceRequirements } from "./domain";

export const JURISDICTIONS: Jurisdiction[] = [
  { id: "jur-ng", country: "Nigeria", name: "Nigeria", status: "ACTIVE" },
  { id: "jur-ng-la", country: "Nigeria", state: "Lagos", name: "Lagos State, Nigeria", status: "ACTIVE" },
];

export const REGULATORS: Regulator[] = [
  { id: "reg-cac", jurisdictionId: "jur-ng", name: "Corporate Affairs Commission", shortName: "CAC", scope: "CORPORATE", website: "https://www.cac.gov.ng" },
  { id: "reg-hefamaa", jurisdictionId: "jur-ng-la", name: "Health Facilities Monitoring and Accreditation Agency", shortName: "HEFAMAA", scope: "FACILITY", website: "https://hefamaa.lagosstate.gov.ng" },
  { id: "reg-mdcn", jurisdictionId: "jur-ng", name: "Medical and Dental Council of Nigeria", shortName: "MDCN", scope: "PROFESSIONAL", website: "https://www.mdcn.gov.ng" },
  { id: "reg-nmcn", jurisdictionId: "jur-ng", name: "Nursing and Midwifery Council of Nigeria", shortName: "NMCN", scope: "PROFESSIONAL", website: "https://www.nmcn.gov.ng" },
];

export const COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  { id: "req-cac-certificate", code: "CAC_CERTIFICATE", label: "Corporate registration certificate", description: "Evidence of the organization’s corporate registration where applicable.", kind: "DOCUMENT", required: true, regulatorId: "reg-cac", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10, appliesWhen: { ownershipTypes: ["Private", "Faith-based", "Non-profit", "Corporate group", "Other"] } },
  { id: "req-tax-evidence", code: "TAX_EVIDENCE", label: "Tax registration or revenue evidence", description: "Tax evidence appropriate to the organization and onboarding context.", kind: "DOCUMENT", required: true, accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10, appliesWhen: { ownershipTypes: ["Private", "Faith-based", "Non-profit", "Corporate group", "Other"] } },
  { id: "req-facility-registration", code: "FACILITY_REGISTRATION", label: "Facility registration or licence certificate", description: "Evidence supplied by the facility; Sabi does not issue or replace the regulator’s licence.", kind: "DOCUMENT", required: true, regulatorId: "reg-hefamaa", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10, tracksExpiry: true },
  { id: "req-waste-management", code: "WASTE_MANAGEMENT", label: "Waste-management evidence", description: "Applicable healthcare waste-management documentation for the facility.", kind: "DOCUMENT", required: true, regulatorId: "reg-hefamaa", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10 },
  { id: "req-hmis-rendition", code: "HMIS_RENDITION", label: "HMIS or data-rendition evidence", description: "Applicable health-information reporting documentation.", kind: "DOCUMENT", required: true, regulatorId: "reg-hefamaa", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10 },
  { id: "req-site-diagram", code: "SITE_DIAGRAM", label: "Facility or site diagram", description: "Site-layout evidence where required for the selected facility category.", kind: "DOCUMENT", required: true, regulatorId: "reg-hefamaa", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10, appliesWhen: { facilityTypes: ["Private Hospital", "Public Hospital", "Diagnostic Centre", "Medical Laboratory", "Maternity Centre"] } },
  { id: "req-previous-certificate", code: "PREVIOUS_CERTIFICATE", label: "Previous facility certificate", description: "Previous registration or renewal evidence for an existing facility.", kind: "DOCUMENT", required: true, regulatorId: "reg-hefamaa", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10, tracksExpiry: true, appliesWhen: { registrationStatuses: ["EXISTING"] } },
  { id: "req-officer-licence", code: "OFFICER_LICENCE", label: "Operating officer practising licence", description: "Current professional practising licence for the clinically responsible officer.", kind: "DOCUMENT", required: true, regulatorId: "reg-mdcn", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10, tracksExpiry: true },
  { id: "req-good-standing", code: "GOOD_STANDING", label: "Professional good-standing evidence", description: "Good-standing evidence where applicable to the profession and regulator.", kind: "DOCUMENT", required: false, regulatorId: "reg-mdcn", accepts: ["application/pdf", "image/jpeg", "image/png"], maximumSizeMb: 10 },
];

const LAGOS_FACILITY_TYPES = ["Private Hospital", "Public Hospital", "Clinic", "Primary Health Centre", "Maternity Centre", "Diagnostic Centre", "Medical Laboratory", "Dental Hospital / Clinic", "Eye Hospital / Clinic", "Physiotherapy Clinic", "Dialysis Centre", "Nursing / Convalescent Home", "Home Care Service", "Mobile Clinic"];

export const REQUIREMENT_SETS: ComplianceRequirementSet[] = [
  { id: "set-ng-corporate-v1", name: "Nigeria corporate identity baseline", jurisdictionId: "jur-ng", facilityTypes: ["*"], requirementIds: ["req-cac-certificate", "req-tax-evidence", "req-officer-licence", "req-good-standing"], version: 1, status: "ACTIVE", effectiveFrom: "2026-01-01", reviewNote: "Configurable onboarding baseline; confirm against current authoritative requirements before production use." },
  { id: "set-ng-la-facility-v1", name: "Lagos healthcare facility baseline", jurisdictionId: "jur-ng-la", facilityTypes: LAGOS_FACILITY_TYPES, requirementIds: ["req-facility-registration", "req-waste-management", "req-hmis-rendition", "req-site-diagram", "req-previous-certificate"], version: 1, status: "ACTIVE", effectiveFrom: "2026-01-01", reviewNote: "HEFAMAA-oriented configuration baseline. Applicability varies by facility type and registration context." },
];

function applies(requirement: ComplianceRequirement, application: OrganizationApplication) {
  const condition = requirement.appliesWhen;
  if (!condition) return true;
  if (condition.ownershipTypes && !condition.ownershipTypes.includes(application.organization.ownershipType)) return false;
  if (condition.facilityTypes && !condition.facilityTypes.includes(application.organization.facilityType)) return false;
  if (condition.registrationStatuses && !condition.registrationStatuses.includes(application.regulatoryRegistration.registrationStatus)) return false;
  if (condition.services && !condition.services.some((service) => application.facility.services.includes(service))) return false;
  return true;
}

export function resolveComplianceRequirements(application: OrganizationApplication): ResolvedComplianceRequirements {
  const country = application.organization.country.trim().toLowerCase();
  const state = application.organization.state.trim().toLowerCase();
  const jurisdictions = JURISDICTIONS.filter((item) => item.status === "ACTIVE" && item.country.toLowerCase() === country && (!item.state || item.state.toLowerCase() === state));
  const selectedJurisdiction = jurisdictions.find((item) => item.state) ?? jurisdictions[0];
  const matchingSets = REQUIREMENT_SETS.filter((set) => set.status === "ACTIVE" && jurisdictions.some((jurisdiction) => jurisdiction.id === set.jurisdictionId) && (set.facilityTypes.includes("*") || set.facilityTypes.includes(application.organization.facilityType)));
  const requirementIds = [...new Set(matchingSets.flatMap((set) => set.requirementIds))];
  const requirements = COMPLIANCE_REQUIREMENTS.filter((item) => requirementIds.includes(item.id) && applies(item, application));
  const regulators = REGULATORS.filter((item) => jurisdictions.some((jurisdiction) => jurisdiction.id === item.jurisdictionId));
  return { jurisdiction: selectedJurisdiction, regulators, requirements, requirementSets: matchingSets, fallback: matchingSets.length === 0 };
}
