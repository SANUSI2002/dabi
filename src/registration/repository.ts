import { APPLICATION_STEPS, createBlankApplication, type ApplicantDraftRepository, type OrganizationApplication } from "./domain";

const STORAGE_KEY = "sabi-organization-applications-v1";

function validApplication(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OrganizationApplication>;
  return typeof item.id === "string" && typeof item.reference === "string" && typeof item.updatedAt === "string";
}

function normalizeApplication(value: unknown): OrganizationApplication {
  const source = value as Partial<OrganizationApplication>;
  const defaults = createBlankApplication();
  const missingCompliance = !source.corporate || !source.regulatoryRegistration || !source.operatingOfficer;
  const allowedSteps = new Set(APPLICATION_STEPS.map((step) => step.key));
  let completedSteps = (source.completedSteps ?? []).filter((step) => allowedSteps.has(step));
  const mustReattachDocuments = source.status === "DRAFT" && completedSteps.includes("documents");
  if (mustReattachDocuments) completedSteps = completedSteps.filter((step) => step !== "documents");
  const sourceStepIndex = APPLICATION_STEPS.findIndex((step) => step.key === source.currentStep);
  const documentsStepIndex = APPLICATION_STEPS.findIndex((step) => step.key === "documents");
  return {
    ...defaults,
    ...source,
    owner: { ...defaults.owner, ...source.owner },
    organization: { ...defaults.organization, ...source.organization },
    corporate: { ...defaults.corporate, ...source.corporate },
    regulatoryRegistration: { ...defaults.regulatoryRegistration, ...source.regulatoryRegistration },
    operatingOfficer: { ...defaults.operatingOfficer, ...source.operatingOfficer },
    facility: { ...defaults.facility, ...source.facility },
    verification: { ...defaults.verification, ...source.verification },
    currentStep: source.status === "DRAFT" && missingCompliance && completedSteps.includes("organization")
      ? "corporate"
      : mustReattachDocuments && sourceStepIndex > documentsStepIndex ? "documents" : source.currentStep ?? "account",
    completedSteps,
  };
}

export const browserApplicantDraftRepository: ApplicantDraftRepository = {
  list() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
      return Array.isArray(value) ? value.filter(validApplication).map(normalizeApplication).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
    } catch {
      return [];
    }
  },
  save(application) {
    const applications = this.list().filter((item) => item.id !== application.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([application, ...applications]));
  },
  remove(applicationId) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list().filter((item) => item.id !== applicationId)));
  },
};

export function findPossibleDraftDuplicates(application: OrganizationApplication, applications: OrganizationApplication[]) {
  const clean = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  return applications.filter((item) => item.id !== application.id && item.status !== "WITHDRAWN" && (
    (clean(application.organization.legalName).length > 4 && clean(item.organization.legalName) === clean(application.organization.legalName)) ||
    (application.organization.officialEmail && item.organization.officialEmail.toLowerCase() === application.organization.officialEmail.toLowerCase()) ||
    (application.organization.officialPhone && clean(item.organization.officialPhone) === clean(application.organization.officialPhone))
  ));
}
